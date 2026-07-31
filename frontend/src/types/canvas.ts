/**
 * Canvas API 类型定义
 * 基于 docs/02-api-contract-v2.0.md 契约 10.1 节
 *
 * 原则：严格对齐 API 契约，不混入展示字段。
 * 展示字段（goal/constraints/description/pros/cons/risks）属于 Flow 层，
 * 不出现在 CanvasNode 中，也不通过画布保存接口回写。
 */

/** 位置坐标 */
export interface Position {
  x: number
  y: number
}

/** 边的关系类型 */
export type EdgeRelation = 'HAS_FACTOR' | 'AFFECTS' | string

/** 候选方案五维评分（1-5，5 为最优；risk 维度 5 表示低风险） */
export interface OptionScores {
  cost: number
  time: number
  benefit: number
  risk: number
  feasibility: number
}

/** 决策问题节点 data（契约 10.1 为空对象） */
export interface DecisionCanvasData extends Record<string, never> {}

/** 影响因素节点 data（契约 10.1 只有 weight） */
export interface FactorCanvasData {
  weight: number
}

/** 候选方案节点 data（契约 10.1 只有 scores） */
export interface OptionCanvasData {
  scores: OptionScores
}

/** Canvas 节点 — 判别联合，以 type 为判别字段 */
export type DecisionCanvasNode = {
  id: string
  type: 'decision'
  label: string
  position: Position
  data: DecisionCanvasData
}

export type FactorCanvasNode = {
  id: string
  type: 'factor'
  label: string
  position: Position
  data: FactorCanvasData
}

export type OptionCanvasNode = {
  id: string
  type: 'option'
  label: string
  position: Position
  data: OptionCanvasData
}

export type CanvasNode = DecisionCanvasNode | FactorCanvasNode | OptionCanvasNode

/** Canvas 边 */
export interface CanvasEdge {
  id: string
  source: string
  target: string
  relation: EdgeRelation
}

/** Canvas 数据 */
export interface Canvas {
  nodes: CanvasNode[]
  edges: CanvasEdge[]
}

export interface CanvasData {
  nodes: CanvasNode[]
  edges: CanvasEdge[]
}

/** 因素详情（来自 AnalysisResult.factors） */
export interface FactorDetail {
  description: string
}

/** 方案详情（来自 AnalysisResult.options） */
export interface OptionDetail {
  pros: string[]
  cons: string[]
  risks: string[]
}

/** 决策信息（来自 DecisionProblem） */
export interface DecisionInfo {
  id: string
  title: string
  goal: string
  constraints: string
}

/**
 * 画布展示模型
 * 由 DecisionProblem + AnalysisResult + Canvas 三份接口数据合并组装
 *
 * factorsDetail：key = factor 节点 id，value = AnalysisResult.factors[].description
 * optionsDetail：key = option 节点 id，value = AnalysisResult.options 的 pros/cons/risks
 */
export interface CanvasViewModel {
  decision: DecisionInfo
  canvas: Canvas
  factorsDetail: Record<string, FactorDetail>
  optionsDetail: Record<string, OptionDetail>
  /** AI 推荐方案 id，由 recommendation.optionId === option.id 派生 */
  recommendedOptionId: string | null
}
