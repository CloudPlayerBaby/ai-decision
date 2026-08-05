/**
 * Canvas API 类型定义
 * 基于 docs/02-api-contract-v2.0.md 契约 10.1 节
 *
 * 原则：严格对齐 API 契约，不混入展示字段。
 * 展示字段（goal/constraints/description/pros/cons/risks）属于 Flow 层，
 * 不出现在 CanvasNode 中，也不通过画布保存接口回写。
 */

/** 节点类型枚举 */
export type CanvasNodeType = 'decision' | 'factor' | 'option'

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
  /**
   * AI 推演生成的最相关 factor 节点 id。
   * - 位于 option 节点顶层（不在 data 内），与 API 契约保持一致
   * - 类型：string | null | undefined
   * - 字段由后端/AI 写入，前端只读展示，不通过画布保存接口回写或修改
   * - 用于在画布上高亮「最相关因素连线」
   */
  relativeFactor?: string | null
}

export type CanvasNode = DecisionCanvasNode | FactorCanvasNode | OptionCanvasNode

/** Canvas 边 */
/** @deprecated 使用 Position；保留别名以兼容服务层命名 */
export type CanvasPosition = Position

/**
 * 决策问题节点数据
 * 来自 DecisionProblem.title
 */
export interface DecisionNodeData {
  /** 节点类型标识 */
  nodeType: 'decision'
  /** 决策问题标题 */
  label: string
}

/**
 * 影响因素节点数据
 * 来自 AnalysisResult.factors
 */
export interface FactorNodeData {
  /** 节点类型标识 */
  nodeType: 'factor'
  /** 因素名称 */
  label: string
  /** 权重值 0-1，UI 展示为百分比 */
  weight: number
  /** 因素描述 */
  description?: string
}

/**
 * 候选方案五维评分
 * 来自 AnalysisResult.options[].scores
 * 所有维度 1-5，5 为最优；risk 维度 5 表示低风险
 */
export interface OptionScores {
  cost: number // 成本（1=高成本，5=低成本）
  time: number // 时间（1=耗时久，5=耗时短）
  benefit: number // 收益（1=收益低，5=收益高）
  risk: number // 风险（1=高风险，5=低风险）
  feasibility: number // 可行性（1=难实现，5=易实现）
}

/**
 * 候选方案节点数据
 * 来自 AnalysisResult.options
 */
export interface OptionNodeData {
  /** 节点类型标识 */
  nodeType: 'option'
  /** 方案名称 */
  label: string
  /** 五维评分 */
  scores: OptionScores
  /** 优点列表 */
  pros?: string[]
  /** 缺点列表 */
  cons?: string[]
  /** 风险列表 */
  risks?: string[]
  /**
   * 推荐标识
   * 仅用于前端演示，非 API 契约字段
   */
  recommendationBadge?: string
}

/** 节点联合数据类型 */
export type CanvasNodeData = DecisionNodeData | FactorNodeData | OptionNodeData

export interface CanvasData {
  nodes: CanvasNode[]
  edges: CanvasEdge[]
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

/** Canvas 数据 */
/**
 * 完整画布数据结构
 * 基于 API 契约 10.1 节
 */
export interface Canvas {
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

/** PUT /decisions/{id}/canvas 响应 */
export interface SaveCanvasResponse {
  changedNodeIds: string[]
  canvas: Canvas
}
