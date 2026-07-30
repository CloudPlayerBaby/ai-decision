/** 决策问题相关类型（对齐接口手册 v2.0 §3.1 / §4.1 / §6） */

export type DecisionStatus =
  | 'PENDING'
  | 'ANALYZING'
  | 'PARTIAL_ANALYZING'
  | 'WAITING_CONFIRM'
  | 'COMPLETED'
  | 'FAILED'

export interface DecisionProblem {
  id: string
  title: string
  background?: string
  goal: string
  /** v2.0：自由文本，不是 string[] */
  constraints?: string
  status: DecisionStatus
  preferredOptionId?: string | null
  latestTaskId?: string | null
  hasPendingResult: boolean
  pendingResultId?: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateDecisionRequest {
  title: string
  background?: string
  goal: string
  constraints?: string
}

export interface CreateDecisionResponse {
  id: string
  status: DecisionStatus
  title: string
  createdAt: string
}

export interface DecisionListItem {
  id: string
  title: string
  status: DecisionStatus
  preferredOptionId?: string | null
  updatedAt: string
  hasPendingResult?: boolean
}

export interface DecisionListQuery {
  page?: number
  pageSize?: number
  status?: DecisionStatus
  keyword?: string
}

export interface DecisionListResponse {
  list: DecisionListItem[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface TaskSummary {
  id: string
  status: string
  progress: number
}

export interface DecisionDetailResponse {
  decision: DecisionProblem
  latestTask?: TaskSummary | null
  confirmedResultId?: string | null
  pendingResultId?: string | null
  reportId?: string | null
}
