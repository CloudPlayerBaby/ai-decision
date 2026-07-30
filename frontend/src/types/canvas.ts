/**
 * 画布模块类型定义
 * 基于 docs/02-api-contract-v2.0.md API 契约
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
  cost: number        // 成本（1=高成本，5=低成本）
  time: number        // 时间（1=耗时久，5=耗时短）
  benefit: number     // 收益（1=收益低，5=收益高）
  risk: number        // 风险（1=高风险，5=低风险）
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
 * 用于 DecisionCanvasPanel → DecisionDetailPage 数据传递
 * 结构与 Canvas 接口一致，但用途不同
 */
export interface CanvasData {
  nodes: CanvasNode[]
  edges: CanvasEdge[]
}
