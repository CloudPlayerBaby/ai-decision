import {
  Alert,
  Button,
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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
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

  const refreshDecision = async () => {
    await queryClient.invalidateQueries({
      queryKey: queryKeys.decisions.detail(id),
    })
    await queryClient.invalidateQueries({
      queryKey: queryKeys.decisions.analysisResult(id, pendingResultId),
    })
  }

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
            <Tooltip title="由 A 组接入保存画布">
              <Button disabled>保存画布</Button>
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
          description={`旧正式报告仍然有效。请确认草案 ${pendingResultId ?? ''} 后再覆盖正式结论。`}
          style={{ marginBottom: 0 }}
        />
      ) : null}

      <div className="workbench__body">
        <DecisionCanvasPanel
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
    </div>
  )
}
