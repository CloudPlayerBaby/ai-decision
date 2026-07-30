/**
 * 画布模块类型定义
 * 基于 docs/02-api-contract-v2.0.md API 契约
 *
 * 契约分层原则：
 * - Canvas API 类型（nodes/edges/position/score/weight）：严格对齐 10.1 节
 * - 展示类型（CanvasViewModel）：前端内部使用，含 pros/cons/risks/goal/constraints
 * - pros/cons/risks/goal/constraints 属于 AnalysisResult / DecisionProblem，
 *   不混入 Canvas nodes[].data，不通过画布保存接口回写
 */

/** 节点类型枚举 */
export type CanvasNodeType = 'decision' | 'factor' | 'option'

/** 边的关系类型 */
export type EdgeRelation = 'HAS_FACTOR' | 'AFFECTS' | string

/** 位置坐标 */
export interface Position {
  x: number
  y: number
}

/**
 * 决策问题节点数据
 * 仅含 title（作为 label），goal/constraints 归入 CanvasViewModel.decision
 */
export interface DecisionNodeData {
  nodeType: 'decision'
  label: string
}

/**
 * 影响因素节点数据
 * description 归入 CanvasViewModel.factorsDetail[id]
 */
export interface FactorNodeData {
  nodeType: 'factor'
  label: string
  /** 权重值 0-1，UI 展示为百分比 */
  weight: number
}

/**
 * 候选方案五维评分
 * 所有维度 1-5，5 为最优；risk 维度 5 表示低风险
 */
export interface OptionScores {
  cost: number
  time: number
  benefit: number
  risk: number
  feasibility: number
}

/**
 * 候选方案节点数据
 * 仅含 scores；pros/cons/risks 归入 CanvasViewModel.optionsDetail[id]
 */
export interface OptionNodeData {
  nodeType: 'option'
  label: string
  scores: OptionScores
}

/** 节点联合数据类型 */
export type CanvasNodeData = DecisionNodeData | FactorNodeData | OptionNodeData

/**
 * 画布节点
 * 基于 API 契约 10.1 节
 */
export interface CanvasNode {
  id: string
  type: CanvasNodeType
  position: Position
  data: CanvasNodeData
}

/**
 * 画布边
 * 基于 API 契约 10.1 节
 */
export interface CanvasEdge {
  id: string
  source: string
  target: string
  relation?: EdgeRelation
}

/**
 * 完整画布数据结构
 * 基于 API 契约 10.1 节
 */
export interface Canvas {
  nodes: CanvasNode[]
  edges: CanvasEdge[]
}

/**
 * 画布数据（前端内部通信用，非 API 契约）
 */
export interface CanvasData {
  nodes: CanvasNode[]
  edges: CanvasEdge[]
}

/**
 * 因素详情（来自 AnalysisResult.factors）
 * weight 已存在于 FactorNodeData，description 单独存放便于关联
 */
export interface FactorDetail {
  description: string
}

/**
 * 方案详情（来自 AnalysisResult.options）
 * pros/cons/risks 为推演生成的只读分析，不可通过画布保存接口回写
 */
export interface OptionDetail {
  pros: string[]
  cons: string[]
  risks: string[]
}

/**
 * 决策信息（来自 DecisionProblem）
 */
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
