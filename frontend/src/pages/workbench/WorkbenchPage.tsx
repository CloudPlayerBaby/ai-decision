import {
  Alert,
  Button,
  Modal,
  Result,
  Space,
  Spin,
  Tag,
  Tooltip,
  message,
} from 'antd'
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  PlayCircleOutlined,
} from '@ant-design/icons'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useBlocker } from 'react-router'
import type { BlockerFunction } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect, useRef } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { DecisionCanvasPanel } from '@/components/workbench/DecisionCanvasPanel'
import { AnalysisChatPanel } from '@/features/analysis/AnalysisChatPanel'
import { useAnalysisStream } from '@/hooks/useAnalysisStream'
import { ConfirmResultModal } from '@/components/workbench/ConfirmResultModal'
import { DecisionStatusTag } from '@/components/common/DecisionStatusTag'
import { ResizeHandle } from '@/components/layout/ResizeHandle'
import { LAYOUT_LIMITS, useLayoutStore } from '@/stores/layoutStore'
import {
  getDecisionDetail,
  startFullAnalysis,
} from '@/services/decision.service'
import {
  confirmAnalysis,
  getAnalysisResult,
  retryFailedStep,
  startPartialAnalysis,
} from '@/services/analysis.service'
import { getCanvas, saveCanvas } from '@/services/canvas.service'
import { buildCanvasViewModel } from '@/utils/canvasMapper'
import { readCanvasCache, writeCanvasCache, clearCanvasCache } from '@/utils/canvasCache'
import { buildServerVersion } from '@/utils/canvasCache'
import { queryKeys } from '@/services/queryKeys'
import { ApiError, BusinessCode } from '@/types/api'
import { isMockEnabled } from '@/services/config'

/**
 * 推演工作台：中间画布(A) + 右侧推演对话(B)。
 * C 负责详情恢复、开始推演、确认方案、状态标签与三栏挂载契约。
 */
export function WorkbenchPage() {
  const { id = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [animCompleted, setAnimCompleted] = useState(false)
  const [activeResultId, setActiveResultId] = useState<string | null>(null)

  // ── 局部推演状态 ──────────────────────────────────────────
  /** 保存成功后，后端返回的 changedNodeIds；局部重推成功后保留，失败后允许重试 */
  const [pendingChangedNodeIds, setPendingChangedNodeIds] = useState<string[]>([])
  /** 当前局部推演任务；结束时清空 */
  const [partialAnalysisInfo, setPartialAnalysisInfo] = useState<{
    taskId: string
    affectedNodeIds: string[]
    status: 'RUNNING'
  } | null>(null)

  const rightCollapsed = useLayoutStore((state) => state.rightCollapsed)
  const rightWidth = useLayoutStore((state) => state.rightWidth)
  const leftCollapsed = useLayoutStore((state) => state.leftCollapsed)
  const leftWidth = useLayoutStore((state) => state.leftWidth)
  const setRightCollapsed = useLayoutStore((state) => state.setRightCollapsed)
  const setRightWidth = useLayoutStore((state) => state.setRightWidth)

  const leftOccupied = leftCollapsed
    ? LAYOUT_LIMITS.leftCollapsedWidth
    : leftWidth
  const rightDragMax = Math.max(
    LAYOUT_LIMITS.rightMin,
    Math.min(
      LAYOUT_LIMITS.rightMax,
      (typeof window !== 'undefined' ? window.innerWidth : 1440) -
      leftOccupied -
      LAYOUT_LIMITS.minCenterWidth -
      12,
    ),
  )

  const detailQuery = useQuery({
    queryKey: queryKeys.decisions.detail(id),
    queryFn: () => getDecisionDetail(id),
    enabled: Boolean(id),
    retry: (count, error) => {
      if (error instanceof ApiError && error.code === BusinessCode.NotFound) {
        return false
      }
      return count < 1
    },
  })

  const decision = detailQuery.data?.decision
  const pendingResultId =
    detailQuery.data?.pendingResultId ?? decision?.pendingResultId ?? null
  const confirmedResultId = detailQuery.data?.confirmedResultId ?? null
  const reportId = detailQuery.data?.reportId ?? null
  const taskId = decision?.latestTaskId ?? null
  const selectedOptionId = decision?.preferredOptionId ?? null

  const historyResultId = pendingResultId ?? confirmedResultId ?? null
  const effectiveResultId = activeResultId ?? historyResultId

  // ── SSE taskId 逻辑 ────────────────────────────────────────
  /** 局部推演期间的 taskId；无局部推演时用 decision.latestTaskId */
  const streamTaskId = partialAnalysisInfo?.taskId ?? taskId
  // 追踪当前 SSE 连接的 taskId，防止旧事件误清除当前状态
  const streamTaskIdRef = useRef<string | null>(null)

  const { steps, connectionStatus, toolCalls, retryable, failedStepId } = useAnalysisStream({
    taskId: streamTaskId,
    onResultReady: async (event) => {
      // 仅处理当前局部任务的结果；忽略旧任务事件
      if (streamTaskIdRef.current !== event.taskId) return

      setActiveResultId(event.analysisResultId)
      forceBackendData.current = true
      setPartialAnalysisInfo(null) // 局部推演结束，清除状态

      await queryClient.invalidateQueries({
        queryKey: queryKeys.decisions.detail(id),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.decisions.analysisResult(id, event.analysisResultId),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.decisions.canvas(id),
      });
    },
    onTaskFailed: (event) => {
      // 仅处理当前局部任务失败；忽略旧任务事件
      if (streamTaskIdRef.current !== event.taskId) return

      if (event.retryable) {
        message.warning(`局部推演失败: ${event.message}`);
      } else {
        message.error(`局部推演失败: ${event.message}`);
      }
      setPartialAnalysisInfo(null) // 失败也清除局部状态，但 pendingChangedNodeIds 保留
    },
  });

  // 同步 streamTaskId 到 ref，供 SSE 回调判断
  useEffect(() => {
    streamTaskIdRef.current = streamTaskId
  }, [streamTaskId])

  useEffect(() => {
    setAnimCompleted(false);
    setActiveResultId(null);
  }, [taskId]);

  const resultQuery = useQuery({
    queryKey: queryKeys.decisions.analysisResult(id, effectiveResultId),
    queryFn: () => getAnalysisResult(id, effectiveResultId),
    // 简化的 enabled 条件：只需要 id 和 effectiveResultId 非空
    enabled: Boolean(id) && Boolean(effectiveResultId),
    staleTime: 0,
  })

  console.log('[WorkbenchPage] resultQuery.data:', resultQuery.data)
  console.log('[WorkbenchPage] resultQuery.error:', resultQuery.error)
  console.log('[WorkbenchPage] resultQuery.isFetching:', resultQuery.isFetching)

  const displayOptions = resultQuery.data?.options ?? []
  const displayRecommendation = resultQuery.data?.recommendation ?? null
  const displayAnalysisResultId = resultQuery.data?.id ?? ''

  const startMutation = useMutation({
    mutationFn: () => startFullAnalysis(id),
    onSuccess: async (data) => {
      message.success('已开始整轮推演')
      await queryClient.invalidateQueries({
        queryKey: queryKeys.decisions.detail(id),
      })
      await queryClient.invalidateQueries({
        queryKey: queryKeys.analysisTasks.detail(data.taskId),
      })
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === BusinessCode.Conflict) {
        message.error('已有运行中的推演任务，请勿重复提交')
      }
    },
  })

  const confirmAbortRef = useRef<AbortController | null>(null)

  const confirmMutation = useMutation({
    mutationFn: (selectedOptionId: string) => {
      confirmAbortRef.current?.abort()
      const controller = new AbortController()
      confirmAbortRef.current = controller
      const analysisResultId =
        resultQuery.data?.id ?? pendingResultId ?? ''
      return confirmAnalysis(
        id,
        {
          analysisResultId,
          selectedOptionId,
        },
        { signal: controller.signal },
      )
    },
    onSuccess: async (data) => {
      confirmAbortRef.current = null
      message.success('已确认方案并生成报告')
      setConfirmOpen(false)
      await queryClient.invalidateQueries({ queryKey: queryKeys.decisions.all })
      await refreshDecision()
      navigate(`/reports/${data.reportId}`)
    },
    onError: (error) => {
      confirmAbortRef.current = null
      // 用户主动取消：不弹错误
      if (
        (typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          (error as { code?: string }).code === 'ERR_CANCELED') ||
        (error instanceof DOMException && error.name === 'AbortError') ||
        (error instanceof Error && /cancel|abort/i.test(error.message))
      ) {
        return
      }
    },
  })

  const handleConfirmCancel = () => {
    confirmAbortRef.current?.abort()
    confirmAbortRef.current = null
    confirmMutation.reset()
    setConfirmOpen(false)
  }

  // ── 画布数据（GET /decisions/:id/canvas）─────────────────────
  const canvasQuery = useQuery({
    queryKey: queryKeys.decisions.canvas(id),
    queryFn: () => getCanvas(id),
    enabled: Boolean(id),
    staleTime: 0,
  })

  // sessionStorage 缓存逻辑（核心原则）：
  // - 页面初次加载（刷新）：从 sessionStorage 恢复未保存的本地编辑
  // - 页面切换（导航）：丢弃前端缓存，从后端重新拉取
  // - 画布编辑时：写入 sessionStorage（未保存的本地编辑）
  // - 保存成功：清除 sessionStorage（数据已在后端，刷新时走后端）
  const idRef = useRef(id)
  const idSwitchTimeRef = useRef(0)
  const [activeCanvas, setActiveCanvas] = useState<import('@/types/canvas').Canvas | undefined>(
    () => readCanvasCache(id)?.canvas ?? undefined,
  )

  // id 变化 = 页面切换（非刷新）：丢弃前端缓存，从后端重新拉取
  useEffect(() => {
    if (id === idRef.current) return
    idRef.current = id
    idSwitchTimeRef.current = Date.now()
    // 切换页面时清空前端状态，切换回来时 canvasQuery 会重新请求后端数据
    setActiveCanvas(undefined)
  }, [id])

  // canvasQuery 数据回来后，更新 activeCanvas
  // 注意：页面切换后 canvasQuery 会重新请求（staleTime: 0），
  // 此时 activeCanvas 为 undefined，直接用后端数据填充
  const serverVersionRef = useRef(0)
  // 追踪上一次后端版本
  const lastBackendVersion = useRef(0)
  // 追踪上一次数据更新时间，用于检测数据变化
  const lastDataUpdatedAt = useRef(0)

  // 追踪是否有未保存的本地编辑
  const hasLocalEdit = useRef(false)

  // 追踪是否应该强制使用后端数据（比如推演完成时）
  const forceBackendData = useRef(false)

  useEffect(() => {
    if (!canvasQuery.data) return
    if (idRef.current !== id) return
    // 数据更新时间早于 id 切换时间 → 旧决策的缓存数据，丢弃
    if (canvasQuery.dataUpdatedAt < idSwitchTimeRef.current) {
      console.log('[WorkbenchPage] canvas effect: data is stale, skipping')
      return
    }

    const newVersion = buildServerVersion(canvasQuery.data)
    const isDataUpdated = canvasQuery.dataUpdatedAt !== lastDataUpdatedAt.current
    console.log('[WorkbenchPage] canvas effect: newVersion=', newVersion, 'lastVersion=', lastBackendVersion.current, 'dataUpdated=', isDataUpdated, 'hasLocalEdit=', hasLocalEdit.current, 'forceBackendData=', forceBackendData.current)

    // 追踪后端 version
    serverVersionRef.current = newVersion

    setActiveCanvas((prev) => {
      // 如果没有本地数据（页面切换后首次加载），直接用后端数据
      if (!prev) {
        console.log('[WorkbenchPage] no local data, using backend data')
        lastBackendVersion.current = newVersion
        lastDataUpdatedAt.current = canvasQuery.dataUpdatedAt
        forceBackendData.current = false
        return canvasQuery.data
      }

      // 有本地数据时，比较版本
      // 推演完成后版本会增加，如果版本更新且没有本地编辑，用后端数据
      if (isDataUpdated && newVersion !== lastBackendVersion.current) {
        // 后端数据更新了
        if (!hasLocalEdit.current || forceBackendData.current) {
          console.log('[WorkbenchPage] backend updated, syncing (forceBackendData:', forceBackendData.current, ')')
          lastBackendVersion.current = newVersion
          lastDataUpdatedAt.current = canvasQuery.dataUpdatedAt
          forceBackendData.current = false
          return canvasQuery.data
        } else {
          console.log('[WorkbenchPage] backend updated but has local edits, keeping local')
          lastBackendVersion.current = newVersion
          lastDataUpdatedAt.current = canvasQuery.dataUpdatedAt
        }
      }

      return prev
    })
  }, [canvasQuery.data, canvasQuery.dataUpdatedAt, id])

  const viewModel =
    activeCanvas && decision
      ? buildCanvasViewModel(decision, activeCanvas, resultQuery.data ?? undefined)
      : undefined

  // isDirty 初始为 false，等 canvasQuery 数据回来后对比缓存和服务器内容再决定
  const [isDirty, setIsDirty] = useState(false)
  // 追踪用户是否已实际修改过画布（区分初始化和用户操作）
  const hasUserEdited = useRef(false)
  // 等 canvasQuery 数据回来后，对比缓存和服务器内容决定初始 isDirty（仅执行一次）
  const didEvaluateCache = useRef(false)
  useEffect(() => {
    if (!canvasQuery.data) return
    if (didEvaluateCache.current) return
    didEvaluateCache.current = true
    const cached = readCanvasCache(id)
    if (cached) {
      const serverVersion = buildServerVersion(canvasQuery.data)
      const isDirty = serverVersion !== cached.serverVersion
      console.log('[WorkbenchPage] evaluateCache: serverVersion=', serverVersion, 'cachedServerVersion=', cached.serverVersion, 'isDirty=', isDirty)
      setIsDirty(isDirty)
    }
  }, [canvasQuery.data, id])
  // 保存按钮回调时引用最新 canvas 数据
  const canvasRef = useRef<import('@/types/canvas').Canvas | null>(null)

  const saveMutation = useMutation({
    mutationFn: (canvas: import('@/types/canvas').Canvas) =>
      saveCanvas(id, canvas),
    onSuccess: (data) => {
      message.success('画布已保存')
      queryClient.invalidateQueries({ queryKey: queryKeys.decisions.canvas(id) })
      setIsDirty(false)
      setActiveCanvas(undefined) // 触发重新从后端加载
      clearCanvasCache(id) // 清除旧缓存，刷新时走后端

      // 保存 changedNodeIds，不自动触发局部重推
      setPendingChangedNodeIds(data.changedNodeIds ?? [])

      // 保存完成后解锁导航
      if (leaveAction === 'save') {
        setLeaveAction(null)
        blocker.proceed?.()
      }
    },
    onError: (error) => {
      message.error(`保存失败：${error instanceof Error ? error.message : '请稍后重试'}`)
      setIsDirty(true)
      setLeaveAction(null)
      // 失败时不清空 pendingChangedNodeIds，允许重试
    },
  })

  // 画布变化时：更新 canvasRef + 写入 sessionStorage + 标记 dirty
  const handleCanvasChange = (canvas: import('@/types/canvas').Canvas) => {
    console.log('[WorkbenchPage] handleCanvasChange called')
    canvasRef.current = canvas
    hasUserEdited.current = true
    setIsDirty(true)
    writeCanvasCache(id, canvas, serverVersionRef.current)
  }

  // 保存权重：先保存画布，成功后自动发起局部重推
  const handleWeightSave = (canvas: import('@/types/canvas').Canvas) => {
    canvasRef.current = canvas
    hasUserEdited.current = true
    // 立即用新 canvas 保存，触发局部重推
    saveForPartialMutation.mutate(canvas)
  }

  // 专用 mutation：保存画布并自动触发局部重推（仅用于权重保存）
  const saveForPartialMutation = useMutation({
    mutationFn: (canvas: import('@/types/canvas').Canvas) =>
      saveCanvas(id, canvas),
    onSuccess: (data) => {
      message.success('权重已保存')
      queryClient.invalidateQueries({ queryKey: queryKeys.decisions.canvas(id) })
      setIsDirty(false)
      setActiveCanvas(undefined)
      clearCanvasCache(id)

      const changedIds = data.changedNodeIds ?? []
      setPendingChangedNodeIds(changedIds)

      if (changedIds.length > 0) {
        // 自动发起局部重推
        startPartialAnalysisMutation.mutate(changedIds)
      } else {
        message.info('权重已保存，无需重新推演')
      }

      if (leaveAction === 'save') {
        setLeaveAction(null)
        blocker.proceed?.()
      }
    },
    onError: (error) => {
      message.error(`保存失败：${error instanceof Error ? error.message : '请稍后重试'}`)
      setIsDirty(true)
      setLeaveAction(null)
    },
  })

  // ── 路由拦截：未保存时弹出确认框 ─────────────────────────────
  // 用 useBlocker 真正拦截导航（在页面跳转之前拦截）
  const [leaveAction, setLeaveAction] = useState<'save' | 'discard' | null>(null)
  const blocker = useBlocker(
    (({ currentLocation, nextLocation }) => {
      const blocked = isDirty && currentLocation.pathname !== nextLocation.pathname
      console.log('[blocker] check: isDirty=', isDirty, 'blocked=', blocked)
      return blocked
    }) as BlockerFunction,
  )

  const handleLeaveSave = () => {
    if (!canvasRef.current) {
      message.error('画布数据异常，请重试')
      return
    }
    setLeaveAction('save')
    setActiveCanvas(undefined)
    saveMutation.mutate(canvasRef.current)
  }

  const handleLeaveDiscard = () => {
    setLeaveAction('discard')
    setIsDirty(false)
    setActiveCanvas(undefined)
    clearCanvasCache(id)
    setLeaveAction(null)
    blocker.proceed?.()
  }

  const handleLeaveCancel = () => {
    setLeaveAction(null)
    blocker.reset?.()
  }

  const refreshDecision = async () => {
    await queryClient.invalidateQueries({
      queryKey: queryKeys.decisions.detail(id),
    })
    await queryClient.invalidateQueries({
      queryKey: queryKeys.decisions.analysisResult(id, pendingResultId),
    })
    await queryClient.invalidateQueries({
      queryKey: queryKeys.decisions.canvas(id),
    })
  }

  const retryMutation = useMutation({
    mutationFn: (stepId: string) =>
      retryFailedStep(taskId!, stepId),
    onSuccess: async () => {
      message.success('步骤已重新入队，请等待推演更新')
      await queryClient.invalidateQueries({
        queryKey: queryKeys.analysisTasks.detail(taskId!),
      })
    },
    onError: () => {
      message.error('重试失败，请稍后重试')
    },
  })

  /** 局部重推 mutation */
  const startPartialAnalysisMutation = useMutation({
    mutationFn: (changedNodeIds: string[]) =>
      startPartialAnalysis(id, { changedNodeIds }),
    onSuccess: (data) => {
      console.log('[WorkbenchPage] partial analysis started:', data)
      message.info('已发起局部重推，请等待推演完成')
      // 设置局部推演状态：taskId + affectedNodeIds
      setPartialAnalysisInfo({
        taskId: data.taskId,
        affectedNodeIds: data.affectedNodeIds,
        status: 'RUNNING',
      })
      // pendingChangedNodeIds 保留（失败时可重试）
      queryClient.invalidateQueries({
        queryKey: queryKeys.analysisTasks.detail(data.taskId),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.decisions.canvas(id),
      })
    },
    onError: () => {
      message.error('局部重推发起失败，请稍后重试')
      // pendingChangedNodeIds 保留，允许重试
    },
  })

  if (detailQuery.isError) {
    const err = detailQuery.error
    const is404 =
      err instanceof ApiError &&
      (err.code === BusinessCode.NotFound || err.httpStatus === 404)
    return (
      <Result
        status={is404 ? '404' : 'error'}
        title={is404 ? '记录不存在或无权访问' : '加载失败'}
        subTitle={
          is404
            ? '该决策可能已被删除，或不属于当前账号。'
            : err instanceof Error
              ? err.message
              : '请稍后重试'
        }
        extra={
          <Button type="primary" onClick={() => navigate('/decisions')}>
            返回决策列表
          </Button>
        }
      />
    )
  }

  if (detailQuery.isLoading || !decision) {
    return (
      <div className="workbench" style={{ padding: 48, textAlign: 'center' }}>
        <Spin size="large" description="加载决策详情…" />
      </div>
    )
  }

  const canStartAnalysis =
    (decision.status === 'PENDING' && !animCompleted) ||
    decision.status === 'WAITING_CONFIRM' ||
    decision.status === 'COMPLETED' ||
    decision.status === 'FAILED'

  const analyzing =
    (decision.status === 'ANALYZING' ||
      decision.status === 'PARTIAL_ANALYZING') &&
    !animCompleted

  const canConfirm =
    decision.status === 'WAITING_CONFIRM' ||
    Boolean(decision.hasPendingResult) ||
    (animCompleted && decision.status !== 'COMPLETED')

  return (
    <div className="workbench">
      <PageHeader
        className="workbench__header"
        breadcrumb={[{ title: <Link to="/decisions">决策记录</Link> }]}
        title={decision.title}
        status={
          <DecisionStatusTag
            status={decision.status}
            hasPendingResult={decision.hasPendingResult}
          />
        }
        description={
          isMockEnabled() ? (
            <div className="workbench__meta">
              <Tag>Mock</Tag>
            </div>
          ) : undefined
        }
        extra={
          <Space size={[8, 8]} wrap>
            <Tooltip title={rightCollapsed ? '展开推演对话' : '收起推演对话'}>
              <Button
                icon={
                  rightCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />
                }
                onClick={() => setRightCollapsed(!rightCollapsed)}
              />
            </Tooltip>
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              loading={startMutation.isPending}
              disabled={
                !canStartAnalysis || startMutation.isPending || analyzing
              }
              onClick={() => startMutation.mutate()}
            >
              {analyzing ? '推演中…' : decision.status === 'WAITING_CONFIRM' || decision.status === 'COMPLETED' ? '重新推演' : '开始推演'}
            </Button>
            <Button
              onClick={() => {
                if (!canvasRef.current) {
                  message.error('画布数据尚未准备好，请稍后重试')
                  return
                }
                saveMutation.mutate(canvasRef.current)
              }}
              loading={saveMutation.isPending}
              disabled={!isDirty || partialAnalysisInfo !== null || saveForPartialMutation.isPending}
            >
              {saveMutation.isPending ? '保存中…' : '保存画布'}
            </Button>
            <Tooltip
              title={
                pendingChangedNodeIds.length === 0
                  ? '当前修改仅影响布局，无需局部重推'
                  : partialAnalysisInfo !== null
                    ? '已有局部推演进行中'
                    : undefined
              }
            >
              <Button
                disabled={
                  pendingChangedNodeIds.length === 0 ||
                  partialAnalysisInfo !== null ||
                  saveForPartialMutation.isPending ||
                  startPartialAnalysisMutation.isPending
                }
                loading={startPartialAnalysisMutation.isPending}
                onClick={() => {
                  startPartialAnalysisMutation.mutate(pendingChangedNodeIds)
                }}
              >
                {startPartialAnalysisMutation.isPending ? '局部重推中…' : '局部重推'}
              </Button>
            </Tooltip>
            <Button
              type="primary"
              disabled={!canConfirm || confirmMutation.isPending}
              onClick={() => setConfirmOpen(true)}
            >
              确认方案
            </Button>
            <Button
              disabled={!reportId && decision.status !== 'COMPLETED'}
              onClick={() =>
                navigate(
                  reportId
                    ? `/reports/${reportId}`
                    : `/reports/r_${decision.id}`,
                )
              }
            >
              查看报告
            </Button>
          </Space>
        }
      />

      {decision.hasPendingResult && decision.status === 'COMPLETED' ? (
        <Alert
          type="warning"
          showIcon
          banner
          message="有新局部推演结果待确认"
          description="旧正式报告仍然有效。请确认新结果后再覆盖正式结论。"
          style={{ marginBottom: 0 }}
        />
      ) : null}

      <div className="workbench__body">
        <DecisionCanvasPanel
          key={id}
          viewModel={viewModel}
          onDirtyChange={(dirty) => {
            console.log('[WorkbenchPage] onDirtyChange called, dirty:', dirty, 'hasUserEdited:', hasUserEdited.current)
            if (hasUserEdited.current) setIsDirty(dirty)
          }}
          onCanvasChange={(canvasData) => {
            handleCanvasChange(canvasData)
          }}
          onWeightSave={(canvasData) => {
            handleWeightSave(canvasData)
          }}
          decisionId={decision.id}
          taskId={streamTaskId}
          pendingResultId={pendingResultId}
          hasPendingResult={decision.hasPendingResult}
          decisionStatus={decision.status}
          onRequestRefresh={refreshDecision}
          partialAnalysisInfo={partialAnalysisInfo}
          partialSteps={steps}
        />

        {!rightCollapsed ? (
          <>
            <ResizeHandle
              edge="west"
              value={rightWidth}
              onChange={setRightWidth}
              min={LAYOUT_LIMITS.rightMin}
              max={rightDragMax}
              title="拖动调整右侧栏宽度（双击收起）"
              onDoubleClick={() => setRightCollapsed(true)}
            />
            <div
              className="workbench__right"
              style={{ width: rightWidth, flex: `0 0 ${rightWidth}px` }}
            >
              <AnalysisChatPanel
                userMessage={decision.title}
                steps={steps}
                toolCalls={toolCalls}
                connectionStatus={connectionStatus}
                options={displayOptions}
                recommendation={displayRecommendation}
                analysisResultId={displayAnalysisResultId}
                selectedOptionId={selectedOptionId}
                retryable={retryable}
                failedStepId={failedStepId}
                decisionStatus={decision.status}
                isHistory={decision.status === 'COMPLETED' || decision.status === 'WAITING_CONFIRM'}
                onAllStepsCompleted={() => setAnimCompleted(true)}
                onRetryStep={(stepId) => retryMutation.mutate(stepId)}
              />
            </div>
          </>
        ) : null}
      </div>

      <ConfirmResultModal
        open={confirmOpen}
        loading={confirmMutation.isPending}
        result={resultQuery.data ?? null}
        preferredOptionId={decision.preferredOptionId}
        onCancel={handleConfirmCancel}
        onConfirm={(selectedOptionId) =>
          confirmMutation.mutate(selectedOptionId)
        }
      />

      <Modal
        title="画布有未保存的修改"
        open={blocker.state === 'blocked'}
        onCancel={handleLeaveCancel}
        footer={[
          <Button key="cancel" onClick={handleLeaveCancel}>
            取消
          </Button>,
          <Button key="discard" onClick={handleLeaveDiscard}>
            不保存
          </Button>,
          <Button
            key="save"
            type="primary"
            loading={saveMutation.isPending}
            onClick={handleLeaveSave}
          >
            保存
          </Button>,
        ]}
      >
        <p>您对画布的修改尚未保存，是否现在保存？</p>
      </Modal>
    </div>
  )
}
