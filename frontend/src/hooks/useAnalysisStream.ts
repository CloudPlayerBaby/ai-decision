import { useState, useEffect, useRef, useCallback } from 'react';
import { getAnalysisTask, createSseTicket, getTaskHistory } from '@/services/analysis.service';
import type {
  AnalysisStep,
  ToolCallEvent,
  ResultReadyEvent,
  TaskFailedEvent,
  StepUpdateEvent,
  StepStatus,
  TaskRunType,
} from '@/types/analysis';

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting';

/** 步骤分组信息，用于 AnalysisChatPanel 渲染分隔和标签 */
export interface StepGroupInfo {
  /** 展示标签：首次推演 / 重新推演结果 / 局部推演结果 */
  label: string
  /** 该组步骤的 ID 集合 */
  stepIds: string[]
  /** 是否是当前正在运行的 task */
  isCurrent: boolean
}

interface UseAnalysisStreamOptions {
  taskId: string | null;
  /** 决策 ID，用于加载历史推演记录（刷新页面不丢失历史步骤） */
  decisionId?: string;
  /** 当前 task 的推演类型（WorkbenchPage 传入），用于确定分隔标签 */
  runType?: TaskRunType;
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
  retryable: boolean;
  failedStepId: string | null;
  /** 步骤分组信息（按推演轮次），含展示标签 */
  stepGroups: StepGroupInfo[];
}

function mergeStepContent(
  previousContent: string | undefined,
  nextContent: string | undefined,
): string | undefined {
  if (nextContent === undefined) return previousContent;
  return nextContent;
}

/** 标准步骤顺序，用于新步骤内部排序 */
const STEP_ORDER: Record<string, number> = {
  UNDERSTAND: 0,
  EXTRACT_FACTORS: 1,
  TOOL_CALL: 2,
  GENERATE_OPTIONS: 3,
  COMPARE_OPTIONS: 4,
  GENERATE_REPORT: 5,
};

/**
 * 根据已有历史和新 task 信息，计算本轮 label。
 * 首次 FULL → "首次推演"，后续 FULL → "重新推演结果"，PARTIAL → "局部推演结果"
 */
function deriveRunLabel(runType: TaskRunType, existingFullCount: number): string {
  if (runType === 'PARTIAL') return '局部推演结果'
  // FULL
  if (existingFullCount === 0) return '首次推演'
  return '重新推演结果'
}

/**
 * 将新任务的步骤追加到历史步骤末尾。
 * 旧步骤保持原有顺序不动；新步骤内部按标准顺序排列。
 */
function mergeSteps(
  prevSteps: AnalysisStep[],
  newSteps: AnalysisStep[],
): AnalysisStep[] {
  const existingIds = new Set(prevSteps.map((s) => s.id));
  const added = newSteps.filter((s) => !existingIds.has(s.id));

  const sortedNew = [...added].sort((a, b) => {
    const orderA = STEP_ORDER[a.name] ?? 999;
    const orderB = STEP_ORDER[b.name] ?? 999;
    return orderA - orderB;
  });

  return [...prevSteps, ...sortedNew];
}

export function useAnalysisStream({
  taskId,
  decisionId,
  runType,
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
  const prevStepsRef = useRef<AnalysisStep[]>([]);
  /** 步骤分组信息：每轮推演的标签 + 步骤 ID 集合 */
  const [stepGroups, setStepGroups] = useState<StepGroupInfo[]>([]);
  /** 当前 SSE 连接的 taskId，用于标记 isCurrent */
  const currentTaskIdRef = useRef<string | null>(null);
  /** 历史记录是否已加载 */
  const historyLoadedRef = useRef(false);

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

  // ── 加载历史推演记录（刷新恢复） ────────────────────────────
  useEffect(() => {
    if (!decisionId) {
      prevStepsRef.current = [];
      setSteps([]);
      setStepGroups([]);
      historyLoadedRef.current = false;
      return;
    }

    let cancelled = false;

    getTaskHistory(decisionId).then((historyItems) => {
      if (cancelled) return;

      // 拼接历史步骤 + 构建分组标签
      const allHistorySteps: AnalysisStep[] = [];
      const groups: StepGroupInfo[] = [];
      let fullCount = 0;

      for (const item of historyItems) {
        const label = deriveRunLabel(item.runType, fullCount);
        if (item.runType === 'FULL') fullCount++;
        allHistorySteps.push(...item.steps);
        groups.push({
          label,
          stepIds: item.steps.map((s) => s.id),
          isCurrent: false,
        });
      }
      const historyIds = new Set(allHistorySteps.map((s) => s.id));

      // merge：保留 taskId effect 已写入的当前 task 步骤
      setSteps((prev) => {
        const currentOnly = prev.filter((s) => !historyIds.has(s.id));
        return [...allHistorySteps, ...currentOnly];
      });
      setStepGroups((prev) => {
        // 保留已有当前 task group
        const currentGroups = prev.filter((g) => g.isCurrent);
        return [...groups, ...currentGroups];
      });
      prevStepsRef.current = allHistorySteps;
      historyLoadedRef.current = true;
    }).catch(() => {
      if (!cancelled) {
        historyLoadedRef.current = true;
      }
    });

    return () => {
      cancelled = true;
      historyLoadedRef.current = false;
    };
  }, [decisionId]);

  // ── SSE 连接 ──────────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;

    if (!taskId) {
      if (!decisionId) {
        setSteps([]);
        prevStepsRef.current = [];
        setStepGroups([]);
      }
      setToolCalls([]);
      setResultReady(null);
      setTaskFailed(null);
      setProgress(0);
      setConnectionStatus('idle');
      closeEventSource();
      clearTimer();
      return;
    }

    // taskId 变化：保存旧步骤快照，标记旧 group 为历史
    prevStepsRef.current = steps;
    currentTaskIdRef.current = taskId;
    // 新 task 的 label 先记为占位，等 REST 拿到 runType 后修正
    setStepGroups((prev) => prev.map((g) => ({ ...g, isCurrent: false })));
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

      // 合并历史步骤
      const merged = mergeSteps(prevStepsRef.current, task.steps);
      setSteps(merged);
      setProgress(task.progress);

      // 添加本轮 group（标签从当前分组状态实时计算，不用 ref 避免不同步）
      if (task.steps.length > 0) {
        setStepGroups((prev) => {
          const withoutCurrent = prev.filter((g) => !g.isCurrent);
          const fullCount = withoutCurrent.filter((g) => g.label !== '局部推演结果').length;
          const label = deriveRunLabel(runType ?? 'FULL', fullCount);
          return [
            ...withoutCurrent,
            {
              label,
              stepIds: task.steps.map((s) => s.id),
              isCurrent: true,
            },
          ];
        });
      }

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
    stepGroups,
  };
}
