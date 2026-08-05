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
    // 透传 AI 生成的最相关 factor id；undefined/null/string 均原样保留
    relativeFactor: node.data.relativeFactor,
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
      // 透传后端返回的 relativeFactor 到 Flow data，供 AffectsEdge 读取
      relativeFactor: node.relativeFactor,
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

export {
  toCanvasNode,
  toCanvasEdge,
  buildCanvasData,
  toFlowNode,
  toFlowNodes,
  buildCanvasViewModel,
  rebalanceWeights,
  redistributeWeightsOnDelete,
  redistributeWeightsOnAdd,
  rebalanceWithNewFactor,
}

// ── 权重边界常量 ──────────────────────────────────────────────

const WEIGHT_MIN = 0.05   // 5%
const WEIGHT_MAX = 0.80   // 80%

function getWeight(node: FlowNode): number {
  return ((node.data as { weight: number }).weight ?? 0)
}

// ── 带上下限的权重配平核心算法 ─────────────────────────────────

/**
 * 通用带边界约束的权重配平。
 * 使用迭代法：每次分配时碰到边界则固定该项，继续分配剩余权重。
 * @param targetWeights 目标权重（部分 key 可缺失）
 * @param ids 全部参与配平的节点 id 顺序（用于确定最后一项吸收误差）
 */
function boundedRebalanceImpl(
  nodes: FlowNode[],
  targetWeights: Partial<Record<string, number>>,
): FlowNode[] {
  const n = nodes.length
  if (n === 0) return []

  // 初始化权重
  const weights: Record<string, number> = {}
  nodes.forEach((node) => { weights[node.id] = getWeight(node) })

  // 应用目标权重（截断到边界）
  for (const id of Object.keys(targetWeights)) {
    if (id in weights) {
      weights[id] = Math.max(WEIGHT_MIN, Math.min(WEIGHT_MAX, targetWeights[id]!))
    }
  }

  // 迭代直到收敛或达到最大次数
  for (let iter = 0; iter < n * 3; iter++) {
    const total = Object.values(weights).reduce((s, w) => s + w, 0)
    const delta = 1 - total

    if (Math.abs(delta) < 1e-10) break

    // 找出"自由"节点（不在边界上的）
    const free = nodes.filter((node) => {
      const w = weights[node.id]
      return w > WEIGHT_MIN + 1e-10 && w < WEIGHT_MAX - 1e-10
    })

    if (free.length === 0) {
      // 全被固定，强制修正最后一个
      const last = nodes[nodes.length - 1]
      weights[last.id] = Math.max(WEIGHT_MIN, Math.min(WEIGHT_MAX, weights[last.id] + delta))
      break
    }

    // 计算自由节点当前权重总和
    const freeSum = free.reduce((s, node) => s + weights[node.id], 0)

    // 按比例分配 delta
    for (const node of free) {
      const prop = freeSum > 0 ? weights[node.id] / freeSum : 1 / free.length
      const newW = weights[node.id] + delta * prop

      if (newW < WEIGHT_MIN) {
        // 固定在 MIN
        weights[node.id] = WEIGHT_MIN
      } else if (newW > WEIGHT_MAX) {
        // 固定在 MAX
        weights[node.id] = WEIGHT_MAX
      } else {
        weights[node.id] = newW
      }
    }

    // 检查是否收敛：所有自由节点要么在边界内，要么刚被固定
    const stillFree = nodes.filter((node) => {
      const w = weights[node.id]
      return w > WEIGHT_MIN + 1e-10 && w < WEIGHT_MAX - 1e-10
    })
    if (stillFree.length === free.length) break
  }

  // 归一化处理浮点误差：总和精确为 1
  const total = Object.values(weights).reduce((s, w) => s + w, 0)
  if (Math.abs(total - 1) > 1e-10 && total > 0) {
    const scale = 1 / total
    for (const id of Object.keys(weights)) {
      weights[id] *= scale
    }
  }

  return nodes.map((node) => ({
    ...node,
    data: { ...node.data, weight: weights[node.id] ?? getWeight(node) },
  })) as FlowNode[]
}

// ── 权重重分配 API ────────────────────────────────────────────

/**
 * 用户修改某个因素的权重后，其余因素按修改前的相对比例重新分配。
 * 遵循 5%-80% 边界限制。
 */
function rebalanceWeights(
  factorNodes: FlowNode[],
  changedId: string,
  newWeight: number,
): FlowNode[] {
  if (factorNodes.length === 0) return []
  if (factorNodes.length === 1) {
    return factorNodes.map((node) => ({
      ...node,
      data: { ...node.data, weight: 1 },
    })) as FlowNode[]
  }

  return boundedRebalanceImpl(factorNodes, { [changedId]: newWeight })
}

/**
 * 删除因素后的权重重分配。
 * 被删除因素的权重按比例分配给其余因素。
 * 遵循 5%-80% 边界限制。
 */
function redistributeWeightsOnDelete(
  factorNodes: FlowNode[],
  deletedId: string,
): FlowNode[] {
  const remaining = factorNodes.filter((n) => n.id !== deletedId)
  if (remaining.length === 0) return []
  if (remaining.length === 1) {
    return remaining.map((node) => ({
      ...node,
      data: { ...node.data, weight: 1 },
    })) as FlowNode[]
  }

  // 被删除因素的权重
  const deletedNode = factorNodes.find((n) => n.id === deletedId)
  const deletedWeight = deletedNode ? getWeight(deletedNode) : 0

  // 其余因素按比例分配 deletedWeight
  const remainingSum = remaining.reduce((s, node) => s + getWeight(node), 0)

  const targetWeights: Partial<Record<string, number>> = {}
  for (const node of remaining) {
    if (remainingSum > 0) {
      const prop = getWeight(node) / remainingSum
      targetWeights[node.id] = getWeight(node) + deletedWeight * prop
    } else {
      // 原权重都为 0，平均分配
      targetWeights[node.id] = 1 / remaining.length
    }
  }

  return boundedRebalanceImpl(remaining, targetWeights)
}

/**
 * 新增因素后，所有因素平均分配权重。
 * 遵循 5%-80% 边界限制。
 */
function redistributeWeightsOnAdd(
  factorNodes: FlowNode[],
  _newId: string,
): FlowNode[] {
  if (factorNodes.length === 0) return []
  if (factorNodes.length === 1) {
    return factorNodes.map((node) => ({
      ...node,
      data: { ...node.data, weight: 1 },
    })) as FlowNode[]
  }

  // 全部平均分配
  const targetWeights: Partial<Record<string, number>> = {}
  for (const node of factorNodes) {
    targetWeights[node.id] = 1 / factorNodes.length
  }

  return boundedRebalanceImpl(factorNodes, targetWeights)
}

/**
 * 新增因素时，其余已有因素按比例配平剩余权重。
 * @param existingFactors 已有因素节点（不包含新节点）
 * @param newFactorWeight 用户选定的新因素权重（0~1）
 * @returns 全部因素节点（新 + 旧），权重和严格为 1，无 NaN/负数
 */
function rebalanceWithNewFactor(
  existingFactors: FlowNode[],
  newFactorWeight: number,
): FlowNode[] {
  if (existingFactors.length === 0) return []

  const clamped = Math.max(WEIGHT_MIN, Math.min(WEIGHT_MAX, newFactorWeight))
  const remaining = 1 - clamped

  if (existingFactors.length === 1) {
    return existingFactors.map((node) => ({
      ...node,
      data: { ...node.data, weight: remaining },
    })) as FlowNode[]
  }

  // 已有因素按当前相对比例分配 remaining
  const currentSum = existingFactors.reduce((s, n) => s + getWeight(n), 0)
  const targetWeights: Partial<Record<string, number>> = {}
  for (const node of existingFactors) {
    const prop = currentSum > 0 ? getWeight(node) / currentSum : 1 / existingFactors.length
    targetWeights[node.id] = clamped + remaining * prop
  }

  return boundedRebalanceImpl(existingFactors, targetWeights)
}
