import { Spin } from 'antd';
import type { AnalysisStep, ToolCallRecord } from '../../types/analysis';
import { ChatMessage } from './ChatMessage';
import { StepLogCard } from './StepLogCard';
import { ToolCallCard } from './ToolCallCard';
import '../../styles/AnalysisChatPanel.css';

interface Props {
  userMessage: string;
  steps: AnalysisStep[];
  toolCalls: ToolCallRecord[];
  analysisCompleted: boolean;
}

export function AnalysisChatPanel({ userMessage, steps, toolCalls, analysisCompleted }: Props) {
  return (
    <div className="analysis-chat-panel">
      <div className="panel-header">推演对话</div>

      <div className="panel-body">
        <ChatMessage content={userMessage} />

        {!analysisCompleted && (
          <div className="loading-row">
            <Spin size="small" />
            <span>正在推演...</span>
          </div>
        )}

        {steps.map((step) => (
          <div key={step.id}>
            <StepLogCard step={step} />
            {toolCalls
              .filter((tc) => tc.stepId === step.id)
              .map((tc) => (
                <ToolCallCard key={`${tc.stepId}-${tc.toolName}`} toolCall={tc} />
              ))}
          </div>
        ))}
      </div>

      <div className="panel-footer">● 已连接</div>
    </div>
  );
}
