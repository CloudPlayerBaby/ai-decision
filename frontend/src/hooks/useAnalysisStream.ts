import { useState, useEffect, useRef, useCallback } from 'react';
import { getAnalysisTask, createSseTicket, getTaskHistory } from '@/services/analysis.service';
import type {
  AnalysisResultStatus,
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
  /** 推演任务 ID */
  taskId?: string
  /** 展示标签：首次推演 / 重新推演结果 / 局部推演结果 */
  label: string
  /** 推演类型：FULL / PARTIAL */
  runType?: TaskRunType
  /** 任务状态：RUNNING / SUCCEEDED / FAILED */
  taskStatus?: string
  /** 该轮推演产出的分析结果 ID，仅成功任务有值 */
  analysisResultId?: string | null
  /** 该轮分析结果状态 */
  resultStatus?: AnalysisResultStatus | null
  /** 该组步骤的 ID 集合 */
  stepIds: string[]
  /** 是否是当前正在运行的 task */
  isCurrent: boolean
}

interface UseAnalysisStreamOptions {
  taskId: string | null;
  /** 外部触发重新拉取任务并重建 SSE，例如失败步骤重试后 taskId 不变 */
  refreshKey?: number;
  /** 决策 ID，用于加载历史推演记录（刷新页面不丢失历史步骤） */
  decisionId?: string;
  /** 当前 task 的推演类型（WorkbenchPage 传入），用于确定分隔标签 */
  runType?: TaskRunType;
  onResultReady?: (event: ResultReadyEvent) => void;
  onTaskFailed?: (event: TaskFailedEvent) => void;
  onTaskSucceeded?: (taskId: string) => void;
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
 * 将任务步骤合并到历史步骤末尾。
 * 已有步骤用 REST 最新快照覆盖；新步骤内部按标准顺序排列。
 */
function mergeSteps(
  prevSteps: AnalysisStep[],
  newSteps: AnalysisStep[],
): AnalysisStep[] {
  const nextById = new Map(newSteps.map((step) => [step.id, step]));
  const existingIds = new Set(prevSteps.map((s) => s.id));
  const updatedPrev = prevSteps.map((step) => {
    const next = nextById.get(step.id);
    if (!next) return step;

    return {
      ...step,
      ...next,
      name: next.name || step.name,
      displayName: next.displayName || step.displayName,
      summary: next.summary ?? step.summary,
      content: mergeStepContent(step.content, next.content),
    };
  });
  const added = newSteps.filter((s) => !existingIds.has(s.id));

  const sortedNew = [...added].sort((a, b) => {
    const orderA = STEP_ORDER[a.name] ?? 999;
    const orderB = STEP_ORDER[b.name] ?? 999;
    return orderA - orderB;
  });

  return [...updatedPrev, ...sortedNew];
}

export function useAnalysisStream({
  taskId,
  refreshKey = 0,
  decisionId,
  runType,
  onResultReady,
  onTaskFailed,
  onTaskSucceeded,
}: UseAnalysisStreamOptions): UseAnalysisStreamReturn {
  const [steps, setSteps] = useState<AnalysisStep[]>([]);
  const [toolCalls, setToolCalls] = useState<ToolCallEvent[]>([]);
  const [resultReady, setResultReady] = useState<ResultReadyEvent | null>(null);
  const [taskFailed, setTaskFailed] = useState<TaskFailedEvent | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [retryable, setRetryable] = useState(false);
  const [failedStepId, setFailedStepId] = useState<string | null>(null);
  const failedStepIdRef = useRef<string | null>(null);
  failedStepIdRef.current = failedStepId;
  const retryCountRef=useRef(0);
  const prevStepsRef = useRef<AnalysisStep[]>([]);
  const latestStepsRef = useRef<AnalysisStep[]>([]);
  latestStepsRef.current = steps;
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
  const onTaskSucceededRef = useRef(onTaskSucceeded);
  onTaskSucceededRef.current = onTaskSucceeded;

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

    // 切换决策时立刻清空，避免 WorkbenchPage 用新 decisionId + 旧 resultId 发请求
    prevStepsRef.current = [];
    setSteps([]);
    setStepGroups([]);
    historyLoadedRef.current = false;

    let cancelled = false;

    getTaskHistory(decisionId).then((historyItems) => {
      if (cancelled) return;

      // 拼接历史步骤 + 构建分组标签
      const allHistorySteps: AnalysisStep[] = [];
      const groups: StepGroupInfo[] = [];
      let fullCount = 0;

      const historyItemsForDisplay = historyItems.filter(
        (item) => item.taskId !== taskId || item.taskStatus !== 'RUNNING',
      );
      const historyTaskIds = new Set(historyItemsForDisplay.map((item) => item.taskId));

      for (const item of historyItemsForDisplay) {
        const label = deriveRunLabel(item.runType, fullCount);
        if (item.runType === 'FULL') fullCount++;
        allHistorySteps.push(...item.steps);
        groups.push({
          taskId: item.taskId,
          label,
          runType: item.runType,
          taskStatus: item.taskStatus,
          analysisResultId: item.analysisResultId,
          resultStatus: item.resultStatus,
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
        const currentGroups = prev
          .filter((g) => g.isCurrent && !historyTaskIds.has(g.taskId ?? ''))
          .map((group) => ({
            ...group,
            label: deriveRunLabel(runType ?? 'FULL', fullCount),
          }));
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
  }, [decisionId, taskId, runType]);

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
    prevStepsRef.current = latestStepsRef.current;
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
      if (task.steps.length > 0 && task.status !== 'SUCCEEDED') {
        setStepGroups((prev) => {
          const withoutCurrent = prev.filter((g) => !g.isCurrent);
          const fullCount = withoutCurrent.filter((g) => g.label !== '局部推演结果').length;
          const label = deriveRunLabel(runType ?? 'FULL', fullCount);
          return [
            ...withoutCurrent,
            {
              taskId: task.id,
              label,
              runType: runType ?? 'FULL',
              taskStatus: task.status,
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

      setTaskFailed(null);
      setRetryable(false);
      setFailedStepId(null);

      if (task.status === 'SUCCEEDED') {
        setStepGroups((prev) => prev.filter((group) => group.taskId !== task.id));
        setConnectionStatus('idle');
        onTaskSucceededRef.current?.(task.id);
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

        // 重试成功：失败步骤恢复为 RUNNING 后清除重试标记
        if (data.status === 'RUNNING' && data.stepId === failedStepIdRef.current) {
          setRetryable(false)
          setFailedStepId(null)
        }

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
        setStepGroups((prev) =>
          prev.map((group) =>
            group.taskId === data.taskId
              ? {
                  ...group,
                  taskStatus: 'SUCCEEDED',
                  analysisResultId: data.analysisResultId,
                  resultStatus: data.resultStatus,
                }
              : group,
          ),
        );
        getAnalysisTask(data.taskId)
          .then((latestTask) => {
            if (!mountedRef.current) return;
            setSteps((prev) => mergeSteps(prev, latestTask.steps));
            setProgress(latestTask.progress);
          })
          .catch(() => {
            if (!mountedRef.current) return;
            setProgress(100);
          })
          .finally(() => {
            if (!mountedRef.current) return;
            setConnectionStatus('idle');
            closeEventSource();
            onResultReadyRef.current?.(data);
          });
      });

      es.addEventListener('task_failed', (event: MessageEvent) => {
        if (!mountedRef.current) return;
        let data: TaskFailedEvent;
        try {
          data = JSON.parse(event.data);
        } catch {
          return;
        }

        const failedTaskId = data.taskId ?? taskId!;
        const failedEvent: TaskFailedEvent = {
          ...data,
          taskId: failedTaskId,
        };

        // task_failed 可能先于 FAILED step_update 到达。这里先落失败状态，避免
        // 关闭 EventSource 后丢失后续 step_update，导致重试按钮没有渲染条件。
        if (failedEvent.failedStepId) {
          setSteps((prev) =>
            prev.map((step) =>
              step.id === failedEvent.failedStepId
                ? { ...step, status: 'FAILED' }
                : step,
            ),
          );
        }
        setStepGroups((prev) =>
          prev.map((group) =>
            group.taskId === failedTaskId
              ? { ...group, taskStatus: 'FAILED' }
              : group,
          ),
        );
        setTaskFailed(failedEvent);
        onTaskFailedRef.current?.(failedEvent);
        setRetryable(failedEvent.retryable);
        setFailedStepId(failedEvent.failedStepId ?? null);
        setConnectionStatus('idle');
        closeEventSource();

        // SSE 只负责通知；失败后的最终步骤内容以持久化任务快照为准。
        getAnalysisTask(failedTaskId)
          .then((latestTask) => {
            if (cancelled || !mountedRef.current) return;
            setSteps((prev) => mergeSteps(prev, latestTask.steps));
            setProgress(latestTask.progress);
            setRetryable(latestTask.error?.retryable ?? failedEvent.retryable);
            setFailedStepId(
              latestTask.error?.failedStepId ?? failedEvent.failedStepId ?? null,
            );
          })
          .catch(() => {
            // 即时失败状态已由 task_failed 恢复，快照失败不影响用户重试。
          });
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
  }, [taskId, refreshKey, decisionId, runType, closeEventSource, clearTimer]);

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
