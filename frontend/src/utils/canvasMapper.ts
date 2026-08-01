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

/** 聚合页：决策 + 画布 + 分析结果 → CanvasViewModel */
function buildCanvasViewModel(
  decision: { id: string; title: string; goal?: string; constraints?: string },
  canvas: { nodes: import('../types/canvas').CanvasNode[]; edges: import('../types/canvas').CanvasEdge[] },
  analysisResult?: {
    factors?: Array<{ id: string; name: string; description?: string }>
    options?: Array<{
      id: string
      pros?: string[]
      cons?: string[]
      risks?: string[]
    }>
    recommendation?: { optionId?: string | null }
    canvas?: { nodes: import('../types/canvas').CanvasNode[]; edges: import('../types/canvas').CanvasEdge[] }
  },
): import('../types/canvas').CanvasViewModel {
  const factorsDetail: Record<string, FactorDetail> = {}
  if (analysisResult?.factors) {
    for (const f of analysisResult.factors) {
      factorsDetail[f.id] = { description: f.description ?? '' }
    }
  }

  const optionsDetail: Record<string, OptionDetail> = {}
  if (analysisResult?.options) {
    for (const o of analysisResult.options) {
      optionsDetail[o.id] = {
        pros: o.pros ?? [],
        cons: o.cons ?? [],
        risks: o.risks ?? [],
      }
    }
  }

  // 使用 canvasQuery 的 canvas（来自 GET /decisions/:id/canvas）
  // 注：analysisResult.canvas 可能包含后端生成的边，但前端只信任 canvasQuery 的数据
  return {
    decision: {
      id: decision.id,
      title: decision.title,
      goal: decision.goal ?? '',
      constraints: decision.constraints ?? '',
    },
    canvas: {
      nodes: canvas.nodes,
      edges: canvas.edges,
    },
    factorsDetail,
    optionsDetail,
    recommendedOptionId: analysisResult?.recommendation?.optionId ?? null,
  }
}

export { toCanvasNode, toCanvasEdge, buildCanvasData, toFlowNode, toFlowNodes, buildCanvasViewModel }
