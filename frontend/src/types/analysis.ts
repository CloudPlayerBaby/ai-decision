// ========== 步骤状态 ==========

export type StepStatus = 'WAITING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';

// ========== 草案状态 ==========

export type ResultStatus = 'PENDING_CONFIRM' | 'CONFIRMED';

// ========== SSE 连接状态 ==========

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'closed';

// ========== 核心数据模型 ==========

export interface AnalysisStep {
  id: string;
  name: string;
  displayName: string;
  status: StepStatus;
  summary: string;
  content: string;
  startedAt?: string;
  endedAt?: string;
}

export interface ToolCallRecord {
  stepId: string;
  toolName: string;
  status: 'RUNNING' | 'SUCCEEDED' | 'FAILED';
  inputSummary: string;
  outputSummary: string;
}

export interface OptionScores {
  cost: number;
  time: number;
  benefit: number;
  risk: number;
  feasibility: number;
}

export interface Option {
  id: string;
  name: string;
  pros: string[];
  cons: string[];
  risks: string[];
  scores: OptionScores;
}

export interface Factor {
  id: string;
  name: string;
  weight: number;
  description: string;
}

export interface AnalysisResult {
  id: string;
  status: ResultStatus;
  understanding: string;
  factors: Factor[];
  options: Option[];
  recommendation: {
    optionId: string;
    reason: string;
  };
  nextActions: string[];
  validation: {
    schemaValid: boolean;
    repaired: boolean;
    warnings: string[];
  };
  createdAt: string;
}
