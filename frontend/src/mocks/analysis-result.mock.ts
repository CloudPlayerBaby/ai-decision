import type { AnalysisResult } from '@/types/analysis'

export const MOCK_ANALYSIS_RESULT: AnalysisResult = {
  id: 'ar_40002',
  status: 'PENDING_CONFIRM',
  understanding: '用户希望在一周内选择优先学习方向，并提升 Java 后端面试竞争力。',
  factors: [
    {
      id: 'f_time',
      name: '时间成本',
      weight: 0.3,
      description: '一周内可获得的掌握程度',
    },
    {
      id: 'f_benefit',
      name: '求职收益',
      weight: 0.35,
      description: '面试高频度与项目可展示性',
    },
    {
      id: 'f_practice',
      name: '项目实践',
      weight: 0.2,
      description: '能否形成可验证成果',
    },
  ],
  options: [
    {
      id: 'opt_redis',
      name: '优先学习 Redis',
      pros: ['面试高频', '缓存场景可快速演示'],
      cons: ['需理解缓存场景'],
      risks: ['缺少项目实践'],
      scores: { cost: 4, time: 4, benefit: 5, risk: 3, feasibility: 4 },
    },
    {
      id: 'opt_docker',
      name: '优先学习 Docker',
      pros: ['工程化与部署能力'],
      cons: ['面试题偏场景化'],
      risks: ['短期深度不足'],
      scores: { cost: 3, time: 3, benefit: 4, risk: 4, feasibility: 4 },
    },
    {
      id: 'opt_both',
      name: '双轨轻量',
      pros: ['覆盖更广'],
      cons: ['深度不足'],
      risks: ['两周内难以形成亮点'],
      scores: { cost: 3, time: 2, benefit: 3, risk: 3, feasibility: 3 },
    },
  ],
  recommendation: {
    optionId: 'opt_redis',
    reason: '在有限时间内，Redis 对面试收益更高，且可快速做出缓存演示。',
  },
  nextActions: ['完成缓存基础', '做一个缓存穿透演示'],
  validation: { schemaValid: true, repaired: false, warnings: [] },
  createdAt: '2026-07-30T21:38:00+08:00',
}

export const MOCK_CONFIRMED_RESULT: AnalysisResult = {
  ...MOCK_ANALYSIS_RESULT,
  id: 'ar_40001',
  status: 'CONFIRMED',
}

export function mockGetAnalysisResult(
  resultId?: string | null,
): AnalysisResult | null {
  if (!resultId || resultId === MOCK_ANALYSIS_RESULT.id) {
    return MOCK_ANALYSIS_RESULT
  }
  if (resultId === MOCK_CONFIRMED_RESULT.id) {
    return MOCK_CONFIRMED_RESULT
  }
  return { ...MOCK_ANALYSIS_RESULT, id: resultId }
}
