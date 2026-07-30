import { useState, useEffect, useRef } from 'react';
import { Spin, Result, Typography } from 'antd';
import type { AnalysisStep, ToolCallEvent, DecisionOption, Recommendation } from '../../types/analysis';
import { ChatMessage } from './ChatMessage';
import { StepLogCard } from './StepLogCard';
import { ToolCallCard } from './ToolCallCard';
import { OptionComparison } from './OptionComparison';
import { ConfirmAction } from './ConfirmAction';
import '../../styles/AnalysisChatPanel.css';

const { Text } = Typography;

interface Props {
  userMessage: string;
  steps: AnalysisStep[];
  toolCalls: ToolCallEvent[];
  analysisCompleted: boolean;
  options: DecisionOption[];
  recommendation: Recommendation;
  analysisResultId: string;
}

export function AnalysisChatPanel({
  userMessage,
  steps: initialSteps,
  toolCalls,
  analysisCompleted: propCompleted,
  options,
  recommendation,
  analysisResultId,
}: Props) {
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [simSteps, setSimSteps] = useState<AnalysisStep[]>(initialSteps);
  const [simCompleted, setSimCompleted] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const analysisCompleted = propCompleted || simCompleted;

  useEffect(() => {
    timerRef.current = [];

    // 只模拟还在进行中的步骤：RUNNING 的直接跳 SUCCEEDED，WAITING 的先 RUNNING 再 SUCCEEDED
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

    const completeTimer = setTimeout(() => {
      setSimCompleted(true);
    }, pending.length * 2000 + 1000);
    timerRef.current.push(completeTimer);

    return () => {
      timerRef.current.forEach(clearTimeout);
    };
  }, [initialSteps]);

  const displaySteps = simSteps;

  return (
    <div className="analysis-panel">
      <div className="analysis-panel__header">推演对话</div>

      <div className="analysis-panel__body">
        <ChatMessage content={userMessage} />

        {!analysisCompleted && (
          <div className="analysis-panel__loading">
            <Spin size="small" />
            <span>正在推演...</span>
          </div>
        )}

        {displaySteps.map((step) => (
          <div key={step.id}>
            <StepLogCard step={step} />
            {toolCalls
              .filter((tc) => tc.stepId === step.id)
              .map((tc) => (
                <ToolCallCard key={`${tc.stepId}-${tc.toolName}`} toolCall={tc} />
              ))}
          </div>
        ))}

        {analysisCompleted && displaySteps.length > 0 && !selectedOptionId && (
          <OptionComparison
            options={options}
            recommendation={recommendation}
            onSelect={setSelectedOptionId}
          />
        )}

        {selectedOptionId && !confirmed && (
          <ConfirmAction
            selectedOptionId={selectedOptionId}
            analysisResultId={analysisResultId}
            onCancel={() => setSelectedOptionId(null)}
            onConfirm={() => setConfirmed(true)}
          />
        )}

        {confirmed && (
          <div className="confirm-result">
            <Result
              status="success"
              title="报告已生成"
              subTitle={
                <Text type="secondary" style={{ fontSize: 12 }}>
                  草案 {analysisResultId} 已确认，正式报告已生成。
                </Text>
              }
            />
          </div>
        )}
      </div>

      <div className="analysis-panel__footer">● 已连接</div>
    </div>
  );
}
