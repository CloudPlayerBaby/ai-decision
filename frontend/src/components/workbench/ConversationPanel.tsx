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

const { Text, Paragraph } = Typography
const { TextArea } = Input

interface StepItem {
  id: string
  displayName: string
  status: 'WAITING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED'
  summary: string
  content: string
  toolSummary?: string
}

/** 占位步骤：演示同 stepId content 覆盖展示形态，非真实 SSE */
const PLACEHOLDER_STEPS: StepItem[] = [
  {
    id: 's_1',
    displayName: '理解决策问题',
    status: 'SUCCEEDED',
    summary: '已识别学习路径与时间约束',
    content:
      '你只有一周时间准备 Java 后端面试，每天 2 小时，共 14 小时可用。核心矛盾在于有限时间内是追求覆盖面还是单点深度。',
  },
  {
    id: 's_2',
    displayName: '提取关键影响因素',
    status: 'SUCCEEDED',
    summary: '已提取时间、收益与实践因素',
    content:
      '关键因素包括：时间成本、求职收益、项目实践。可在画布调整权重后发起局部重推。',
    toolSummary: 'calculator：比较每日学习时长 → 两种方案均可在 14 小时内完成基础学习',
  },
]

function statusTag(status: StepItem['status']) {
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

/** 右侧推演对话占位：步骤日志可折叠；不展示模型内部推理 */
export function ConversationPanel() {
  return (
    <aside className="conversation-panel">
      <div className="conversation-panel__header">
        <Text strong>推演对话</Text>
        <Tag>SSE 占位</Tag>
      </div>

      <div className="conversation-panel__body">
        <div className="chat-bubble chat-bubble--user">
          <div className="chat-bubble__meta">
            <UserOutlined />
            <Text type="secondary">你</Text>
          </div>
          <Paragraph style={{ marginBottom: 0 }}>
            我应该优先学习 Redis 还是 Docker？约束：每天 2 小时，已有 Java
            基础，一周内提升求职竞争力。
          </Paragraph>
        </div>

        <div className="chat-bubble chat-bubble--ai">
          <div className="chat-bubble__meta">
            <RobotOutlined />
            <Text type="secondary">决策助手</Text>
          </div>
          <Paragraph style={{ marginBottom: 12 }}>
            我将按「问题理解 → 因素提取 → 方案生成 → 方案对比」分步推演，并在画布上给出可调整的结构。面向你展示的是步骤日志与工具摘要，不会展示模型内部推理。
          </Paragraph>

          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            {PLACEHOLDER_STEPS.map((step) => (
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
                      label: '展开输入与校验结果',
                      children: (
                        <Paragraph
                          style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}
                        >
                          {step.content}
                        </Paragraph>
                      ),
                    },
                    ...(step.toolSummary
                      ? [
                          {
                            key: 'tool',
                            label: '查看工具调用摘要',
                            children: (
                              <Paragraph style={{ marginBottom: 0 }}>
                                {step.toolSummary}
                              </Paragraph>
                            ),
                          },
                        ]
                      : []),
                  ]}
                />
              </div>
            ))}
          </Space>

          <Paragraph style={{ marginTop: 12, marginBottom: 0 }}>
            已生成 3 个候选方案。你可以在画布调整因素权重；保存后将使用后端返回的
            changedNodeIds 发起局部重推，并以 analysisResultId 确认草案。
          </Paragraph>
        </div>

        <Alert
          type="warning"
          showIcon
          message="因素权重已变更"
          description="受影响的方案与推荐正在重算，完成后请确认新草案后再覆盖正式结论。"
          style={{ marginTop: 12 }}
        />

        <div className="partial-status">
          <div className="partial-status__title">
            <LoadingOutlined />
            <Text strong>局部推演中</Text>
            <Tag color="orange">PARTIAL_ANALYZING</Tag>
          </div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            仅计算受影响子树 · 刷新后将先 GET 任务详情再连 SSE
          </Text>
          <Progress percent={42} size="small" status="active" />
        </div>
      </div>

      <div className="conversation-panel__footer">
        <TextArea
          rows={2}
          disabled
          placeholder="对话输入待接入（本阶段占位）"
        />
      </div>
    </aside>
  )
}
