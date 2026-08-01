/** 正式报告类型（对齐接口手册 v2.0 §11） */

export type ReportStatus = 'READY' | 'GENERATING' | 'FAILED' | string

export interface ReportContent {
  background: string
  objective: string
  factorAnalysis: unknown[]
  optionComparison: unknown[]
  conclusion: string
  riskAnalysis: unknown[]
  nextActions: string[]
}

export interface DecisionReport {
  id: string
  decisionId: string
  analysisResultId: string
  status: ReportStatus
  content: ReportContent
  generatedAt: string
  /** 列表展示用，详情接口可能不返回 */
  title?: string
}

export interface ReportListItem {
  id: string
  decisionId: string
  title: string
  generatedAt: string
  status: ReportStatus
}

export interface ReportListResponse {
  list: ReportListItem[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface ReportListQuery {
  page?: number
  pageSize?: number
}
