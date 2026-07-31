import { useState, useEffect, useRef } from 'react';
import { Spin, Result, Typography, Empty, Space } from 'antd';
import { ThunderboltOutlined, CheckCircleOutlined } from '@ant-design/icons';
import type { AnalysisStep, ToolCallEvent, DecisionOption, Recommendation } from '../../types/analysis';
import type { ConnectionStatus } from '../../hooks/useAnalysisStream';
import { ChatMessage } from './ChatMessage';
import { StepLogCard } from './StepLogCard';
import { ToolCallCard } from './ToolCallCard';
import { OptionComparison } from './OptionComparison';
import '../../styles/AnalysisChatPanel.css';

const { Text } = Typography;

interface Props {
  userMessage: string;
  steps: AnalysisStep[];
  toolCalls: ToolCallEvent[];
  connectionStatus: ConnectionStatus;
  options: DecisionOption[];
  recommendation: Recommendation;
  analysisResultId: string;
  /** 用户已选择的方案 ID（来自 decision.preferredOptionId） */
  selectedOptionId?: string | null;
  /** COMPLETED 或 WAITING_CONFIRM 状态时为 true，跳过动画，直接展示历史结果 */
  isHistory?: boolean;
  onAllStepsCompleted?: () => void;
}

export function AnalysisChatPanel({
  userMessage,
  steps: initialSteps,
  toolCalls,
  connectionStatus,
  options,
  recommendation,
  analysisResultId,
  selectedOptionId: externalSelectedOptionId,
  isHistory = false,
  onAllStepsCompleted,
}: Props) {
  const [simSteps, setSimSteps] = useState<AnalysisStep[]>(initialSteps);
  const timerRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const analysisCompleted = simSteps.length > 0 && simSteps.every((s) => s.status === 'SUCCEEDED');

  const onCompletedRef = useRef(onAllStepsCompleted);
  onCompletedRef.current = onAllStepsCompleted;

  useEffect(() => {
    if (analysisCompleted) {
      onCompletedRef.current?.();
    }
  }, [analysisCompleted]);

  useEffect(() => {
    setSimSteps(initialSteps);
  }, [initialSteps]);

  useEffect(() => {
    if (isHistory) return;

    timerRef.current = [];

    const pending = initialSteps.filter((s) => s.status === 'RUNNING' || s.status === 'WAITING');

    pending.forEach((step, idx) => {
      const i = initialSteps.indexOf(step);

      if (step.status === 'WAITING') {
        const runningTimer = setTimeout(() => {
          setSimSteps((prev) =>
            prev.map((s, j) => (j === i ? { ...s, status: 'RUNNING' as const, summary: '正在分析中...' } : s)),
          );
        }, idx * 2000 + 500);
        timerRef.current.push(runningTimer);
      }

      const delay = step.status === 'WAITING' ? idx * 2000 + 1500 : idx * 2000 + 500;

      const doneTimer = setTimeout(() => {
        setSimSteps((prev) =>
          prev.map((s, j) =>
            j === i
              ? {
                  ...s,
                  status: 'SUCCEEDED' as const,
                  summary: s.content ? s.content.slice(0, 30) + '...' : '分析完成',
                }
              : s,
          ),
        );
      }, delay);
      timerRef.current.push(doneTimer);
    });

    return () => {
      timerRef.current.forEach(clearTimeout);
    };
  }, [initialSteps, isHistory]);

  const displaySteps = simSteps;
  const hasHistoryData = isHistory && options.length > 0;

  const footerText = () => {
    if (isHistory) return '● 历史记录';
    switch (connectionStatus) {
      case 'idle': return '等待推演';
      case 'connecting': return '连接中...';
      case 'connected': return '● 已连接';
      case 'reconnecting': return '● 连接恢复中...';
    }
  };

  return (
    <div className="analysis-panel">
      <div className="analysis-panel__header">推演对话</div>

      <div className="analysis-panel__body">
        {connectionStatus === 'idle' && !hasHistoryData && (
          <Empty
            image={<ThunderboltOutlined style={{ fontSize: 48, color: '#1677ff' }} />}
            description={
              <Text type="secondary">
                点击上方「开始推演」按钮，启动 AI 决策分析
              </Text>
            }
            style={{ marginTop: 32 }}
          />
        )}

        {(connectionStatus === 'connecting') && (
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
                <span>正在推演...</span>
              </div>
            )}

            {displaySteps
              .filter((s) => s.status !== 'WAITING')
              .map((step) => (
                <div key={step.id}>
                  <StepLogCard step={step} />
                  {toolCalls
                    .filter((tc) => tc.stepId === step.id)
                    .map((tc) => (
                      <ToolCallCard key={`${tc.stepId}-${tc.toolName}`} toolCall={tc} />
                    ))}
                </div>
              ))}

            {(analysisCompleted || hasHistoryData) && (
              <OptionComparison
                options={options}
                recommendation={recommendation}
                selectedOptionId={externalSelectedOptionId}
              />
            )}

            {isHistory && externalSelectedOptionId && (
              <div className="confirm-result">
                <Result
                  icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                  title="方案已确认"
                  subTitle={
                    <Space direction="vertical" size={4}>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        已选择方案: <Text strong>{externalSelectedOptionId}</Text>
                      </Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        草案: {analysisResultId}
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
  );
}
