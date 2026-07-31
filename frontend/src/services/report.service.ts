import { getData, postData } from '@/services/http'
import { isMockEnabled } from '@/services/config'
import {
  MOCK_REPORT_LIST,
  mockGetDecisionReport,
  mockGetReport,
} from '@/mocks/reports.mock'
import type { DecisionReport, ReportListItem } from '@/types/report'

function delay<T>(value: T, ms = 200): Promise<T> {
  return new Promise((resolve) => {
    window.setTimeout(() => resolve(value), ms)
  })
}

/**
 * 报告中心列表：契约未单独定义列表接口时，Mock 提供本地列表；
 * 真接口可改为从 COMPLETED 决策聚合，联调时再切换。
 */
export async function listReports(): Promise<ReportListItem[]> {
  if (isMockEnabled()) {
    return delay([...MOCK_REPORT_LIST])
  }
  // 真后端暂无独立列表：用已完成决策详情的 reportId 由页面自行聚合
  return getData<ReportListItem[]>('/reports').catch(() => [])
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
