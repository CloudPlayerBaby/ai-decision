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
import { useState, useEffect, useRef, useCallback } from 'react'
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
import { buildCanvasViewModel, toFlowNodes } from '@/utils/canvasMapper'
import { applyDagreLayout } from '@/utils/canvasLayout'
import { readCanvasCache, writeCanvasCache, clearCanvasCache } from '@/utils/canvasCache'
import { buildServerVersion } from '@/utils/canvasCache'
import { queryKeys } from '@/services/queryKeys'
import { ApiError, BusinessCode } from '@/types/api'
import type { Canvas } from '@/types/canvas'
import { isMockEnabled } from '@/services/config'

function cloneCanvas(canvas: Canvas): Canvas {
  return structuredClone(canvas)
}

// const { Text } = Typography

function buildPartialChangedNodeIds(
  changedNodeIds: string[] | undefined,//后端传递的更改的id
  canvas?: import('@/types/canvas').Canvas,
) {//收集「业务节点」白名单
  const businessNodeIds = new Set(
    canvas?.nodes
      .filter((node) => node.type === 'factor' || node.type === 'option')
      .map((node) => node.id) ?? [],
  )
  // 解决页面加载时是空白的问题
  return [...new Set(changedNodeIds ?? [])].filter((nodeId) => {
    if (!nodeId || nodeId === 'root') return false//可能传递的是空的需要进行过滤
    return businessNodeIds.size === 0 || businessNodeIds.has(nodeId)
  })
}

//  d35085cecfd5fcd42b2c3cc8603d865ec8fb93fa
/**
 * 推演工作台：中间画布(A) + 右侧推演对话(B)。
 * C 负责详情恢复、开始推演、确认方案、状态标签与三栏挂载契约。
 */
export function WorkbenchPage() {
  const { id = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()//编程式跳转
  const queryClient = useQueryClient()//保存、推演完成后 刷新缓存
  const [confirmOpen, setConfirmOpen] = useState(false)//确认方案弹窗
  const [animCompleted, setAnimCompleted] = useState(false)// 推演动画是否结束
  const [activeResultId, setActiveResultId] = useState<string | null>(null)//当前展示的分析结果 id

  // ── 局部推演状态 ──────────────────────────────────────────
  /** 同步锁：防止重复发起局部重推请求 */
  //useRef current: true:上锁 false:解锁,同步、立即
  //局部重推锁用 ref，是因为要同步拦截连点，setState 有延迟挡不住。
  const partialAnalysisLockRef = useRef(false)
  /** 局部重推锁对应的决策 id，避免 A 推演中误锁 B 页面 */
  const partialAnalysisLockDecisionRef = useRef<string | null>(null)
  /** 保存成功后，后端返回的 changedNodeIds；局部重推成功后保留，失败后允许重试 */
  const [pendingChangedNodeIds, setPendingChangedNodeIds] = useState<string[]>([])
  void pendingChangedNodeIds // 保留 setter 供其他功能使用
  /** 局部推演任务（含 decisionId，切换决策页时按 id 过滤） */
  const [partialAnalysisInfo, setPartialAnalysisInfo] = useState<{
    decisionId: string
    taskId: string
    affectedNodeIds: string[]
    status: 'RUNNING'
  } | null>(null)
  /** 当前路由正在查看的决策 id，供 SSE 回调判断是否在后台完成 */
  const viewingDecisionIdRef = useRef(id)
  const partialAnalysisInfoRef = useRef(partialAnalysisInfo)
  partialAnalysisInfoRef.current = partialAnalysisInfo
  const pendingChangedNodeIdsRef = useRef(pendingChangedNodeIds)
  pendingChangedNodeIdsRef.current = pendingChangedNodeIds
  const routeDecisionIdRef = useRef(id)
  /** 切换走时中断的局部推演（回到该决策时不自动重连 SSE，并回滚画布） */
  const [interruptedPartialByDecision, setInterruptedPartialByDecision] = useState<
    Record<
      string,
      {
        taskId: string
        affectedNodeIds: string[]
        changedNodeIds: string[]
        /** 发起局部推演前的画布（用于中断后回滚展示） */
        baselineCanvas: Canvas | null
        /** 触发局部推演的修改后画布（用于「重试」时重新保存并推演） */
        attemptedCanvas: Canvas | null
      }
    >
  >({})
  /** 局部推演发起前：后端已确认的画布快照 */
  const partialBaselineCanvasRef = useRef<Map<string, Canvas>>(new Map())
  /** 局部推演发起前：用户修改后、即将保存的画布 */
  const partialAttemptedCanvasRef = useRef<Map<string, Canvas>>(new Map())
  /** 正在把中断决策的画布回写后端，避免 canvas effect 用旧数据覆盖 */
  const restoringInterruptedCanvasRef = useRef<string | null>(null)
  /** 已完成回滚的决策 id，防止重复 PUT */
  const revertedInterruptedCanvasRef = useRef<Set<string>>(new Set())

  const capturePartialCanvasSnapshot = useCallback(
    (decisionId: string, attemptedCanvas: Canvas) => {
      const serverCanvas = queryClient.getQueryData<Canvas>(
        queryKeys.decisions.canvas(decisionId),
      )
      if (serverCanvas) {
        partialBaselineCanvasRef.current.set(decisionId, cloneCanvas(serverCanvas))
      }
      partialAttemptedCanvasRef.current.set(decisionId, attemptedCanvas)
    },
    [queryClient],
  )

  const clearPartialCanvasSnapshot = useCallback((decisionId: string) => {
    partialBaselineCanvasRef.current.delete(decisionId)
    partialAttemptedCanvasRef.current.delete(decisionId)
  }, [])
  /** 是否有待应用的结构变更（新增节点/连线） */
  const [hasPendingStructuralChange, setHasPendingStructuralChange] = useState(false)
  /** 强制同步标识：用于局部推演完成后强制刷新画布 */
  const [forceSyncKey, setForceSyncKey] = useState<string | null>(null)

  // ── 统一局部重推请求入口 ──────────────────────────────────
  /**
   * 唯一入口：所有触发局部重推的地方必须走此函数。
   * - changedNodeIds 为空时不发请求
   * - 锁或 partialAnalysisInfo 非空时拒绝请求并提示
   * - 成功后设置锁；失败/409 时释放锁
   */

  const requestPartialAnalysis = useCallback(
    (changedNodeIds: string[]) => {
      if (changedNodeIds.length === 0) {
        message.info('画布已保存，无需重新推演')
        return
      }
      const partialRunningOnCurrentDecision =
        partialAnalysisInfo !== null && partialAnalysisInfo.decisionId === id
      const lockHeldOnCurrentDecision =
        partialAnalysisLockRef.current &&
        partialAnalysisLockDecisionRef.current === id
      if (lockHeldOnCurrentDecision || partialRunningOnCurrentDecision) {
        message.warning('当前局部推演正在进行，请等待完成')
        return
      }
      partialAnalysisLockRef.current = true
      partialAnalysisLockDecisionRef.current = id
      startPartialAnalysisMutation.mutate(changedNodeIds)
    },
    [partialAnalysisInfo, id],
  )

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

  /** 仅当前决策页生效的局部推演信息（切换决策时不串用其他决策的 task） */
  const currentPartialInfo =
    partialAnalysisInfo?.decisionId === id ? partialAnalysisInfo : null

  const interruptedPartial = interruptedPartialByDecision[id] ?? null

  // ── SSE taskId 逻辑 ────────────────────────────────────────
  /** 局部推演期间的 taskId；切换走中断时不连 SSE，否则用 latestTaskId */
  const streamTaskId = interruptedPartial
    ? null
    : currentPartialInfo?.taskId ?? taskId

  const releasePartialAnalysisLock = useCallback((decisionId: string) => {
    if (partialAnalysisLockDecisionRef.current === decisionId) {
      partialAnalysisLockRef.current = false
      partialAnalysisLockDecisionRef.current = null
    }
  }, [])

  const { steps, connectionStatus, toolCalls, retryable, failedStepId, stepGroups } = useAnalysisStream({
    taskId: streamTaskId,
    decisionId: id,
    runType: partialAnalysisInfo ? 'PARTIAL' : 'FULL',
    onResultReady: async (event) => {
      setPartialAnalysisInfo((prev) =>
        prev?.decisionId === event.decisionId ? null : prev,
      )
      setInterruptedPartialByDecision((prev) => {
        if (!prev[event.decisionId]) return prev
        const next = { ...prev }
        delete next[event.decisionId]
        return next
      })
      clearPartialCanvasSnapshot(event.decisionId)
      revertedInterruptedCanvasRef.current.delete(event.decisionId)
      releasePartialAnalysisLock(event.decisionId)
      setPendingChangedNodeIds((prev) =>
        viewingDecisionIdRef.current === event.decisionId ? [] : prev,
      )

      await queryClient.invalidateQueries({
        queryKey: queryKeys.decisions.detail(event.decisionId),
      })
      await queryClient.invalidateQueries({
        queryKey: queryKeys.decisions.analysisResult(
          event.decisionId,
          event.analysisResultId,
        ),
      })
      await queryClient.invalidateQueries({
        queryKey: queryKeys.decisions.canvas(event.decisionId),
      })

      // 仅当用户正在查看该决策页时更新本地 UI
      if (viewingDecisionIdRef.current !== event.decisionId) return

      setActiveResultId(event.analysisResultId)
      setActiveCanvas(undefined)
      setForceSyncKey(event.analysisResultId)
    },
    onTaskFailed: (event) => {
      let failedDecisionId: string | null = null
      setPartialAnalysisInfo((prev) => {
        if (!prev) return prev
        if (event.taskId && prev.taskId !== event.taskId) return prev
        failedDecisionId = prev.decisionId
        return null
      })
      if (!failedDecisionId) return

      releasePartialAnalysisLock(failedDecisionId)
      if (viewingDecisionIdRef.current === failedDecisionId) {
        if (event.retryable) {
          message.warning(`局部推演失败: ${event.message}`)
        } else {
          message.error(`局部推演失败: ${event.message}`)
        }
      }
    },
  })

  useEffect(() => {
    viewingDecisionIdRef.current = id
  }, [id])

  /** 离开决策页时：若局部推演进行中，标记为「连接已断开」并主动放弃 SSE */
  useEffect(() => {
    const prevId = routeDecisionIdRef.current
    if (prevId !== id) {
      const info = partialAnalysisInfoRef.current
      if (info?.decisionId === prevId) {
        setInterruptedPartialByDecision((map) => ({
          ...map,
          [prevId]: {
            taskId: info.taskId,
            affectedNodeIds: info.affectedNodeIds,
            changedNodeIds: [...pendingChangedNodeIdsRef.current],
            baselineCanvas:
              partialBaselineCanvasRef.current.get(prevId) ?? null,
            attemptedCanvas:
              partialAttemptedCanvasRef.current.get(prevId) ?? null,
          },
        }))
        setPartialAnalysisInfo(null)
        releasePartialAnalysisLock(prevId)
      }
      routeDecisionIdRef.current = id
    }
  }, [id, releasePartialAnalysisLock])

  useEffect(() => {
    setAnimCompleted(false)
    setActiveResultId(null)
  }, [id, taskId])

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
    undefined,
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

  useEffect(() => {
    if (!canvasQuery.data) return
    if (idRef.current !== id) return
    if (restoringInterruptedCanvasRef.current === id) return
    // 数据更新时间早于 id 切换时间 → 旧决策的缓存数据，丢弃
    if (canvasQuery.dataUpdatedAt < idSwitchTimeRef.current) {
      console.log('[WorkbenchPage] canvas effect: data is stale, skipping')
      return
    }

    const newVersion = buildServerVersion(canvasQuery.data)
    const isDataUpdated = canvasQuery.dataUpdatedAt !== lastDataUpdatedAt.current
    console.log('[WorkbenchPage] canvas effect: newVersion=', newVersion, 'lastVersion=', lastBackendVersion.current, 'dataUpdated=', isDataUpdated, 'hasLocalEdit=', hasLocalEdit.current)

    // 追踪后端 version
    serverVersionRef.current = newVersion

    setActiveCanvas((prev) => {
      // 如果没有本地数据（页面切换后首次加载），直接用后端数据
      if (!prev) {
        if (interruptedPartial?.baselineCanvas) {
          return prev
        }
        console.log('[WorkbenchPage] no local data, using backend data')
        lastBackendVersion.current = newVersion
        lastDataUpdatedAt.current = canvasQuery.dataUpdatedAt
        return canvasQuery.data
      }

      // 有本地数据时，比较版本
      // 推演完成后版本会增加，如果版本更新且没有本地编辑，用后端数据
      if (isDataUpdated && newVersion !== lastBackendVersion.current) {
        // 后端数据更新了
        if (!hasLocalEdit.current) {
          console.log('[WorkbenchPage] backend updated, syncing')
          lastBackendVersion.current = newVersion
          lastDataUpdatedAt.current = canvasQuery.dataUpdatedAt
          return canvasQuery.data
        } else {
          console.log('[WorkbenchPage] backend updated but has local edits, keeping local')
          lastBackendVersion.current = newVersion
          lastDataUpdatedAt.current = canvasQuery.dataUpdatedAt
        }
      }

      return prev
    })
  }, [canvasQuery.data, canvasQuery.dataUpdatedAt, id, interruptedPartial?.baselineCanvas])

  const canvasForView = activeCanvas ?? canvasQuery.data
  const viewModel =
    canvasForView && decision
      ? buildCanvasViewModel(decision, canvasForView, resultQuery.data ?? undefined)
      : undefined

  // isDirty 初始为 false，等 canvasQuery 数据回来后对比缓存和服务器内容再决定
  const [isDirty, setIsDirty] = useState(false)
  // 追踪用户是否已实际修改过画布（区分初始化和用户操作）
  const hasUserEdited = useRef(false)
  // 保存按钮回调时引用最新 canvas 数据（需要在使用前声明）
  const canvasRef = useRef<import('@/types/canvas').Canvas | null>(null)
  // 等 canvasQuery 数据回来后，对比缓存和服务器内容决定初始 isDirty（仅执行一次）
  const didEvaluateCache = useRef(false)
  useEffect(() => {
    if (!canvasQuery.data) return
    if (didEvaluateCache.current) return
    didEvaluateCache.current = true
    const cached = readCanvasCache(id)
    console.log('[WorkbenchPage] evaluateCache: cached=', cached ? 'exists' : 'null', 'canvasQuery.data=', canvasQuery.data ? 'exists' : 'null')
    if (cached && canvasQuery.data) {
      const serverVersion = buildServerVersion(canvasQuery.data)
      // 同时检查 serverVersion 和 canvas 内容是否变化
      const isVersionDirty = serverVersion !== cached.serverVersion
      // 比较 canvas 内容（nodes/edges 的位置等）
      const isContentDirty = JSON.stringify(canvasQuery.data) !== JSON.stringify(cached.canvas)
      const isDirty = isVersionDirty || isContentDirty
      console.log('[WorkbenchPage] evaluateCache: serverVersion=', serverVersion, 'cachedServerVersion=', cached.serverVersion, 'versionDirty=', isVersionDirty, 'contentDirty=', isContentDirty, 'isDirty=', isDirty)
      setIsDirty(isDirty)
      hasUserEdited.current = isDirty
      // 初始化 canvasRef，以便刷新后立即可以保存
      canvasRef.current = cached.canvas
    } else if (canvasQuery.data) {
      // 没有缓存但有后端数据，也初始化 canvasRef
      canvasRef.current = canvasQuery.data
    }
  }, [canvasQuery.data, id])

  // WorkbenchPage 在 /workbench/:id 间切换时不卸载，isDirty / hasUserEdited 会跨决策残留
  useEffect(() => {
    setIsDirty(false)
    hasUserEdited.current = false
    didEvaluateCache.current = false
    hasLocalEdit.current = false
  }, [id])

  const revertInterruptedCanvasMutation = useMutation({
    mutationFn: ({ decisionId, canvas }: { decisionId: string; canvas: Canvas }) =>
      saveCanvas(decisionId, canvas),
    onSuccess: (_data, { decisionId }) => {
      restoringInterruptedCanvasRef.current = null
      queryClient.invalidateQueries({
        queryKey: queryKeys.decisions.canvas(decisionId),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.decisions.detail(decisionId),
      })
    },
    onError: (_error, { decisionId }) => {
      restoringInterruptedCanvasRef.current = null
      revertedInterruptedCanvasRef.current.delete(decisionId)
      message.error('画布回滚失败，请刷新页面后重试')
    },
  })

  /** 回到「连接已断开」的决策页时，恢复局部推演前的画布并同步后端 */
  useEffect(() => {
    const interrupted = interruptedPartialByDecision[id]
    if (!interrupted?.baselineCanvas) return
    if (revertedInterruptedCanvasRef.current.has(id)) return

    revertedInterruptedCanvasRef.current.add(id)
    restoringInterruptedCanvasRef.current = id
    clearCanvasCache(id)
    setActiveCanvas(interrupted.baselineCanvas)
    canvasRef.current = interrupted.baselineCanvas
    setIsDirty(false)
    hasUserEdited.current = false
    hasLocalEdit.current = false
    setPendingChangedNodeIds([])
    lastBackendVersion.current = buildServerVersion(interrupted.baselineCanvas)
    lastDataUpdatedAt.current = Date.now()

    revertInterruptedCanvasMutation.mutate({
      decisionId: id,
      canvas: interrupted.baselineCanvas,
    })
  }, [id, interruptedPartialByDecision])

  // ── 布局转换函数：检测 TB 布局 → LR 布局 → 保存到后端 ──
  const fixLayoutMutation = useMutation({
    mutationFn: (canvas: import('@/types/canvas').Canvas) =>
      saveCanvas(id, canvas),
    onSuccess: () => {
      console.log('[WorkbenchPage] LR 布局已保存到后端')
      queryClient.invalidateQueries({ queryKey: queryKeys.decisions.canvas(id) })
      setIsDirty(false)
      hasUserEdited.current = false
      clearCanvasCache(id)
    },
    onError: (error) => {
      console.error('[WorkbenchPage] 布局保存失败:', error)
    },
  })

  const fixAndSaveLayout = useCallback((canvas: import('@/types/canvas').Canvas) => {
    if (!canvas.nodes || canvas.nodes.length === 0) return
    const decisionNode = canvas.nodes.find((n) => n.type === 'decision')
    const factorNodes = canvas.nodes.filter((n) => n.type === 'factor')
    if (!decisionNode || factorNodes.length === 0) return
    const decisionX = decisionNode.position?.x ?? 0
    const decisionY = decisionNode.position?.y ?? 0
    const avgFactorY = factorNodes.reduce((sum, n) => sum + (n.position?.y ?? 0), 0) / factorNodes.length
    // 判断条件：decision.x 小于所有 factor.x，且 y 坐标接近 → 可能是 LR
    const allFactorX = factorNodes.map((n) => n.position?.x ?? 0)
    const isLRLayout =
      decisionX < Math.min(...allFactorX) + 50 &&
      Math.abs(decisionY - avgFactorY) < 100
    // 如果已经是 LR 布局，跳过
    if (isLRLayout) {
      console.log('[WorkbenchPage] 当前已是 LR 布局，跳过布局修复')
      return
    }
    console.log('[WorkbenchPage] 检测到 TB 布局，开始转换为 LR 布局...')
    // 转换为 FlowNode，应用 dagre LR 布局
    const flowNodes = toFlowNodes(canvas.nodes, {})
    const flowEdges = canvas.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      relation: e.relation ?? '',
    }))
    const { nodes: layoutedNodes } = applyDagreLayout(flowNodes, flowEdges, {
      direction: 'LR',
      rankSeparation: 250,
      nodeSeparation: 80,
    })
    // 构建新的 canvas 数据
    const newNodes: import('@/types/canvas').CanvasNode[] = layoutedNodes.map((n) => {
      const base = {
        id: n.id,
        type: n.type as import('@/types/canvas').CanvasNode['type'],
        label: (n.data as { label?: string }).label ?? '',
        position: n.position,
      }
      if (n.type === 'factor') {
        return { ...base, data: { weight: (n.data as { weight: number }).weight ?? 0.1 } } as import('@/types/canvas').FactorCanvasNode
      }
      if (n.type === 'option') {
        return { ...base, data: { scores: (n.data as { scores: import('@/types/canvas').OptionScores }).scores ?? { cost: 3, time: 3, benefit: 3, risk: 3, feasibility: 3 } } } as import('@/types/canvas').OptionCanvasNode
      }
      return { ...base, data: {} } as import('@/types/canvas').DecisionCanvasNode
    })
    const newCanvas: import('@/types/canvas').Canvas = {
      nodes: newNodes,
      edges: canvas.edges,
    }
    fixLayoutMutation.mutate(newCanvas)
  }, [fixLayoutMutation])
  // ── 初始布局检测：如果是 TB 布局，自动转换为 LR 布局并保存 ──
  const didFixLayoutOnLoadRef = useRef(false)
  const didFixLayoutOnAnalysisRef = useRef(false)
  useEffect(() => {
    didFixLayoutOnLoadRef.current = false
    didFixLayoutOnAnalysisRef.current = false
  }, [id])
  useEffect(() => {
    if (!canvasQuery.data) return
    if (didFixLayoutOnLoadRef.current) return
    // 避免页面切换时误触发（只检查来自后端的首次数据）
    if (canvasQuery.dataUpdatedAt < idSwitchTimeRef.current) return
    didFixLayoutOnLoadRef.current = true
    fixAndSaveLayout(canvasQuery.data)
  }, [canvasQuery.data, canvasQuery.dataUpdatedAt, id, fixAndSaveLayout])
  // ── 推演完成时自动转换布局 ──
  useEffect(() => {
    // 只有当推演动画完成时才触发
    if (!animCompleted) return
    if (didFixLayoutOnAnalysisRef.current) return
    // 确保 canvasQuery 数据已加载
    if (!canvasQuery.data) return
    didFixLayoutOnAnalysisRef.current = true
    console.log('[WorkbenchPage] 推演完成，自动转换布局')
    fixAndSaveLayout(canvasQuery.data)
  }, [animCompleted, canvasQuery.data, fixAndSaveLayout])

  const saveMutation = useMutation({
    mutationFn: (canvas: import('@/types/canvas').Canvas) =>
      saveCanvas(id, canvas),
    onMutate: (canvas) => {
      if (hasPendingStructuralChange) {
        capturePartialCanvasSnapshot(id, canvas)
      }
    },
    onSuccess: (data) => {
      message.success('画布已保存')
      queryClient.invalidateQueries({ queryKey: queryKeys.decisions.canvas(id) })
      setIsDirty(false)
      hasUserEdited.current = false
      setActiveCanvas(undefined) // 触发重新从后端加载
      clearCanvasCache(id) // 清除旧缓存，刷新时走后端

      // 保存 changedNodeIds
      setPendingChangedNodeIds(
        buildPartialChangedNodeIds(data.changedNodeIds, data.canvas),
      )

      // 若有待应用的结构变更，通过统一入口触发局部重推
      if (hasPendingStructuralChange) {
        setHasPendingStructuralChange(false)
        const changedIds = buildPartialChangedNodeIds(data.changedNodeIds, data.canvas)
        requestPartialAnalysis(changedIds)
      }

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

  // 画布变化时：仅更新 canvasRef（dirty / 缓存由 onDirtyChange 驱动，避免程序化布局同步误标未保存）
  const handleCanvasChange = (canvas: import('@/types/canvas').Canvas) => {
    console.log('[WorkbenchPage] handleCanvasChange called')
    canvasRef.current = canvas
  }

  // 保存权重：先保存画布，成功后自动发起局部重推
  const handleWeightSave = (canvas: import('@/types/canvas').Canvas) => {
    canvasRef.current = canvas
    hasUserEdited.current = true
    // 立即用新 canvas 保存，触发局部重推
    saveForPartialMutation.mutate(canvas)
  }

  // 删除连线：保存画布（已删除边）并自动局部重推
  const handleEdgeDelete = (canvas: import('@/types/canvas').Canvas) => {
    canvasRef.current = canvas
    hasUserEdited.current = true
    saveForEdgeDeleteMutation.mutate(canvas)
  }

  // 仅保存画布（不触发局部重推）：用于新增因素等仅修改节点内容的场景
  const handleCanvasSave = (canvas: import('@/types/canvas').Canvas) => {
    canvasRef.current = canvas
    hasUserEdited.current = true
    saveMutation.mutate(canvas)
  }

  // 删除候选方案：保存画布（已删除方案节点）并自动局部重推
  const handleOptionDelete = useCallback(
    async (
      canvas: import('@/types/canvas').Canvas,
      deletedOptionId: string,
      rollback: () => void,
    ) => {
      canvasRef.current = canvas
      hasUserEdited.current = true
      try {
        await saveForOptionDeleteMutation.mutateAsync({ canvas, deletedOptionId })
      } catch (_e: unknown) { rollback(); throw new Error('save failed') }
    },
    [],
  )

  // 删除因素：保存画布（已删除因素节点及重分配权重）并自动局部重推
  const handleFactorDelete = useCallback(
    async (canvas: import('@/types/canvas').Canvas, rollback: () => void) => {
      canvasRef.current = canvas
      hasUserEdited.current = true
      try {
        await saveForFactorDeleteMutation.mutateAsync(canvas)
      } catch (_e: unknown) { rollback(); throw new Error('save failed') }
    },
    [],
  )

  // 专用 mutation：保存画布并自动触发局部重推（仅用于权重保存）
  const saveForPartialMutation = useMutation({
    mutationFn: (canvas: import('@/types/canvas').Canvas) =>
      saveCanvas(id, canvas),
    onMutate: (canvas) => {
      capturePartialCanvasSnapshot(id, canvas)
    },
    onSuccess: (data) => {
      message.success('权重已保存')
      queryClient.invalidateQueries({ queryKey: queryKeys.decisions.canvas(id) })
      setIsDirty(false)
      hasUserEdited.current = false
      setActiveCanvas(undefined)
      clearCanvasCache(id)

      const changedIds = data.changedNodeIds ?? []
      setPendingChangedNodeIds(changedIds)
      requestPartialAnalysis(changedIds)

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

  // 删除连线专用 mutation：保存画布并自动触发局部重推
  const saveForEdgeDeleteMutation = useMutation({
    mutationFn: (canvas: import('@/types/canvas').Canvas) =>
      saveCanvas(id, canvas),
    onMutate: (canvas) => {
      capturePartialCanvasSnapshot(id, canvas)
    },
    onSuccess: (data) => {
      message.success('连线已删除')
      queryClient.invalidateQueries({ queryKey: queryKeys.decisions.canvas(id) })
      setIsDirty(false)
      hasUserEdited.current = false
      setActiveCanvas(undefined)
      clearCanvasCache(id)

      const changedIds = data.changedNodeIds ?? []
      setPendingChangedNodeIds(changedIds)
      requestPartialAnalysis(changedIds)

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

  // 删除方案节点专用 mutation：保存画布并自动触发局部重推
  const saveForOptionDeleteMutation = useMutation({
    mutationFn: ({ canvas }: { canvas: import('@/types/canvas').Canvas; deletedOptionId: string }) =>
      saveCanvas(id, canvas),
    onMutate: ({ canvas }) => {
      capturePartialCanvasSnapshot(id, canvas)
    },
    onSuccess: (_data, variables) => {
      message.success('方案已删除')
      queryClient.invalidateQueries({ queryKey: queryKeys.decisions.canvas(id) })
      setIsDirty(false)
      hasUserEdited.current = false
      setActiveCanvas(undefined)
      clearCanvasCache(id)

      const changedIds = [variables.deletedOptionId]
      setPendingChangedNodeIds(changedIds)
      requestPartialAnalysis(changedIds)

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

  // 删除因素节点专用 mutation：保存画布并自动触发局部重推
  const saveForFactorDeleteMutation = useMutation({
    mutationFn: (canvas: import('@/types/canvas').Canvas) =>
      saveCanvas(id, canvas),
    onMutate: (canvas) => {
      capturePartialCanvasSnapshot(id, canvas)
    },
    onSuccess: (data) => {
      message.success('因素已删除，权重已重新分配')
      queryClient.invalidateQueries({ queryKey: queryKeys.decisions.canvas(id) })
      setIsDirty(false)
      hasUserEdited.current = false
      setActiveCanvas(undefined)
      clearCanvasCache(id)

      const changedIds = data.changedNodeIds ?? []
      setPendingChangedNodeIds(changedIds)
      requestPartialAnalysis(changedIds)

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
      retryFailedStep(streamTaskId!, stepId),
    onSuccess: async () => {
      message.success('步骤已重新入队，请等待推演更新')
      await queryClient.invalidateQueries({
        queryKey: queryKeys.analysisTasks.detail(streamTaskId!),
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
      setPartialAnalysisInfo({
        decisionId: id,
        taskId: data.taskId,
        affectedNodeIds: data.affectedNodeIds,
        status: 'RUNNING',
      })
      setInterruptedPartialByDecision((map) => {
        if (!map[id]) return map
        const next = { ...map }
        delete next[id]
        return next
      })
      // pendingChangedNodeIds 保留（失败时可重试）
      queryClient.invalidateQueries({
        queryKey: queryKeys.analysisTasks.detail(data.taskId),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.decisions.canvas(id),
      })
    },
    onError: (error) => {
      releasePartialAnalysisLock(id)
      if (error instanceof ApiError && error.code === BusinessCode.Conflict) {
        message.error('当前决策已有推演任务正在运行，请等待完成')
      } else {
        message.error('局部重推发起失败，请稍后重试')
      }
      // pendingChangedNodeIds 保留，允许重试
    },
  })

  const handleRetryInterruptedPartial = useCallback(() => {
    const interrupted = interruptedPartialByDecision[id]
    if (!interrupted) return

    revertedInterruptedCanvasRef.current.delete(id)
    restoringInterruptedCanvasRef.current = null

    setInterruptedPartialByDecision((map) => {
      const next = { ...map }
      delete next[id]
      return next
    })

    const changedNodeIds =
      interrupted.changedNodeIds.length > 0
        ? interrupted.changedNodeIds
        : interrupted.affectedNodeIds

    if (interrupted.attemptedCanvas) {
      setPendingChangedNodeIds(changedNodeIds)
      saveForPartialMutation.mutate(interrupted.attemptedCanvas)
      return
    }

    if (changedNodeIds.length === 0) {
      message.warning('缺少可重推的节点信息，请重新修改画布并保存后再试')
      return
    }

    setPendingChangedNodeIds(changedNodeIds)
    requestPartialAnalysis(changedNodeIds)
  }, [
    id,
    interruptedPartialByDecision,
    requestPartialAnalysis,
    saveForPartialMutation,
  ])

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
  const isLocalPartialAnalyzing =
    currentPartialInfo !== null && interruptedPartial === null
  const panelDecisionStatus = isLocalPartialAnalyzing
    ? 'PARTIAL_ANALYZING'
    : decision.status
  const panelIsHistory =
    !isLocalPartialAnalyzing &&
    (decision.status === 'COMPLETED' || decision.status === 'WAITING_CONFIRM')

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
              loading={saveMutation.isPending || startPartialAnalysisMutation.isPending}
              disabled={(() => {
                const disabled = !isDirty || saveMutation.isPending || saveForPartialMutation.isPending || saveForEdgeDeleteMutation.isPending || saveForOptionDeleteMutation.isPending || saveForFactorDeleteMutation.isPending || startPartialAnalysisMutation.isPending
                console.log('[save-button]', { isDirty, savePending: saveMutation.isPending, disabled })
                return disabled
              })()}
            >
              {saveMutation.isPending ? '保存中…' : '保存画布'}
            </Button>
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
          isCanvasGenerating={decision.status === 'ANALYZING' && !animCompleted}
          onDirtyChange={(dirty) => {
            console.log('[WorkbenchPage] onDirtyChange called, dirty:', dirty, 'hasUserEdited:', hasUserEdited.current)
            if (!dirty) {
              setIsDirty(false)
              hasUserEdited.current = false
              return
            }
            hasUserEdited.current = true
            setIsDirty(true)
            if (canvasRef.current) {
              writeCanvasCache(id, canvasRef.current, serverVersionRef.current)
            }
          }}
          onCanvasChange={(canvasData) => {
            handleCanvasChange(canvasData)
          }}
          onWeightSave={(canvasData) => {
            handleWeightSave(canvasData)
          }}
          onEdgeDelete={(canvasData) => {
            handleEdgeDelete(canvasData)
          }}
          onOptionDelete={async (canvasData, deletedOptionId, rollback) => {
            await handleOptionDelete(canvasData, deletedOptionId, rollback)
          }}
          onFactorDelete={async (canvasData, rollback) => {
            await handleFactorDelete(canvasData, rollback)
          }}
          onCanvasSave={handleCanvasSave}
          onStructuralChangePending={(_reason) => {
            setHasPendingStructuralChange(true)
          }}
          decisionId={decision.id}
          taskId={streamTaskId}
          pendingResultId={pendingResultId}
          hasPendingResult={decision.hasPendingResult}
          decisionStatus={decision.status}
          onRequestRefresh={refreshDecision}
          partialAnalysisInfo={currentPartialInfo}
          partialSteps={steps}
          forceSyncKey={forceSyncKey}
        />

        {hasPendingStructuralChange && (
          <Alert
            type="info"
            showIcon
            banner
            message="决策结构已变更，等待应用分析"
            description="请确认后点击下方按钮，系统将重新评估受影响方案。"
            action={
              <Button
                type="primary"
                onClick={() => {
                  if (!canvasRef.current) return
                  setActiveCanvas(undefined)
                  saveMutation.mutate(canvasRef.current)
                }}
                loading={saveMutation.isPending || startPartialAnalysisMutation.isPending}
                disabled={
                  !canvasRef.current ||
                  saveMutation.isPending ||
                  startPartialAnalysisMutation.isPending ||
                  saveForPartialMutation.isPending ||
                  saveForEdgeDeleteMutation.isPending ||
                  saveForOptionDeleteMutation.isPending ||
                  saveForFactorDeleteMutation.isPending
                }
              >
                应用结构变化并更新分析
              </Button>
            }
            style={{ margin: '8px 0' }}
          />
        )}

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
                decisionStatus={panelDecisionStatus}
                isHistory={panelIsHistory}
                stepGroups={stepGroups}
                connectionInterrupted={interruptedPartial !== null}
                onRetryInterrupted={handleRetryInterruptedPartial}
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
