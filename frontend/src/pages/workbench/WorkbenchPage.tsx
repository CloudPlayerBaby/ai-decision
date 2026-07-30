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
import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { DecisionCanvasPanel } from '@/components/workbench/DecisionCanvasPanel'
import { AnalysisChatPanel } from '@/features/analysis/AnalysisChatPanel'
import { mockSteps, mockToolCalls, mockOptions, mockResult } from '@/mocks/analysis.mock'
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

  const rightCollapsed = useLayoutStore((state) => state.rightCollapsed)
  const rightWidth = useLayoutStore((state) => state.rightWidth)
  const setRightCollapsed = useLayoutStore((state) => state.setRightCollapsed)
  const setRightWidth = useLayoutStore((state) => state.setRightWidth)

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
  const reportId = detailQuery.data?.reportId ?? null
  const taskId = decision?.latestTaskId ?? null

  const resultQuery = useQuery({
    queryKey: queryKeys.decisions.analysisResult(id, pendingResultId),
    queryFn: () => getAnalysisResult(id, pendingResultId),
    enabled:
      Boolean(id) &&
      Boolean(
        decision?.status === 'WAITING_CONFIRM' ||
          decision?.hasPendingResult ||
          pendingResultId,
      ),
  })

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
        <Spin size="large" tip="加载决策详情…" />
      </div>
    )
  }

  const canStartAnalysis =
    decision.status === 'PENDING' ||
    decision.status === 'WAITING_CONFIRM' ||
    decision.status === 'COMPLETED' ||
    decision.status === 'FAILED'

  const analyzing =
    decision.status === 'ANALYZING' ||
    decision.status === 'PARTIAL_ANALYZING'

  const canConfirm =
    decision.status === 'WAITING_CONFIRM' ||
    Boolean(decision.hasPendingResult)

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
          <Space size="middle" wrap>
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
          </Space>
        }
        extra={
          <Space wrap>
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
              {analyzing ? '推演中…' : '开始推演'}
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
              max={LAYOUT_LIMITS.rightMax}
              title="拖动调整右侧栏宽度（双击收起）"
              onDoubleClick={() => setRightCollapsed(true)}
            />
            <div
              className="workbench__right"
              style={{ width: rightWidth, flex: `0 0 ${rightWidth}px` }}
            >
              <AnalysisChatPanel
                userMessage={decision.title}
                steps={mockSteps}
                toolCalls={mockToolCalls}
                analysisCompleted={false}
                options={mockOptions}
                recommendation={mockResult.recommendation}
                analysisResultId={mockResult.id}
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
