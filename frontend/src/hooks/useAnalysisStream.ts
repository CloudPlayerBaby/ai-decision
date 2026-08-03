import { useState, useEffect, useRef, useCallback } from 'react';
import { getAnalysisTask, createSseTicket } from '@/services/analysis.service';
import type {
  AnalysisStep,
  ToolCallEvent,
  ResultReadyEvent,
  TaskFailedEvent,
  StepUpdateEvent,
  StepStatus,
} from '@/types/analysis';

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting';

interface UseAnalysisStreamOptions {
  taskId: string | null;
  onResultReady?: (event: ResultReadyEvent) => void;
  onTaskFailed?: (event: TaskFailedEvent) => void;
}

export interface UseAnalysisStreamReturn {
  steps: AnalysisStep[];
  toolCalls: ToolCallEvent[];
  resultReady: ResultReadyEvent | null;
  taskFailed: TaskFailedEvent | null;
  connectionStatus: ConnectionStatus;
  progress: number;
  /** 当前任务失败是否可重试（来自 REST 恢复或 SSE task_failed 事件） */
  retryable: boolean;
  /** 当前任务失败的步骤 ID，仅当 retryable 为 true 时有意义 */
  failedStepId: string | null;
}

function mergeStepContent(
  previousContent: string | undefined,
  nextContent: string | undefined,
  nextStatus: StepStatus,
): string | undefined {
  if (nextContent === undefined) return previousContent;
  if (!previousContent) return nextContent;

  const placeholders = new Set(['思考中...', '即将开始...']);
  if (
    nextStatus === 'SUCCEEDED' ||
    nextStatus === 'FAILED' ||
    placeholders.has(previousContent)
  ) {
    return nextContent;
  }

  if (nextContent.startsWith(previousContent)) return nextContent;
  return `${previousContent}${nextContent}`;
}

export function useAnalysisStream({
  taskId,
  onResultReady,
  onTaskFailed,
}: UseAnalysisStreamOptions): UseAnalysisStreamReturn {
  const [steps, setSteps] = useState<AnalysisStep[]>([]);
  const [toolCalls, setToolCalls] = useState<ToolCallEvent[]>([]);
  const [resultReady, setResultReady] = useState<ResultReadyEvent | null>(null);
  const [taskFailed, setTaskFailed] = useState<TaskFailedEvent | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [retryable, setRetryable] = useState(false);
  const [failedStepId, setFailedStepId] = useState<string | null>(null);
  const retryCountRef=useRef(0);

  const mountedRef = useRef(true);
  const esRef = useRef<EventSource | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onResultReadyRef = useRef(onResultReady);
  onResultReadyRef.current = onResultReady;
  const onTaskFailedRef = useRef(onTaskFailed);
  onTaskFailedRef.current = onTaskFailed;

  const closeEventSource = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    if (!taskId) {
      setSteps([]);
      setToolCalls([]);
      setResultReady(null);
      setTaskFailed(null);
      setProgress(0);
      setConnectionStatus('idle');
      closeEventSource();
      clearTimer();
      return;
    }

    // taskId 变化：重置步骤和结果，等待新连接
    setSteps([]);
    setToolCalls([]);
    setResultReady(null);
    setTaskFailed(null);
    setProgress(0);
    setRetryable(false);
    setFailedStepId(null);
    retryCountRef.current=0;

    let cancelled = false;

    async function connect() {
      if (cancelled) return;

      setConnectionStatus('connecting');

      let task;
      try {
        task = await getAnalysisTask(taskId!);
      } catch {
        if (!cancelled && mountedRef.current) {
          setConnectionStatus('idle');
        }
        return;
      }

      if (cancelled || !mountedRef.current) return;

      setSteps(task.steps);
      setProgress(task.progress);

      if (task.status === 'FAILED') {
        const failedEvent: TaskFailedEvent = {
          taskId: task.id,
          errorCode: task.error?.code ?? 50000,
          message: task.error?.message ?? '推演执行失败，请稍后重试',
          failedStepId: task.error?.failedStepId,
          retryable: task.error?.retryable ?? false,
        };
        setTaskFailed(failedEvent);
        setRetryable(failedEvent.retryable);
        setFailedStepId(failedEvent.failedStepId ?? null);
        setConnectionStatus('idle');
        onTaskFailedRef.current?.(failedEvent);
        return;
      }

      let sseUrl: string;
      try {
        const ticket = await createSseTicket(taskId!);
        sseUrl = ticket.sseUrl;
      } catch {
        if (!cancelled && mountedRef.current) {
          setConnectionStatus('idle');
        }
        return;
      }

      if (cancelled || !mountedRef.current) return;

      closeEventSource();
      const es = new EventSource(sseUrl);
      esRef.current = es;

      es.onopen = () => {
        if (!mountedRef.current) return;
        setConnectionStatus('connected');
        retryCountRef.current = 0;
      };

      es.addEventListener('step_update', (event: MessageEvent) => {
        if (!mountedRef.current) return;
        let data: StepUpdateEvent;
        try {
          data = JSON.parse(event.data);
        } catch {
          return;
        }

        setSteps((prev) => {
          const idx = prev.findIndex((s) => s.id === data.stepId);
          const updated: AnalysisStep = idx >= 0
            ? {
                ...prev[idx],
                status: data.status as StepStatus,
                summary: data.summary ?? prev[idx].summary,
                content: mergeStepContent(
                  prev[idx].content,
                  data.content,
                  data.status as StepStatus,
                ),
              }
            : {
                id: data.stepId,
                name: '',
                displayName: '',
                status: data.status as StepStatus,
                summary: data.summary,
                content: data.content,
              };

          if (idx >= 0) {
            const next = [...prev];
            next[idx] = updated;
            return next;
          }
          return [...prev, updated];
        });

        if (data.progress !== undefined) {
          setProgress(data.progress);
        }
      });

      es.addEventListener('tool_call', (event: MessageEvent) => {
        if (!mountedRef.current) return;
        let data: ToolCallEvent;
        try {
          data = JSON.parse(event.data);
        } catch {
          return;
        }

        setToolCalls((prev) => {
          const idx = prev.findIndex(
            (tc) => tc.stepId === data.stepId && tc.toolName === data.toolName,
          );
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = data;
            return next;
          }
          return [...prev, data];
        });
      });

      es.addEventListener('result_ready', (event: MessageEvent) => {
        if (!mountedRef.current) return;
        let data: ResultReadyEvent;
        try {
          data = JSON.parse(event.data);
        } catch {
          return;
        }

        setResultReady(data);
        onResultReadyRef.current?.(data);
      });

      es.addEventListener('task_failed', (event: MessageEvent) => {
        if (!mountedRef.current) return;
        let data: TaskFailedEvent;
        try {
          data = JSON.parse(event.data);
        } catch {
          return;
        }

        setTaskFailed(data);
        onTaskFailedRef.current?.(data);
        setRetryable(data.retryable);
        setFailedStepId(data.failedStepId ?? null);
        closeEventSource();
      });

      es.addEventListener('ping', () => {});

      es.onerror = () => {
        closeEventSource();
        if (!mountedRef.current || cancelled) return;

        setConnectionStatus('reconnecting');
        clearTimer();

        retryCountRef.current+=1;
        const base=Math.min(1000 * Math.pow(2,retryCountRef.current), 30000);
        const delay=base/2+Math.random()*base/2;
        timerRef.current = setTimeout(() => {
          if (!mountedRef.current || cancelled) return;
          connect();
        }, delay);
      };
    }

    connect();

    return () => {
      cancelled = true;
      mountedRef.current = false;
      closeEventSource();
      clearTimer();
    };
  }, [taskId, closeEventSource, clearTimer]);

  return {
    steps,
    toolCalls,
    resultReady,
    taskFailed,
    connectionStatus,
    progress,
    retryable,
    failedStepId,
  };
}
