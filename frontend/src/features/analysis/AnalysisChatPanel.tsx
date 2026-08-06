import { useEffect, useMemo, useRef } from 'react'
import { Button, Divider, Empty, Result, Space, Spin, Typography } from 'antd'
import { CheckCircleOutlined, ReloadOutlined, ThunderboltOutlined } from '@ant-design/icons'
import type {
  AnalysisResult,
  AnalysisStep,
  DecisionOption,
  Recommendation,
  ToolCallEvent,
} from '../../types/analysis'
import type { ConnectionStatus, StepGroupInfo } from '../../hooks/useAnalysisStream'
import { ChatMessage } from './ChatMessage'
import { StepLogCard } from './StepLogCard'
import { ToolCallCard } from './ToolCallCard'
import { OptionComparison } from './OptionComparison'
import '../../styles/AnalysisChatPanel.css'

const { Text } = Typography

interface RenderedGroup {
  taskId?: string
  label: string
  isCurrent: boolean
  analysisResultId?: string | null
  steps: AnalysisStep[]
}

interface Props {
  userMessage: string
  steps: AnalysisStep[]
  toolCalls: ToolCallEvent[]
  connectionStatus: ConnectionStatus
  options: DecisionOption[]
  recommendation: Recommendation | null
  analysisResultId: string
  groupResultsById?: Record<string, AnalysisResult | null | undefined>
  selectedOptionId?: string | null
  isHistory?: boolean
  retryable?: boolean
  failedStepId?: string | null
  decisionStatus?: string
  /** 步骤分组信息（从 useAnalysisStream 传入），含轮次标签 */
  stepGroups?: StepGroupInfo[]
  connectionInterrupted?: boolean
  onRetryInterrupted?: () => void
  onAllStepsCompleted?: () => void
  onRetryStep?: (stepId: string) => void
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
  groupResultsById = {},
  isHistory = false,
  retryable = false,
  failedStepId = null,
  decisionStatus,
  stepGroups: stepGroupsProp = [],
  connectionInterrupted = false,
  onRetryInterrupted,
  onAllStepsCompleted,
  onRetryStep,
}: Props) {
  const hasResultData = options.length > 0 && recommendation !== null
  const hasHistoryData = isHistory && hasResultData
  const isPartial = decisionStatus === 'PARTIAL_ANALYZING'
  const hasMultipleRuns = stepGroupsProp.length > 1

  // 自动滚动到当前 task 区域
  const currentGroupRef = useRef<HTMLDivElement>(null)

  // 将 stepGroups 映射到实际步骤列表
  const renderedGroups = useMemo<RenderedGroup[]>(() => {
    if (stepGroupsProp.length === 0) {
      // 无分组信息：所有步骤打平为一组
      const visibleSteps = steps.filter((s) => s.status !== 'WAITING')
      return visibleSteps.length > 0
        ? [{ label: '', isCurrent: false, steps: visibleSteps }]
        : []
    }

    return stepGroupsProp
      .map((group) => {
        const groupSteps = group.stepIds
          .map((id) => steps.find((s) => s.id === id))
          .filter((s): s is AnalysisStep => s !== undefined)
          .filter((s) => s.status !== 'WAITING')
        return {
          taskId: group.taskId,
          label: group.label,
          isCurrent: group.isCurrent,
          analysisResultId: group.analysisResultId,
          steps: groupSteps,
        }
      })
      .filter((g) => g.steps.length > 0)
  }, [steps, stepGroupsProp])

  // analysisCompleted 只看当前 task 的步骤
  const currentSteps = useMemo(
    () => renderedGroups.filter((g) => g.isCurrent).flatMap((g) => g.steps),
    [renderedGroups],
  )
  const analysisCompleted =
    currentSteps.length > 0 && currentSteps.every((step) => step.status === 'SUCCEEDED')
  const hasRenderedGroupedResults = renderedGroups.some(
    (group) =>
      Boolean(
        group.analysisResultId &&
          ((group.analysisResultId === analysisResultId && hasResultData) ||
            groupResultsById[group.analysisResultId]),
      ),
  )

  const scrolledRef = useRef(false)
  const prevCurrentTaskIdRef = useRef<string | null>(null)
  const newRunningCount = currentSteps.filter((s) => s.status === 'RUNNING').length

  // 新轮次开始时重置滚动锁
  const currentTaskId = stepGroupsProp.find((g) => g.isCurrent)?.taskId ?? null
  if (currentTaskId !== prevCurrentTaskIdRef.current) {
    prevCurrentTaskIdRef.current = currentTaskId
    scrolledRef.current = false
  }

  useEffect(() => {
    if (newRunningCount > 0 && !scrolledRef.current) {
      scrolledRef.current = true
      requestAnimationFrame(() => {
        currentGroupRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    }
  }, [newRunningCount])

  const onCompletedRef = useRef(onAllStepsCompleted)
  onCompletedRef.current = onAllStepsCompleted

  useEffect(() => {
    if (analysisCompleted) {
      onCompletedRef.current?.()
    }
  }, [analysisCompleted])

  const footerText = () => {
    if (connectionInterrupted) return '连接已断开'
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
        {connectionInterrupted && (
          <Result
            status="warning"
            title="连接已断开"
            subTitle="切换决策页面时已断开实时连接，请重试以继续局部推演。"
            extra={
              onRetryInterrupted ? (
                <Button type="primary" icon={<ReloadOutlined />} onClick={onRetryInterrupted}>
                  重试
                </Button>
              ) : null
            }
          />
        )}

        {!connectionInterrupted && connectionStatus === 'idle' && !hasHistoryData && steps.length === 0 && (
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

        {!connectionInterrupted && connectionStatus === 'connecting' && (
          <div className="analysis-panel__loading">
            <Spin size="small" />
            <span>正在连接...</span>
          </div>
        )}

        {!connectionInterrupted && (connectionStatus !== 'idle' || hasHistoryData) && (
          <>
            <ChatMessage content={userMessage} />

            {/* 首次推演 / 无历史时的加载提示 */}
            {!analysisCompleted && !isHistory && !hasMultipleRuns && (
              <div className="analysis-panel__loading">
                <Spin size="small" />
                <span>正在推演...</span>
              </div>
            )}

            {renderedGroups.map((group, groupIndex) => {
              const groupResult =
                group.analysisResultId && group.analysisResultId === analysisResultId && recommendation
                  ? {
                      options,
                      recommendation,
                    }
                  : group.analysisResultId
                    ? groupResultsById[group.analysisResultId]
                    : null

              return (
                <div
                  key={group.isCurrent ? 'current-group' : `history-group-${groupIndex}`}
                  ref={group.isCurrent ? currentGroupRef : undefined}
                >
                  {/* 多轮推演时每组显示标签，首组也显示 */}
                  {hasMultipleRuns && group.label && (
                    <Divider plain style={{ fontSize: 12, color: group.isCurrent ? '#1677ff' : '#999', margin: groupIndex === 0 ? '0 0 8px' : '16px 0 8px' }}>
                      {group.label}
                    </Divider>
                  )}

                  {group.steps.map((step) => (
                    <div key={step.id}>
                      <StepLogCard
                        step={step}
                        animate={!isHistory && group.isCurrent && step.status !== 'FAILED'}
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

                  {/* 当前组末尾：进行中提示 / 完成提示 */}
                  {group.isCurrent && hasMultipleRuns && !analysisCompleted && (
                    <div className="analysis-panel__loading" style={{ marginBottom: 8 }}>
                      <Spin size="small" />
                      <span>{isPartial ? '正在局部推演，生成新结果...' : '正在重新推演...'}</span>
                    </div>
                  )}
                  {group.isCurrent && hasMultipleRuns && analysisCompleted && (
                    <Divider plain style={{ fontSize: 12, color: '#52c41a', margin: '8px 0 12px' }}>
                      本轮推演完成
                    </Divider>
                  )}

                  {groupResult && (
                    <OptionComparison
                      options={groupResult.options}
                      recommendation={groupResult.recommendation}
                      selectedOptionId={selectedOptionId}
                    />
                  )}
                </div>
              )
            })}

            {/* 没有 stepId 的工具调用：单独渲染 */}
            {toolCalls
              .filter((tc) => !tc.stepId)
              .map((tc) => (
                <ToolCallCard
                  key={`orphan-${tc.toolName}`}
                  toolCall={tc}
                />
              ))}

            {!hasRenderedGroupedResults && (analysisCompleted || hasHistoryData) && hasResultData && (
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
