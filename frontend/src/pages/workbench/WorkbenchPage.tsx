import {
  Alert,
  Button,
  Modal,
  Result,
  Space,
  Spin,
  Tag,
  Tooltip,
  Typography,
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
} from '@/services/analysis.service'
import { getCanvas, saveCanvas } from '@/services/canvas.service'
import { buildCanvasViewModel } from '@/utils/canvasMapper'
import { readCanvasCache, writeCanvasCache, clearCanvasCache } from '@/utils/canvasCache'
import { buildServerVersion } from '@/utils/canvasCache'
import { queryKeys } from '@/services/queryKeys'
import { ApiError, BusinessCode } from '@/types/api'
import { isMockEnabled } from '@/services/config'

const { Text } = Typography

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

  const { steps, connectionStatus, toolCalls, retryable, failedStepId } = useAnalysisStream({
    taskId,
    onResultReady: async (event) => {
      setActiveResultId(event.analysisResultId)
      await queryClient.invalidateQueries({
        queryKey: queryKeys.decisions.detail(id),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.decisions.analysisResult(id, event.analysisResultId),
      });
      // 失效 canvas 查询，使画布能显示后端返回的新节点和边
      await queryClient.invalidateQueries({
        queryKey: queryKeys.decisions.canvas(id),
      });
    },
    onTaskFailed: (event) => {
      if (event.retryable) {
        message.warning(`推演失败: ${event.message}`);
      } else {
        message.error(`推演失败: ${event.message}`);
      }
    },
  });

  useEffect(() => {
    setAnimCompleted(false);
    setActiveResultId(null);
  }, [taskId]);

  const resultQuery = useQuery({
    queryKey: queryKeys.decisions.analysisResult(id, effectiveResultId),
    queryFn: () => getAnalysisResult(id, effectiveResultId),
    enabled:
      Boolean(id) &&
      Boolean(
        decision?.status === 'WAITING_CONFIRM' ||
        decision?.status === 'COMPLETED' ||
        decision?.hasPendingResult ||
        effectiveResultId,
      ),
  })

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

  const confirmMutation = useMutation({
    mutationFn: (selectedOptionId: string) => {
      const analysisResultId =
        resultQuery.data?.id ?? pendingResultId ?? ''
      return confirmAnalysis(id, {
        analysisResultId,
        selectedOptionId,
      })
    },
    onSuccess: async (data) => {
      message.success('已确认方案并生成报告')
      setConfirmOpen(false)
      await queryClient.invalidateQueries({ queryKey: queryKeys.decisions.all })
      await refreshDecision()
      navigate(`/reports/${data.reportId}`)
    },
  })

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
  useEffect(() => {
    if (!canvasQuery.data) return
    if (idRef.current !== id) return
    // 数据更新时间早于 id 切换时间 → 旧决策的缓存数据，丢弃
    if (canvasQuery.dataUpdatedAt < idSwitchTimeRef.current) return
    // 追踪后端 version，供 handleCanvasChange 写入 sessionStorage 使用
    serverVersionRef.current = buildServerVersion(canvasQuery.data)
    setActiveCanvas((prev) => {
      // 如果已有本地数据（刷新恢复的），保留；否则用后端数据
      return prev ?? canvasQuery.data
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
    onSuccess: () => {
      message.success('画布已保存')
      queryClient.invalidateQueries({ queryKey: queryKeys.decisions.canvas(id) })
      setIsDirty(false)
      setActiveCanvas(undefined) // 触发重新从后端加载
      clearCanvasCache(id) // 清除旧缓存，刷新时走后端
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
        breadcrumb={[
          { title: <Link to="/decisions">决策记录</Link> },
          { title: decision.title },
        ]}
        title={decision.title}
        status={
          <DecisionStatusTag
            status={decision.status}
            hasPendingResult={decision.hasPendingResult}
          />
        }
        description={
          <div className="workbench__meta">
            <Text type="secondary" style={{ fontSize: 12 }}>
              ID: {decision.id}
            </Text>
            {taskId ? (
              <Text type="secondary" style={{ fontSize: 12 }}>
                任务: {taskId}
              </Text>
            ) : null}
            {pendingResultId ? (
              <Text type="secondary" style={{ fontSize: 12 }}>
                待确认草案: {pendingResultId}
              </Text>
            ) : null}
            {isMockEnabled() ? <Tag>Mock</Tag> : null}
          </div>
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
              disabled={!isDirty}
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
          description={`旧正式报告仍然有效。请确认草案 ${pendingResultId ?? ''} 后再覆盖正式结论。`}
          style={{ marginBottom: 0 }}
        />
      ) : null}

      <div className="workbench__body">
        <DecisionCanvasPanel
          key={id}
          viewModel={viewModel}
          onDirtyChange={(dirty) => {
            console.log('[WorkbenchPage] onDirtyChange called, dirty:', dirty, 'hasUserEdited:', hasUserEdited.current)
            // 只有用户实际修改过画布后，才接受子组件的 dirty 通知
            if (hasUserEdited.current) setIsDirty(dirty)
          }}
          onCanvasChange={(canvasData) => {
            handleCanvasChange(canvasData)
          }}
          decisionId={decision.id}
          taskId={taskId}
          pendingResultId={pendingResultId}
          hasPendingResult={decision.hasPendingResult}
          decisionStatus={decision.status}
          onRequestRefresh={refreshDecision}
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
        onCancel={() => setConfirmOpen(false)}
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
