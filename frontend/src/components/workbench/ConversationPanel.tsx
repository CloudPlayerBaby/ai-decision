import {
  Alert,
  Collapse,
  Input,
  Progress,
  Space,
  Tag,
  Typography,
} from 'antd'
import {
  CheckCircleFilled,
  LoadingOutlined,
  UserOutlined,
  RobotOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { getAnalysisTask } from '@/services/analysis.service'
import { queryKeys } from '@/services/queryKeys'
import type { WorkbenchSlotProps } from '@/components/workbench/workbenchContracts'
import type { StepStatus } from '@/types/analysis'

const { Text, Paragraph } = Typography
const { TextArea } = Input

interface StepItem {
  id: string
  displayName: string
  status: StepStatus
  summary: string
  content: string
  toolSummary?: string
}

function statusTag(status: StepStatus) {
  switch (status) {
    case 'SUCCEEDED':
      return (
        <Tag color="success" icon={<CheckCircleFilled />}>
          已完成
        </Tag>
      )
    case 'RUNNING':
      return (
        <Tag color="processing" icon={<LoadingOutlined />}>
          进行中
        </Tag>
      )
    case 'FAILED':
      return <Tag color="error">失败</Tag>
    default:
      return <Tag>等待中</Tag>
  }
}

/**
 * 右侧推演台挂载点（B 组替换 SSE / 事件消费）。
 * C 先用 REST 任务快照恢复步骤，避免刷新从 0% 重演。
 */
export function ConversationPanel({
  decisionId,
  taskId,
  pendingResultId,
  hasPendingResult,
  decisionStatus,
}: WorkbenchSlotProps) {
  const taskQuery = useQuery({
    queryKey: queryKeys.analysisTasks.detail(taskId ?? 'none'),
    queryFn: () => getAnalysisTask(taskId!),
    enabled: Boolean(taskId),
  })

  const steps: StepItem[] =
    taskQuery.data?.steps.map((step) => ({
      id: step.id,
      displayName: step.displayName,
      status: step.status,
      summary: step.summary ?? '',
      content: step.content ?? '',
    })) ?? []

  const progress = taskQuery.data?.progress ?? 0
  const isPartial = decisionStatus === 'PARTIAL_ANALYZING'

  return (
    <aside className="conversation-panel">
      <div className="conversation-panel__header">
        <Text strong>推演对话</Text>
        <Space size={4}>
          {taskId ? <Tag color="blue">任务已恢复</Tag> : <Tag>待开始</Tag>}
          <Tag>B：SSE Ticket</Tag>
        </Space>
      </div>

      <div className="conversation-panel__body">
        <div className="chat-bubble chat-bubble--user">
          <div className="chat-bubble__meta">
            <UserOutlined />
            <Text type="secondary">决策 {decisionId}</Text>
          </div>
          <Paragraph style={{ marginBottom: 0 }}>
            {taskId
              ? `已关联任务 ${taskId}。刷新后先 GET 任务详情恢复步骤，再由 B 组取 SSE Ticket 连接。`
              : '尚未发起推演。点击顶部「开始推演」后，右侧将展示步骤日志。'}
          </Paragraph>
        </div>

        <div className="chat-bubble chat-bubble--ai">
          <div className="chat-bubble__meta">
            <RobotOutlined />
            <Text type="secondary">决策助手</Text>
          </div>
          <Paragraph style={{ marginBottom: 12 }}>
            展示步骤日志与工具摘要，不展示模型内部推理。同 stepId 的 content
            以最新全文覆盖。
          </Paragraph>

          {taskQuery.isLoading ? (
            <Text type="secondary">正在恢复任务步骤…</Text>
          ) : null}

          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            {steps.map((step) => (
              <div key={step.id} className="step-card">
                <div className="step-card__head">
                  <Text strong>{step.displayName}</Text>
                  {statusTag(step.status)}
                </div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {step.summary}
                </Text>
                <Collapse
                  ghost
                  size="small"
                  items={[
                    {
                      key: 'content',
                      label: '展开详细内容',
                      children: (
                        <Paragraph
                          style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}
                        >
                          {step.content || '暂无内容'}
                        </Paragraph>
                      ),
                    },
                  ]}
                />
              </div>
            ))}
          </Space>

          {!taskId ? (
            <Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
              B 组接入后：POST sse-ticket → EventSource(sseUrl)；断线显示「连接恢复中」。
            </Paragraph>
          ) : null}
        </div>

        {hasPendingResult ? (
          <Alert
            type="warning"
            showIcon
            message="有新结果待确认"
            description={`pendingResultId=${pendingResultId ?? '—'}，确认时必须携带该 analysisResultId。`}
            style={{ marginTop: 12 }}
          />
        ) : null}

        {isPartial || (taskQuery.data && taskQuery.data.status === 'RUNNING') ? (
          <div className="partial-status">
            <div className="partial-status__title">
              <LoadingOutlined />
              <Text strong>{isPartial ? '局部推演中' : '整轮推演中'}</Text>
              <Tag color="orange">{decisionStatus}</Tag>
            </div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              进度来自 REST 任务快照 · SSE 实时更新由 B 组接管
            </Text>
            <Progress percent={progress} size="small" status="active" />
          </div>
        ) : null}
      </div>

      <div className="conversation-panel__footer">
        <TextArea
          rows={2}
          disabled
          placeholder="对话输入由 B 组接入（当前仅展示步骤日志）"
        />
      </div>
    </aside>
  )
}
