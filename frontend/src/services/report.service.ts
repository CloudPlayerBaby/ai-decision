import { getData, postData } from '@/services/http'
import { isMockEnabled } from '@/services/config'
import {
  MOCK_REPORT_LIST,
  mockGetDecisionReport,
  mockGetReport,
} from '@/mocks/reports.mock'
import type {
  DecisionReport,
  ReportListQuery,
  ReportListResponse,
} from '@/types/report'

function delay<T>(value: T, ms = 200): Promise<T> {
  return new Promise((resolve) => {
    window.setTimeout(() => resolve(value), ms)
  })
}

/**
 * 报告中心列表：分页获取当前用户拥有的报告。
 */
export async function listReports(
  query: ReportListQuery = {},
): Promise<ReportListResponse> {
  if (isMockEnabled()) {
    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 10
    return delay({
      list: MOCK_REPORT_LIST.slice((page - 1) * pageSize, page * pageSize),
      page,
      pageSize,
      total: MOCK_REPORT_LIST.length,
      totalPages: Math.ceil(MOCK_REPORT_LIST.length / pageSize),
    })
  }
  return getData<ReportListResponse>('/reports', { params: query })
}

export async function getReport(reportId: string): Promise<DecisionReport> {
  if (isMockEnabled()) {
    return delay(mockGetReport(reportId))
  }
  return getData<DecisionReport>(`/reports/${reportId}`)
}

export async function getDecisionReport(
  decisionId: string,
): Promise<DecisionReport> {
  if (isMockEnabled()) {
    return delay(mockGetDecisionReport(decisionId))
  }
  return getData<DecisionReport>(`/decisions/${decisionId}/report`)
}

export async function regenerateReport(
  decisionId: string,
): Promise<DecisionReport> {
  if (isMockEnabled()) {
    const report = mockGetDecisionReport(decisionId)
    return delay({
      ...report,
      generatedAt: new Date().toISOString(),
    })
  }
  return postData<DecisionReport>(
    `/decisions/${decisionId}/regenerate-report`,
  )
}
