/**
 * Canvas ↔ Flow 双向转换
 *
 * 原则：
 * - 纯函数，不导入 mockCanvas / 组件状态 / UI 组件
 * - Flow → Canvas：白名单投影，丢弃所有展示字段
 * - Canvas → Flow：注入展示字段（goal/constraints/description/pros/cons/risks）
 * - switch 使用穷举检查，新增节点类型时 TS 会报编译错误
 */

import type {
  CanvasNode,
  DecisionCanvasNode,
  FactorCanvasNode,
  OptionCanvasNode,
  CanvasEdge,
  CanvasData,
  FactorDetail,
  OptionDetail,
  DecisionInfo,
} from '../types/canvas'
import type {
  DecisionFlowNode,
  FactorFlowNode,
  OptionFlowNode,
  FlowNode,
  FlowEdge,
} from '../types/flow'

// ── Flow → Canvas ────────────────────────────────────────────

function decisionToCanvas(node: DecisionFlowNode): DecisionCanvasNode {
  return {
    id: node.id,
    type: 'decision',
    label: node.data.label,
    position: node.position,
    data: {},
  }
}

function factorToCanvas(node: FactorFlowNode): FactorCanvasNode {
  return {
    id: node.id,
    type: 'factor',
    label: node.data.label,
    position: node.position,
    data: { weight: node.data.weight },
  }
}

function optionToCanvas(node: OptionFlowNode): OptionCanvasNode {
  return {
    id: node.id,
    type: 'option',
    label: node.data.label,
    position: node.position,
    data: { scores: node.data.scores },
  }
}

/** FlowNode → CanvasNode（switch 穷举检查） */
function toCanvasNode(node: FlowNode): CanvasNode {
  switch (node.type) {
    case 'decision':
      return decisionToCanvas(node as DecisionFlowNode)
    case 'factor':
      return factorToCanvas(node as FactorFlowNode)
    case 'option':
      return optionToCanvas(node as OptionFlowNode)
    default: {
      const _exhaustive = node
      throw new Error(`toCanvasNode: unhandled node type ${_exhaustive}`)
    }
  }
}

/** FlowEdge → CanvasEdge */
function toCanvasEdge(edge: FlowEdge): CanvasEdge {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    relation: edge.relation,
  }
}

/** 构建完整保存 payload */
function buildCanvasData(nodes: FlowNode[], edges: FlowEdge[]): CanvasData {
  return {
    nodes: nodes.map(toCanvasNode),
    edges: edges.map(toCanvasEdge),
  }
}

// ── Canvas → Flow ────────────────────────────────────────────

function decisionToFlow(node: DecisionCanvasNode, info?: DecisionInfo): DecisionFlowNode {
  return {
    id: node.id,
    type: 'decision',
    position: node.position,
    data: {
      nodeType: 'decision',
      label: node.label,
      goal: info?.goal ?? '',
      constraints: info?.constraints ?? '',
    },
  }
}

function factorToFlow(node: FactorCanvasNode, detail?: FactorDetail): FactorFlowNode {
  return {
    id: node.id,
    type: 'factor',
    position: node.position,
    data: {
      nodeType: 'factor',
      label: node.label,
      weight: node.data.weight,
      description: detail?.description ?? '',
    },
  }
}

function optionToFlow(
  node: OptionCanvasNode,
  detail?: OptionDetail,
  isRecommended?: boolean,
): OptionFlowNode {
  return {
    id: node.id,
    type: 'option',
    position: node.position,
    data: {
      nodeType: 'option',
      label: node.label,
      scores: node.data.scores,
      pros: detail?.pros ?? [],
      cons: detail?.cons ?? [],
      risks: detail?.risks ?? [],
      isRecommended: isRecommended ?? false,
    },
  }
}

/** CanvasNode → FlowNode（switch 穷举检查） */
function toFlowNode(
  node: CanvasNode,
  opts?: {
    factorsDetail?: Record<string, FactorDetail>
    optionsDetail?: Record<string, OptionDetail>
    recommendedOptionId?: string | null
    decisionInfo?: DecisionInfo
  },
): FlowNode {
  switch (node.type) {
    case 'decision':
      return decisionToFlow(node as DecisionCanvasNode, opts?.decisionInfo)
    case 'factor':
      return factorToFlow(node as FactorCanvasNode, opts?.factorsDetail?.[node.id])
    case 'option':
      return optionToFlow(
        node as OptionCanvasNode,
        opts?.optionsDetail?.[node.id],
        node.id === opts?.recommendedOptionId,
      )
    default: {
      const _exhaustive: never = node
      throw new Error(`toFlowNode: unhandled node type ${_exhaustive}`)
    }
  }
}

/** 批量转换 Canvas → Flow */
function toFlowNodes(
  nodes: CanvasNode[],
  opts?: Parameters<typeof toFlowNode>[1],
): FlowNode[] {
  return nodes.map((n) => toFlowNode(n, opts))
}

export { toCanvasNode, toCanvasEdge, buildCanvasData, toFlowNode, toFlowNodes }
