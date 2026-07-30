import type { DecisionReport, ReportListItem } from '@/types/report'

export const MOCK_REPORT: DecisionReport = {
  id: 'r_demo-2',
  decisionId: 'demo-2',
  analysisResultId: 'ar_40001',
  status: 'READY',
  title: '毕业旅行预算规划',
  generatedAt: '2026-07-28T18:00:00+08:00',
  content: {
    background: '想和同学毕业旅行，人均预算 3000 元。',
    objective: '在预算内安排 5 天行程。',
    factorAnalysis: [
      { name: '交通成本', summary: '高铁方案更可控' },
      { name: '住宿舒适度', summary: '青旅与民宿折中' },
    ],
    optionComparison: [
      { optionId: 'opt_train', name: '高铁+民宿', score: 4.2 },
      { optionId: 'opt_flight', name: '机票+酒店', score: 3.4 },
    ],
    conclusion: '推荐高铁+民宿方案，预算更稳，行程弹性更大。',
    riskAnalysis: ['旺季住宿涨价', '部分景点需提前预约'],
    nextActions: ['锁定往返高铁', '预订两晚核心区民宿'],
  },
}

export const MOCK_REPORT_LIST: ReportListItem[] = [
  {
    id: 'r_demo-2',
    decisionId: 'demo-2',
    title: '毕业旅行预算规划',
    generatedAt: '2026-07-28T18:00:00+08:00',
    status: 'READY',
  },
  {
    id: 'r_demo-1',
    decisionId: 'demo-1',
    title: '一周 Java 面试复习安排',
    generatedAt: '2026-07-30T21:40:00+08:00',
    status: 'READY',
  },
]

export function mockGetReport(reportId: string): DecisionReport {
  if (reportId === MOCK_REPORT.id || reportId === 'demo-2') {
    return { ...MOCK_REPORT, id: reportId.startsWith('r_') ? reportId : MOCK_REPORT.id }
  }
  return {
    ...MOCK_REPORT,
    id: reportId.startsWith('r_') ? reportId : `r_${reportId}`,
    decisionId: reportId.replace(/^r_/, ''),
    title: `决策报告 ${reportId}`,
  }
}

export function mockGetDecisionReport(decisionId: string): DecisionReport {
  return {
    ...MOCK_REPORT,
    id: `r_${decisionId}`,
    decisionId,
    title: `决策报告 ${decisionId}`,
  }
}
