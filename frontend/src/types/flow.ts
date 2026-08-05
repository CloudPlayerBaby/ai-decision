/**
 * Flow 层类型定义
 *
 * 原则：FlowNode/FlowEdge 仅供前端渲染使用，
 * 包含展示字段（goal/constraints/description/pros/cons/risks/isRecommended），
 * 不直接用于 Canvas API 保存。
 *
 * 保存时通过 canvasMapper.ts 中的 toCanvasNode / toCanvasEdge 转换为 API 类型。
 */

import type { Edge, Node } from '@xyflow/react'
import type { OptionScores, EdgeRelation } from './canvas'

/** 决策节点 Flow data */
export interface DecisionFlowData extends Record<string, unknown> {
  nodeType: 'decision'
  label: string
  /** 展示用，不回写 Canvas */
  goal: string
  constraints: string
}

/** 因素节点 Flow data */
export interface FactorFlowData extends Record<string, unknown> {
  nodeType: 'factor'
  label: string
  weight: number
  /** 展示用，不回写 Canvas */
  description: string
}

/** 方案节点 Flow data */
export interface OptionFlowData extends Record<string, unknown> {
  nodeType: 'option'
  label: string
  scores: OptionScores
  /** 展示用，不回写 Canvas */
  pros: string[]
  cons: string[]
  risks: string[]
  isRecommended: boolean
  /**
   * AI 推演生成的最相关 factor 节点 id（与 Canvas 顶层 relativeFactor 互为透传）。
   * 前端只读展示，不通过画布保存接口回写或修改。
   */
  relativeFactor?: string | null
}

/** Flow 节点联合 — 以 type 为判别字段 */
export type DecisionFlowNode = Node<DecisionFlowData, 'decision'>
export type FactorFlowNode = Node<FactorFlowData, 'factor'>
export type OptionFlowNode = Node<OptionFlowData, 'option'>

export type FlowNode = DecisionFlowNode | FactorFlowNode | OptionFlowNode

// 单独导出用于 NodeProps 泛型（满足 Node<NodeData> 约束）
export type DecisionFlowNodeForProps = DecisionFlowNode
export type FactorFlowNodeForProps = FactorFlowNode
export type OptionFlowNodeForProps = OptionFlowNode

/** Flow 边：Edge 顶层 + relation
 * - type 字段设为 relation 值（'HAS_FACTOR' | 'AFFECTS'），供 React Flow edgeTypes 匹配
 * - relation 字段保留业务语义
 */
export type FlowEdge = Edge & {
  relation: EdgeRelation
}
