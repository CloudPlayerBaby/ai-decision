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
  console.log('[buildCanvasViewModel] called, analysisResult:', analysisResult)
  console.log('[buildCanvasViewModel] factors:', analysisResult?.factors)
  console.log('[buildCanvasViewModel] options:', analysisResult?.options)

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

  console.log('[buildCanvasViewModel] factorsDetail:', factorsDetail)
  console.log('[buildCanvasViewModel] optionsDetail:', optionsDetail)

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

export { toCanvasNode, toCanvasEdge, buildCanvasData, toFlowNode, toFlowNodes, buildCanvasViewModel, rebalanceWeights, redistributeWeightsOnDelete }

// ── 权重比例重分配 ──────────────────────────────────────────────

/**
 * 权重比例重分配算法。
 * 用户修改某个因素的权重后，其余因素按修改前的相对比例自动重新分配。
 *
 * 规则：
 * - 所有权重总和始终精确等于 1
 * - 单个因素时它固定为 1
 * - 其他因素按原比例分配，使用剩余值补齐保证总和为 1
 *
 * @param factorNodes  全部 factor 节点（FlowNode[]，type='factor'）
 * @param changedId   被用户修改的那个节点的 id
 * @param newWeight   用户输入的新权重值（0~1）
 * @returns 更新后的 factor 节点数组
 */
function rebalanceWeights(
  factorNodes: import('../types/flow').FlowNode[],
  changedId: string,
  newWeight: number,
): import('../types/flow').FlowNode[] {
  // 边界：单因素必须为 100%
  if (factorNodes.length === 1) {
    return factorNodes.map((n) => ({
      ...n,
      data: { ...n.data, weight: 1 },
    })) as import('../types/flow').FlowNode[]
  }

  // 截断至 [0, 1]
  const clampedWeight = Math.max(0, Math.min(1, newWeight))

  // 计算剩余权重（除目标节点外的其他节点）
  const others = factorNodes.filter((n) => n.id !== changedId)
  const othersSum = others.reduce((sum, n) => sum + ((n.data as { weight: number }).weight ?? 0), 0)

  if (othersSum === 0) {
    // 其他因素原权重总和为 0，平均分配
    const each = (1 - clampedWeight) / others.length
    return factorNodes.map((n) => ({
      ...n,
      data: {
        ...n.data,
        weight: n.id === changedId ? clampedWeight : each,
      },
    })) as import('../types/flow').FlowNode[]
  }

  // 逐个按比例分配，最后一个用剩余值补齐
  let remaining = 1 - clampedWeight
  return factorNodes.map((n, idx) => {
    if (n.id === changedId) {
      return { ...n, data: { ...n.data, weight: clampedWeight } }
    }
    // 最后一个（idx === factorNodes.length - 1）使用剩余值补齐
    const isLast = idx === factorNodes.length - 1
    const proportion = (n.data as { weight: number }).weight / othersSum
    const weight = isLast ? remaining : remaining * proportion
    remaining -= weight
    return { ...n, data: { ...n.data, weight: Math.max(0, weight) } }
  }) as import('../types/flow').FlowNode[]
}

/**
 * 删除因素后的权重重分配算法。
 * 将被删除因素的权重按比例分配给其余因素，使总和精确保持 1。
 *
 * 规则：
 * - 所有权重总和始终精确等于 1
 * - 单因素时禁止删除（由调用方保证）
 * - 其余因素按原权重比例分配
 * - 最后剩余因素用余数补齐，处理浮点误差
 * - 若剩余因素原权重总和为 0，则平均分配
 *
 * @param factorNodes  全部 factor 节点（FlowNode[]，type='factor'）
 * @param deletedId    被删除的那个节点的 id
 * @returns 更新后的 factor 节点数组（不包含被删除的节点）
 */
function redistributeWeightsOnDelete(
  factorNodes: import('../types/flow').FlowNode[],
  deletedId: string,
): import('../types/flow').FlowNode[] {
  // 过滤掉被删除的节点
  const remaining = factorNodes.filter((n) => n.id !== deletedId)

  // 边界：只剩一个因素时，它必须是 1
  if (remaining.length === 1) {
    return remaining.map((n) => ({
      ...n,
      data: { ...n.data, weight: 1 },
    })) as import('../types/flow').FlowNode[]
  }

  // 计算剩余因素的原始权重总和
  const remainingSum = remaining.reduce(
    (sum, n) => sum + ((n.data as { weight: number }).weight ?? 0),
    0,
  )

  if (remainingSum === 0) {
    // 原权重总和为 0，平均分配
    const each = 1 / remaining.length
    return remaining.map((n) => ({
      ...n,
      data: { ...n.data, weight: each },
    })) as import('../types/flow').FlowNode[]
  }

  // 按原权重比例分配，最后一个用余数补齐
  let left = 1
  return remaining.map((n, idx) => {
    const isLast = idx === remaining.length - 1
    const proportion = ((n.data as { weight: number }).weight ?? 0) / remainingSum
    const weight = isLast ? left : 1 * proportion
    left -= weight
    return {
      ...n,
      data: { ...n.data, weight: Math.max(0, weight) },
    }
  }) as import('../types/flow').FlowNode[]
}
