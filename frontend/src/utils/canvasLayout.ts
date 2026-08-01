/**
 * Canvas 布局工具 - 使用 dagre 实现从左到右的水平布局
 *
 * 布局规则：
 * - 方向：LR (Left to Right)
 * - 第一层：决策问题节点（rank 0，最左边）
 * - 第二层：影响因素节点（rank 1，中间）
 * - 第三层：候选方案节点（rank 2，最右边）
 */

import dagre from 'dagre'
import { Position } from '@xyflow/react'
import type { FlowNode, FlowEdge } from '../types/flow'

/** 节点默认尺寸 */
const DEFAULT_NODE_WIDTH = 200
const DEFAULT_NODE_HEIGHT = 120

interface LayoutOptions {
  direction?: 'LR' | 'TB'
  nodeWidth?: number
  nodeHeight?: number
  rankSeparation?: number
  nodeSeparation?: number
}

const DEFAULT_OPTIONS: Required<LayoutOptions> = {
  direction: 'LR',
  nodeWidth: DEFAULT_NODE_WIDTH,
  nodeHeight: DEFAULT_NODE_HEIGHT,
  rankSeparation: 200,
  nodeSeparation: 80,
}

/**
 * 根据节点类型获取 dagre rank（层级）
 * - decision: rank 0 (最左边)
 * - factor: rank 1 (中间)
 * - option: rank 2 (最右边)
 */
function getNodeRank(node: FlowNode): number {
  switch (node.type) {
    case 'decision':
      return 0
    case 'factor':
      return 1
    case 'option':
      return 2
    default:
      return 1
  }
}

/**
 * 使用 dagre 对节点和边进行水平布局
 * @param nodes 原始节点数组
 * @param edges 原始边数组
 * @param options 布局选项
 * @returns 应用布局后的节点和边
 *
 * 布局规则：
 * - 已定位的节点：保留原有位置
 * - 未定位的节点：用 dagre 计算位置
 * - 所有节点都会设置 sourcePosition / targetPosition（用于连接线）
 */
export function applyDagreLayout<T extends FlowNode>(
  nodes: T[],
  edges: FlowEdge[],
  options: LayoutOptions = {},
): { nodes: T[]; edges: FlowEdge[] } {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const isHorizontal = opts.direction === 'LR'

  // 分离已定位和未定位的节点
  const positionedNodes: T[] = []
  const unpositionedNodes: T[] = []

  nodes.forEach((node) => {
    const hasPosition =
      node.position &&
      typeof node.position.x === 'number' &&
      typeof node.position.y === 'number' &&
      !isNaN(node.position.x) &&
      !isNaN(node.position.y)

    if (hasPosition) {
      positionedNodes.push(node)
    } else {
      unpositionedNodes.push(node)
    }
  })

  // source/target position（用于连接线）
  const targetPosition: Position = isHorizontal ? Position.Left : Position.Top
  const sourcePosition: Position = isHorizontal ? Position.Right : Position.Bottom

  // 如果所有节点都已定位，直接返回（保留位置）
  if (unpositionedNodes.length === 0) {
    console.log('[canvasLayout] 所有节点已定位，保留原有位置')
    return {
      nodes: nodes.map((node) => ({
        ...node,
        targetPosition,
        sourcePosition,
      })) as T[],
      edges,
    }
  }

  console.log('[canvasLayout] === 原始边数据 ===')
  edges.forEach(e => console.log(`  ${e.source} → ${e.target} (relation: ${e.relation})`))

  const dagreGraph = new dagre.graphlib.Graph()
  dagreGraph.setDefaultEdgeLabel(() => ({}))

  dagreGraph.setGraph({
    rankdir: opts.direction,
    ranksep: opts.rankSeparation,
    nodesep: opts.nodeSeparation,
    marginx: 50,
    marginy: 50,
    ranker: 'tight-tree',
  })

  // 添加已定位节点到 dagre 图（固定位置）
  positionedNodes.forEach((node) => {
    const rank = getNodeRank(node)
    console.log(`[canvasLayout] 节点 ${node.id} (type: ${node.type}) 已定位，保留位置`)
    dagreGraph.setNode(node.id, {
      width: opts.nodeWidth,
      height: opts.nodeHeight,
      minRank: rank,
      maxRank: rank,
      [isHorizontal ? 'x' : 'y']: node.position.x,
      [isHorizontal ? 'y' : 'x']: node.position.y,
    })
  })

  // 添加未定位节点到 dagre 图
  unpositionedNodes.forEach((node) => {
    const rank = getNodeRank(node)
    console.log(`[canvasLayout] 节点 ${node.id} (type: ${node.type}) 分配到 rank ${rank}`)
    dagreGraph.setNode(node.id, {
      width: opts.nodeWidth,
      height: opts.nodeHeight,
      minRank: rank,
      maxRank: rank,
    })
  })

  // 添加边到 dagre 图
  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target)
  })

  // 运行 dagre 布局
  dagre.layout(dagreGraph)

  // 打印 dagre 计算后的节点位置
  console.log('[canvasLayout] === dagre 布局后的节点位置 ===')
  nodes.forEach((node) => {
    const pos = dagreGraph.node(node.id)
    console.log(`  ${node.id} (${node.type}): x=${pos.x?.toFixed(0)}, y=${pos.y?.toFixed(0)}`)
  })

  // 映射节点位置：已定位保留，未定位用 dagre 计算
  const layoutedNodes = nodes.map((node) => {
    const hasPosition =
      node.position &&
      typeof node.position.x === 'number' &&
      typeof node.position.y === 'number' &&
      !isNaN(node.position.x) &&
      !isNaN(node.position.y)

    // 已定位节点：保留原有位置
    if (hasPosition) {
      return {
        ...node,
        targetPosition,
        sourcePosition,
      } as T
    }

    // 未定位节点：用 dagre 计算
    const nodeWithPosition = dagreGraph.node(node.id)
    return {
      ...node,
      targetPosition,
      sourcePosition,
      position: {
        x: nodeWithPosition.x - (opts.nodeWidth ?? DEFAULT_NODE_WIDTH) / 2,
        y: nodeWithPosition.y - (opts.nodeHeight ?? DEFAULT_NODE_HEIGHT) / 2,
      },
    } as T
  })

  return { nodes: layoutedNodes, edges }
}

/**
 * 初始布局函数：用于对新生成的节点进行布局
 * 保留用户手动调整的位置，只对未定位的节点进行布局
 */
export function layoutNewNodes<T extends FlowNode>(
  nodes: T[],
  edges: FlowEdge[],
  options: LayoutOptions = {},
): T[] {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const isHorizontal = opts.direction === 'LR'

  const dagreGraph = new dagre.graphlib.Graph()
  dagreGraph.setDefaultEdgeLabel(() => ({}))

  dagreGraph.setGraph({
    rankdir: opts.direction,
    ranksep: opts.rankSeparation,
    nodesep: opts.nodeSeparation,
    marginx: 50,
    marginy: 50,
  })

  // 分离已定位和未定位的节点
  const positionedNodes: T[] = []
  const unpositionedNodes: T[] = []

  nodes.forEach((node) => {
    // 检查节点是否有有效位置（position 不为 undefined 且 x/y 不为 NaN）
    const hasPosition =
      node.position &&
      typeof node.position.x === 'number' &&
      typeof node.position.y === 'number' &&
      !isNaN(node.position.x) &&
      !isNaN(node.position.y)

    if (hasPosition) {
      positionedNodes.push(node)
    } else {
      unpositionedNodes.push(node)
    }
  })

  // 对未定位节点进行布局
  if (unpositionedNodes.length === 0) {
    return nodes
  }

  // 将已定位节点添加到 dagre 图（用于计算布局参考）
  positionedNodes.forEach((node) => {
    dagreGraph.setNode(node.id, {
      width: opts.nodeWidth,
      height: opts.nodeHeight,
      [isHorizontal ? 'x' : 'y']: node.position?.x ?? 0,
      [isHorizontal ? 'y' : 'x']: node.position?.y ?? 0,
    })
  })

  // 添加未定位节点到 dagre 图
  unpositionedNodes.forEach((node) => {
    dagreGraph.setNode(node.id, {
      width: opts.nodeWidth,
      height: opts.nodeHeight,
    })
  })

  // 添加边到 dagre 图
  edges.forEach((edge) => {
    if (dagreGraph.hasNode(edge.source) && dagreGraph.hasNode(edge.target)) {
      dagreGraph.setEdge(edge.source, edge.target)
    }
  })

  // 运行 dagre 布局
  dagre.layout(dagreGraph)

  // 映射未定位节点的位置
  const layoutedNodes = nodes.map((node) => {
    const hasPosition =
      node.position &&
      typeof node.position.x === 'number' &&
      typeof node.position.y === 'number' &&
      !isNaN(node.position.x) &&
      !isNaN(node.position.y)

    if (hasPosition) {
      return node
    }

    const nodeWithPosition = dagreGraph.node(node.id)

    const targetPosition: Position = isHorizontal ? Position.Left : Position.Top
    const sourcePosition: Position = isHorizontal ? Position.Right : Position.Bottom

    return {
      ...node,
      targetPosition,
      sourcePosition,
      position: {
        x: nodeWithPosition.x - (opts.nodeWidth ?? DEFAULT_NODE_WIDTH) / 2,
        y: nodeWithPosition.y - (opts.nodeHeight ?? DEFAULT_NODE_HEIGHT) / 2,
      },
    } as T
  })

  return layoutedNodes
}
