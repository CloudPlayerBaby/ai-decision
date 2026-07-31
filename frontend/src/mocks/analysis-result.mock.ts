/**
 * AnalysisResult Mock 数据
 * 基于 docs/02-api-contract-v2.0.md API 契约 9.1 节
 */

import type { CanvasViewModel, FactorDetail, OptionDetail } from '../types/canvas'
import type { AnalysisResult } from '../types/analysis'
import { mockCanvas } from './canvas.mock'

/**
 * Mock AnalysisResult（供 buildMockCanvasViewModel 和 mockGetAnalysisResult 共用）
 */
export const mockAnalysisResult: AnalysisResult = {
  id: 'ar_40001',
  status: 'PENDING_CONFIRM',
  understanding: '用户希望在一周内选择优先学习方向，提升 Java 后端面试竞争力。核心矛盾是有限时间内的学习路径选择。',
  factors: [
    {
      id: 'f_time',
      name: '时间成本',
      weight: 0.30,
      description: '每天 2 小时，共 14 小时可用',
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
      weight: 0.20,
      description: '能否形成可验证成果',
    },
    {
      id: 'f_difficulty',
      name: '学习难度',
      weight: 0.15,
      description: '入门曲线与概念复杂度',
    },
  ],
  options: [
    {
      id: 'opt_docker',
      name: '优先学习 Docker',
      pros: ['工程化能力提升', 'Dockerfile 可写进简历', '面试有场景题'],
      cons: ['概念较抽象', '高频面试题偏场景化'],
      risks: ['缺少深度八股文储备'],
      scores: { cost: 4, time: 4, benefit: 4, risk: 4, feasibility: 5 },
    },
    {
      id: 'opt_redis',
      name: '优先学习 Redis',
      pros: ['面试高频缓存考点', '八股文集中'],
      cons: ['缺少项目实践支撑', '深入原理需要更多时间'],
      risks: ['面试被追问项目细节可能露馅'],
      scores: { cost: 4, time: 4, benefit: 5, risk: 3, feasibility: 4 },
    },
    {
      id: 'opt_both',
      name: '双轨轻量',
      pros: ['覆盖更广', '心态更从容'],
      cons: ['两周内深度不足', '每个都只学皮毛'],
      risks: ['面试深度追问可能失利'],
      scores: { cost: 3, time: 2, benefit: 4, risk: 4, feasibility: 3 },
    },
    {
      id: 'opt_focus',
      name: '集中 Java',
      pros: ['巩固 Java 基础', 'JVM/并发等深入话题更稳'],
      cons: ['无差异化优势', 'Docker/Redis 不会可能扣分'],
      risks: ['面试官问到加分项时哑火'],
      scores: { cost: 5, time: 5, benefit: 3, risk: 5, feasibility: 5 },
    },
  ],
  recommendation: {
    optionId: 'opt_redis',
    reason: '面试极高频，一周内可快速建立知识框架',
  },
  nextActions: ['完成缓存基础', '做一个缓存穿透演示'],
  validation: { schemaValid: true, repaired: false, warnings: [] },
  createdAt: '2026-07-30T21:38:00+08:00',
}

/** 已确认的草案 */
export const MOCK_CONFIRMED_RESULT: AnalysisResult = {
  ...mockAnalysisResult,
  id: 'ar_40002',
  status: 'CONFIRMED',
}

/**
 * Mock DecisionProblem
 * 用于 CanvasViewModel 组装时注入 decision
 */
export const mockDecisionProblem = {
  id: 'd_20001',
  title: '优先学习 Redis 还是 Docker？',
  goal: '一周内提升求职竞争力',
  constraints: '每天 2 小时，已有 Java 基础',
}

/**
 * 根据 mockCanvas + mockAnalysisResult + mockDecisionProblem
 * 组装 CanvasViewModel
 */
export function buildMockCanvasViewModel(): CanvasViewModel {
  const factorsDetail: Record<string, FactorDetail> = {}
  for (const f of mockAnalysisResult.factors) {
    factorsDetail[f.id] = { description: f.description }
  }

  const optionsDetail: Record<string, OptionDetail> = {}
  for (const o of mockAnalysisResult.options) {
    optionsDetail[o.id] = { pros: o.pros, cons: o.cons, risks: o.risks }
  }

  return {
    decision: {
      id: mockDecisionProblem.id,
      title: mockDecisionProblem.title,
      goal: mockDecisionProblem.goal,
      constraints: mockDecisionProblem.constraints,
    },
    canvas: mockCanvas,
    factorsDetail,
    optionsDetail,
    recommendedOptionId: mockAnalysisResult.recommendation.optionId,
  }
}

/**
 * Mock getAnalysisResult
 * 对应 analysis.service.ts getAnalysisResult(resultId?) 的 Mock 分支
 */
export function mockGetAnalysisResult(
  _resultId?: string | null,
): AnalysisResult | null {
  if (_resultId === MOCK_CONFIRMED_RESULT.id) {
    return MOCK_CONFIRMED_RESULT
  }
  return mockAnalysisResult
}
