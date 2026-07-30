/** 推演任务 / 分析结果 / SSE 相关类型（对齐接口手册 v2.0 §3.2 / §4.2 / §7–§9） */

import type { Canvas } from './canvas'
import type { DecisionStatus } from './decision'

export type StepStatus = 'WAITING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED'

export type AnalysisStepName =
  | 'UNDERSTAND'
  | 'EXTRACT_FACTORS'
  | 'TOOL_CALL'
  | 'GENERATE_OPTIONS'
  | 'COMPARE_OPTIONS'
  | 'GENERATE_REPORT'

export type AnalysisResultStatus = 'PENDING_CONFIRM' | 'CONFIRMED'

export type TaskType = 'FULL_ANALYSIS' | 'PARTIAL_ANALYSIS'

export type TaskRunStatus = 'WAITING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED'

export interface Factor {
  id: string
  name: string
  weight: number
  description: string
}

export interface OptionScores {
  cost: number
  time: number
  benefit: number
  risk: number
  feasibility: number
}

export interface DecisionOption {
  id: string
  name: string
  pros: string[]
  cons: string[]
  risks: string[]
  scores: OptionScores
}

export interface Recommendation {
  optionId: string
  reason: string
}

export interface AnalysisValidation {
  schemaValid: boolean
  repaired: boolean
  warnings: string[]
}

export interface AnalysisResult {
  id: string
  status: AnalysisResultStatus
  understanding: string
  factors: Factor[]
  options: DecisionOption[]
  recommendation: Recommendation
  nextActions: string[]
  canvas?: Canvas
  validation: AnalysisValidation
  createdAt: string
}

export interface AnalysisStep {
  id: string
  name: AnalysisStepName | string
  displayName: string
  status: StepStatus
  startedAt?: string
  endedAt?: string
  summary?: string
  /** 同一 stepId 的 content 以最新全文覆盖，禁止拼接 */
  content?: string
}

export interface TaskError {
  code: number
  message: string
  retryable: boolean
  failedStepId?: string
}

export interface AnalysisTask {
  id: string
  status: TaskRunStatus
  progress: number
  steps: AnalysisStep[]
  lastEventId?: string
  error?: TaskError
}

export interface StartAnalysisResponse {
  taskId: string
  decisionId: string
  taskType: TaskType
  status: TaskRunStatus
  startedAt: string
}

export interface PartialAnalysisRequest {
  changedNodeIds: string[]
}

export interface PartialAnalysisResponse {
  taskId: string
  taskType: 'PARTIAL_ANALYSIS'
  status: TaskRunStatus
  affectedNodeIds: string[]
}

export interface RetryStepResponse {
  taskId: string
  stepId: string
  status: StepStatus
  message: string
}

export interface SseTicketResponse {
  sseUrl: string
  expiresIn: number
}

export interface PreferredOptionRequest {
  analysisResultId: string
  optionId: string
}

export interface ConfirmAnalysisRequest {
  analysisResultId: string
  selectedOptionId: string
}

export interface ConfirmAnalysisResponse {
  decisionId: string
  status: DecisionStatus
  analysisResultId: string
  reportId: string
  reportStatus: 'READY' | string
}

/** SSE 事件 data 形态（B 组消费；C 提供类型） */
export interface StepUpdateEvent {
  taskId: string
  stepId: string
  status: StepStatus
  progress?: number
  summary?: string
  content?: string
  occurredAt?: string
}

export interface ToolCallEvent {
  taskId: string
  stepId: string
  toolName: string
  status: StepStatus
  inputSummary?: string
  outputSummary?: string
}

export interface ResultReadyEvent {
  taskId: string
  decisionId: string
  analysisResultId: string
  decisionStatus: DecisionStatus
  resultStatus: AnalysisResultStatus
}

export interface TaskFailedEvent {
  taskId?: string
  errorCode: number
  message: string
  failedStepId?: string
  retryable: boolean
}
