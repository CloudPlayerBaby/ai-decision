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
  redistributeExistingWeightsForNewFactor,
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

// ── 新增因素：基于整数单位的精确比例分配 ───────────────────────

/** 权重单位：1%（1 单位 = 0.01，整数倍分配避免浮点误差） */
const WEIGHT_UNIT = 0.01
/** 1.0 = 100 个单位 */
const TOTAL_UNITS = 100
/** 5 单位 = 5%（下界） */
const MIN_UNITS = 5
/** 80 单位 = 80%（上界） */
const MAX_UNITS = 80

/**
 * 在 [minU, maxU] 区间内，将 `budget` 个整数单位按 `existingWeights` 的相对比例
 * 分配给 n 个已有因素。所有输出均为整数倍单位，分配后总和严格等于 `budget`。
 *
 * 算法核心：
 * 1. 按 existingWeights 的相对比例计算每个因素的"理论单位数"（浮点）；
 * 2. 若某因素理论值低于 minU，固定为 minU；若高于 maxU，固定为 maxU；
 * 3. 未固定的"自由"因素继续按当前权重比例分配剩余单位（迭代直到收敛）；
 * 4. 浮点收敛后，按"最大小数余数"规则取整并调整到精确等于 budget；
 * 5. 若任一阶段判定不可行（例如 `budget < n * minU` 或 `budget > n * maxU`），返回 null。
 *
 * 该函数是 redistributeExistingWeightsForNewFactor 的核心单元，单独导出便于测试。
 */
export function allocateUnitsProportionally(
  existingWeights: readonly number[],
  budget: number,
  minU: number = MIN_UNITS,
  maxU: number = MAX_UNITS,
): number[] | null {
  const n = existingWeights.length
  if (n === 0) return budget === 0 ? [] : null
  if (!Number.isFinite(budget) || budget < n * minU || budget > n * maxU) return null

  const existingTotal = existingWeights.reduce((s, w) => s + (Number.isFinite(w) ? w : 0), 0)

  // 1) 计算理论分配（浮点）
  let allocations: number[]
  if (existingTotal > 0) {
    allocations = existingWeights.map((w) => (budget * w) / existingTotal)
  } else {
    allocations = new Array<number>(n).fill(budget / n)
  }

  // 2) 迭代夹紧 + 重分配（与用户描述的"带上下限比例配平"对齐）
  const pinned = new Array<boolean>(n).fill(false)
  for (let iter = 0; iter < n + 5; iter++) {
    let clipped = false
    for (let i = 0; i < n; i++) {
      if (pinned[i]) continue
      if (allocations[i] < minU) {
        allocations[i] = minU
        pinned[i] = true
        clipped = true
      } else if (allocations[i] > maxU) {
        allocations[i] = maxU
        pinned[i] = true
        clipped = true
      }
    }
    if (!clipped) break

    let pinnedSum = 0
    let freeSum = 0
    for (let i = 0; i < n; i++) {
      if (pinned[i]) pinnedSum += allocations[i]
      else freeSum += allocations[i]
    }
    const free = allocations.map((_, i) => i).filter((i) => !pinned[i])
    if (free.length === 0) {
      return pinnedSum === budget ? allocations.slice() : null
    }
    const freeBudget = budget - pinnedSum
    if (freeBudget < 0) return null
    if (freeSum > 0) {
      const scale = freeBudget / freeSum
      for (const i of free) {
        allocations[i] *= scale
      }
    } else if (freeBudget === 0) {
      return null
    }
  }

  // 3) 整数化：先 floor 分配，再按"最大小数余数"补齐 remainder，
//    确保所有权重是 5% 整数倍且总和严格等于 budget。
  const floorAlloc = allocations.map((a) => Math.floor(a))
  const fractions = allocations.map((a, i) => a - floorAlloc[i])
  let remainder = budget - floorAlloc.reduce((s, a) => s + a, 0)

  const order = fractions
    .map((f, i) => ({ f, i }))
    .sort((a, b) => b.f - a.f || a.i - b.i)
    .map((x) => x.i)

  for (const i of order) {
    if (remainder <= 0) break
    if (floorAlloc[i] + 1 <= maxU) {
      floorAlloc[i] += 1
      remainder -= 1
    }
  }

  // 若 remainder > 0（被 maxU 限制），尝试从未达到上界的因素再补
  if (remainder > 0) {
    for (const i of order) {
      if (remainder <= 0) break
      if (floorAlloc[i] < maxU) {
        floorAlloc[i] += 1
        remainder -= 1
      }
    }
  }

  const intAlloc = floorAlloc
  if (remainder !== 0) return null
  if (intAlloc.some((a) => a < minU || a > maxU)) return null

  return intAlloc
}

/**
 * 计算在已有 n 个因素的情况下，新增一个因素时用户可选的最大权重（= 1 - n * 5%）。
 * 上限 80%，以确保其余因素至少保留 5%。
 */
export function computeMaxNewFactorWeight(existingFactorCount: number): number {
  if (existingFactorCount <= 0) return WEIGHT_MAX
  return Math.min(WEIGHT_MAX, 1 - existingFactorCount * WEIGHT_MIN)
}

/**
 * 新增因素时，按以下规则计算全部因素的最终权重：
 *
 * 1. 新因素的权重被强制保留（按用户输入，先 snap 到 5% 步长）；
 * 2. 其余已有因素按其当前权重比例共同分配剩余权重；
 * 3. 若比例分配导致某因素低于 5% 或高于 80%，固定在边界，剩余因素继续按比例分配；
 * 4. 所有结果均为 5% 整数倍，总和严格等于 100%；
 * 5. 理论上无法满足约束时返回 null（由调用方提示用户）。
 *
 * 实现要点：
 * - 以 5% 为单位进行整数运算，避免浮点误差；
 * - 调用方负责把 newFactorNode.data.weight 设置为返回结果中的 `newFactorWeight`；
 * - 返回 existingFactors 已就地更新为新权重。
 */
function redistributeExistingWeightsForNewFactor(
  existingFactors: FlowNode[],
  newFactorWeight: number,
): {
  existingFactors: FlowNode[]
  newFactorWeight: number
} | null {
  if (!Number.isFinite(newFactorWeight)) return null

  // 新因素权重：按 5% 步长 snap（保证严格保留用户输入并满足 5%~80% 边界）
  const newUnits = Math.max(MIN_UNITS, Math.min(MAX_UNITS, Math.round(newFactorWeight / WEIGHT_UNIT)))
  // 用 Math.round 消除 6 * 0.05 = 0.30000000000000004 这类浮点尾数
  const newFactorWeightSnapped = Math.round(newUnits * WEIGHT_UNIT * 1000) / 1000
  const budget = TOTAL_UNITS - newUnits
  if (budget < 0) return null

  // 空列表：仅返回 snap 后的新权重（理论上 UI 已拦截 0 因素场景）
  if (existingFactors.length === 0) {
    return { existingFactors: [], newFactorWeight: newFactorWeightSnapped }
  }

  const existingWeights = existingFactors.map((f) => getWeight(f))
  const allocations = allocateUnitsProportionally(existingWeights, budget, MIN_UNITS, MAX_UNITS)
  if (!allocations) return null

  const updatedExisting = existingFactors.map((f, i) => ({
    ...f,
    data: { ...f.data, weight: allocations[i] * WEIGHT_UNIT },
  })) as FlowNode[]

  return {
    existingFactors: updatedExisting,
    newFactorWeight: newFactorWeightSnapped,
  }
}

// ── 编辑已有因素：基于整数单位的精确比例分配 ─────────────────────

/**
 * 计算编辑某个已有因素时，该因素可设置的最小/最大权重。
 *
 * 规则：在其他 n-1 个因素都满足 [5%, 80%] 的前提下：
 *   min = max(0.05, 1 - (n-1) * 0.80)  // 其余全部分到 80%，自身留出最小值
 *   max = min(0.80, 1 - (n-1) * 0.05)  // 其余全部分到 5%，自身留下最大值
 *
 * 当 n=1 时返回 [1, 1]（唯一因素必须 100%）。
 */
export function computeEditableFactorRange(factorCount: number): {
  min: number
  max: number
} {
  if (factorCount <= 1) {
    return { min: WEIGHT_MAX, max: WEIGHT_MAX }
  }
  const otherCount = factorCount - 1
  const min = Math.max(WEIGHT_MIN, 1 - otherCount * WEIGHT_MAX)
  const max = Math.min(WEIGHT_MAX, 1 - otherCount * WEIGHT_MIN)
  return { min, max }
}

/**
 * 编辑某个已有因素的权重时，按以下规则重新配平所有因素：
 *
 * 1. 被编辑因素的权重被强制保留（按用户输入，先 snap 到 5% 步长，且在 [min, max] 内）；
 * 2. 其余已有因素按"编辑前各自的权重"作为相对比例分配剩余权重（避免滑动过程中反复取整产生漂移）；
 * 3. 若比例分配导致某因素低于 5% 或高于 80%，固定在边界，剩余因素继续按比例分配；
 * 4. 所有结果均为 5% 整数倍，总和严格等于 100%；
 * 5. 理论上无法满足约束时返回 null（由调用方提示用户）。
 *
 * 实现要点：
 * - 共用 allocateUnitsProportionally 作为新增/编辑/删除的核心算法单元；
 * - 必须传入"编辑前的其他因素权重快照"，否则连续滑动会导致其他因素之间的比例逐渐漂移；
 * - 返回值中的 editedNode 始终保持 newWeightSnapped（与用户输入严格一致）。
 */
export function rebalanceEditedFactor(
  factorNodes: FlowNode[],
  editedId: string,
  newWeight: number,
  /**
   * 其他因素"编辑前"的权重快照（用于比例分配的基准）。
   * 长度必须等于 factorNodes.length - 1，且按 factorNodes 中除 editedId 外的顺序排列。
   */
  otherSnapshotWeights?: readonly number[],
): {
  factorNodes: FlowNode[]
  editedWeight: number
} | null {
  if (!Number.isFinite(newWeight)) return null
  if (factorNodes.length === 0) return null

  const editedNode = factorNodes.find((n) => n.id === editedId)
  if (!editedNode) return null

  // 单因素情形：必须 100%，不参与比例配平
  if (factorNodes.length === 1) {
    const snapped = 1
    return {
      factorNodes: factorNodes.map((n) => ({
        ...n,
        data: { ...n.data, weight: snapped },
      })) as FlowNode[],
      editedWeight: snapped,
    }
  }

  // 1) snap 编辑权重到 5% 步长，并校验 [min, max] 范围
  const { min, max } = computeEditableFactorRange(factorNodes.length)
  const rawUnits = Math.round(newWeight / WEIGHT_UNIT)
  const clampedUnits = Math.max(
    Math.round(min / WEIGHT_UNIT),
    Math.min(Math.round(max / WEIGHT_UNIT), rawUnits),
  )
  const editedWeightSnapped = Math.round(clampedUnits * WEIGHT_UNIT * 1000) / 1000

  const editedUnits = clampedUnits
  const budget = TOTAL_UNITS - editedUnits
  if (budget < 0) return null

  // 2) 计算其他因素的"基准权重"：优先使用调用方传入的快照（避免连续滑动漂移）
  const otherNodes = factorNodes.filter((n) => n.id !== editedId)
  const otherBaseline =
    otherSnapshotWeights && otherSnapshotWeights.length === otherNodes.length
      ? Array.from(otherSnapshotWeights)
      : otherNodes.map((n) => getWeight(n))

  // 3) 调用共享的整数单位分配函数
  const allocations = allocateUnitsProportionally(otherBaseline, budget, MIN_UNITS, MAX_UNITS)
  if (!allocations) return null

  // 4) 组装返回结果：editedNode 严格保留 snapped，其他按 allocations 写入
  const updatedOthers = otherNodes.map((n, i) => ({
    ...n,
    data: { ...n.data, weight: allocations[i] * WEIGHT_UNIT },
  })) as FlowNode[]

  const editedNodeUpdated: FlowNode = {
    ...editedNode,
    data: { ...editedNode.data, weight: editedWeightSnapped },
  } as FlowNode

  const idToUpdated = new Map<string, FlowNode>()
  idToUpdated.set(editedNodeUpdated.id, editedNodeUpdated)
  for (const n of updatedOthers) {
    idToUpdated.set(n.id, n)
  }

  const result = factorNodes.map((n) => idToUpdated.get(n.id) ?? n)
  return { factorNodes: result, editedWeight: editedWeightSnapped }
}
