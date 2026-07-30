import type { DecisionListQuery } from '@/types/decision'

/** React Query key 工厂：统一失效与共享缓存 */
export const queryKeys = {
  me: ['users', 'me'] as const,
  decisions: {
    all: ['decisions'] as const,
    list: (query: DecisionListQuery) =>
      ['decisions', 'list', query] as const,
    detail: (decisionId: string) =>
      ['decisions', 'detail', decisionId] as const,
    analysisResult: (decisionId: string, resultId?: string | null) =>
      ['decisions', decisionId, 'analysis-result', resultId ?? 'default'] as const,
    canvas: (decisionId: string) =>
      ['decisions', decisionId, 'canvas'] as const,
    report: (decisionId: string) =>
      ['decisions', decisionId, 'report'] as const,
  },
  analysisTasks: {
    detail: (taskId: string) => ['analysis-tasks', taskId] as const,
  },
  reports: {
    detail: (reportId: string) => ['reports', reportId] as const,
  },
}
