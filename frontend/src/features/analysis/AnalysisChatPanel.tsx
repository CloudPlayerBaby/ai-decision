import { useEffect, useRef } from 'react'
import { Empty, Result, Space, Spin, Typography } from 'antd'
import { CheckCircleOutlined, ThunderboltOutlined } from '@ant-design/icons'
import type {
  AnalysisStep,
  DecisionOption,
  Recommendation,
  ToolCallEvent,
} from '../../types/analysis'
import type { ConnectionStatus } from '../../hooks/useAnalysisStream'
import { ChatMessage } from './ChatMessage'
import { StepLogCard } from './StepLogCard'
import { ToolCallCard } from './ToolCallCard'
import { OptionComparison } from './OptionComparison'
import '../../styles/AnalysisChatPanel.css'

const { Text } = Typography

interface Props {
  userMessage: string
  steps: AnalysisStep[]
  toolCalls: ToolCallEvent[]
  connectionStatus: ConnectionStatus
  options: DecisionOption[]
  recommendation: Recommendation | null
  analysisResultId: string
  selectedOptionId?: string | null
  isHistory?: boolean
  /** 当前任务失败是否可重试 */
  retryable?: boolean
  /** 失败的步骤 ID */
  failedStepId?: string | null
  /** 决策状态，用于区分整轮推演 / 局部推演 */
  decisionStatus?: string
  onAllStepsCompleted?: () => void
  onRetryStep?: (stepId: string) => void
}

function isReusedPartialStep(step: AnalysisStep) {
  if (step.status !== 'SUCCEEDED') return false

  const text = `${step.summary ?? ''}${step.content ?? ''}`
  return text.includes('复用') || text.includes('沿用')
}

export function AnalysisChatPanel({
  userMessage,
  steps,
  toolCalls,
  connectionStatus,
  options,
  recommendation,
  analysisResultId,
  selectedOptionId,
  isHistory = false,
  retryable = false,
  failedStepId = null,
  decisionStatus,
  onAllStepsCompleted,
  onRetryStep,
}: Props) {
  const analysisCompleted =
    steps.length > 0 && steps.every((step) => step.status === 'SUCCEEDED')
  const hasResultData = options.length > 0 && recommendation !== null
  const hasHistoryData = isHistory && hasResultData
  const isPartial = decisionStatus === 'PARTIAL_ANALYZING'
  const visibleSteps = isPartial
    ? steps.filter((step) => !isReusedPartialStep(step))
    : steps

  const onCompletedRef = useRef(onAllStepsCompleted)
  onCompletedRef.current = onAllStepsCompleted

  useEffect(() => {
    if (analysisCompleted) {
      onCompletedRef.current?.()
    }
  }, [analysisCompleted])

  const footerText = () => {
    if (isHistory) return '历史记录'
    switch (connectionStatus) {
      case 'idle':
        return '等待推演'
      case 'connecting':
        return '连接中...'
      case 'connected':
        return '已连接'
      case 'reconnecting':
        return '连接恢复中...'
    }
  }

  return (
    <div className="analysis-panel">
      <div className="analysis-panel__header">推演对话</div>

      <div className="analysis-panel__body">
        {connectionStatus === 'idle' && !hasHistoryData && (
          <Empty
            image={
              <ThunderboltOutlined style={{ fontSize: 48, color: '#1677ff' }} />
            }
            description={
              <Text type="secondary">
                点击上方“开始推演”按钮，启动 AI 决策分析
              </Text>
            }
            style={{ marginTop: 32 }}
          />
        )}

        {connectionStatus === 'connecting' && (
          <div className="analysis-panel__loading">
            <Spin size="small" />
            <span>正在连接...</span>
          </div>
        )}

        {(connectionStatus !== 'idle' || hasHistoryData) && (
          <>
            <ChatMessage content={userMessage} />

            {!analysisCompleted && !isHistory && (
              <div className="analysis-panel__loading">
                <Spin size="small" />
                <span>{isPartial ? '正在局部推演...' : '正在推演...'}</span>
                {isPartial && (
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
                    仅重新推演受影响的部分，其余结果保持不变
                  </Text>
                )}
              </div>
            )}

            {visibleSteps
              .filter((step) => step.status !== 'WAITING')
              .map((step) => (
                <div key={step.id}>
                  <StepLogCard
                    step={step}
                    animate={!isHistory && step.status !== 'FAILED'}
                    onRetry={
                      retryable && step.id === failedStepId
                        ? onRetryStep
                        : undefined
                    }
                  />
                  {toolCalls
                    .filter((toolCall) => toolCall.stepId === step.id)
                    .map((toolCall) => (
                      <ToolCallCard
                        key={`${step.id}-${toolCall.toolName}`}
                        toolCall={toolCall}
                      />
                    ))}
                </div>
              ))}

            {/* 没有 stepId 的工具调用：单独渲染 */}
            {toolCalls
              .filter((tc) => !tc.stepId)
              .map((tc) => (
                <ToolCallCard
                  key={`orphan-${tc.toolName}`}
                  toolCall={tc}
                />
              ))}

            {(analysisCompleted || hasHistoryData) && hasResultData && (
              <OptionComparison
                options={options}
                recommendation={recommendation}
                selectedOptionId={selectedOptionId}
              />
            )}

            {isHistory && selectedOptionId && (
              <div className="confirm-result">
                <Result
                  icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                  title="方案已确认"
                  subTitle={
                    <Space orientation="vertical" size={4}>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        已选择方案: <Text strong>{selectedOptionId}</Text>
                      </Text>
                      {analysisResultId ? (
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          草案: {analysisResultId}
                        </Text>
                      ) : null}
                    </Space>
                  }
                />
              </div>
            )}
          </>
        )}
      </div>

      <div className="analysis-panel__footer">{footerText()}</div>
    </div>
  )
}
