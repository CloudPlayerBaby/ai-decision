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
import type { FlowNode, FlowEdge, FactorFlowData } from '../types/flow'

/** 节点默认尺寸 */
const DEFAULT_NODE_WIDTH = 220
const DEFAULT_NODE_HEIGHT = 100

/** Factor 节点高度估算常量 */
const FACTOR_TITLE_HEIGHT = 20   // 标签 + 标题
const FACTOR_WEIGHT_HEIGHT = 20   // 权重行
const FACTOR_PADDING = 20        // 上下 padding
const FACTOR_LINE_HEIGHT = 18    // description 单行高度
const FACTOR_MAX_LINES = 4       // description 最多行数
const FACTOR_DESC_HEIGHT = FACTOR_LINE_HEIGHT * FACTOR_MAX_LINES // 72px
export const FACTOR_MIN_HEIGHT = FACTOR_TITLE_HEIGHT + FACTOR_WEIGHT_HEIGHT + FACTOR_DESC_HEIGHT + FACTOR_PADDING // 132px

/**
 * 估算单个节点的高度
 * - factor 节点：按 description 文字长度估算行数（最多 4 行）
 * - decision/option 节点：使用默认高度
 */
export function estimateNodeHeight(node: FlowNode): number {
  if (node.type === 'factor') {
    const description = (node.data as FactorFlowData).description ?? ''
    const charPerLine = 22 // 约 22 字符/行（220px 宽度减去 padding）
    const estimatedLines = Math.min(Math.ceil(description.length / charPerLine), FACTOR_MAX_LINES)
    const descHeight = estimatedLines * FACTOR_LINE_HEIGHT
    return FACTOR_TITLE_HEIGHT + FACTOR_WEIGHT_HEIGHT + descHeight + FACTOR_PADDING
  }
  if (node.type === 'option') {
    return 160 // option 节点固定高度（包含评分行）
  }
  return DEFAULT_NODE_HEIGHT // decision 节点
}

interface LayoutOptions {
  direction?: 'LR' | 'TB'
  nodeWidth?: number
  nodeHeight?: number
  rankSeparation?: number
  nodeSeparation?: number
  customHeightFn?: (node: FlowNode) => number
}

const DEFAULT_OPTIONS: Omit<Required<LayoutOptions>, 'customHeightFn'> & { customHeightFn?: (node: FlowNode) => number } = {
  direction: 'LR',
  nodeWidth: DEFAULT_NODE_WIDTH,
  nodeHeight: DEFAULT_NODE_HEIGHT,
  rankSeparation: 250,
  nodeSeparation: 100,
}

/**
 * 使用 dagre 对节点和边进行水平布局
 * 无论节点是否有位置，都会重新计算所有节点的位置
 */
export function applyDagreLayout<T extends FlowNode>(
  nodes: T[],
  edges: FlowEdge[],
  options: LayoutOptions = {},
): { nodes: T[]; edges: FlowEdge[] } {
  if (nodes.length === 0) {
    return { nodes, edges }
  }

  const opts = { ...DEFAULT_OPTIONS, ...options }
  const isHorizontal = opts.direction === 'LR'

  const dagreGraph = new dagre.graphlib.Graph()
  dagreGraph.setDefaultEdgeLabel(() => ({}))

  dagreGraph.setGraph({
    rankdir: opts.direction,
    ranksep: opts.rankSeparation,
    nodesep: opts.nodeSeparation,
    marginx: 80,
    marginy: 60,
    ranker: 'tight-tree',
  })

  // 添加所有节点到 dagre 图
  nodes.forEach((node) => {
    const height = opts.customHeightFn ? opts.customHeightFn(node) : opts.nodeHeight
    dagreGraph.setNode(node.id, {
      width: opts.nodeWidth,
      height,
    })
  })

  // 添加所有边到 dagre 图
  edges.forEach((edge) => {
    if (dagreGraph.hasNode(edge.source) && dagreGraph.hasNode(edge.target)) {
      dagreGraph.setEdge(edge.source, edge.target)
    }
  })

  // 运行 dagre 布局
  dagre.layout(dagreGraph)

  // 计算位置偏移：让第一列从 x=0 开始
  let minX = Infinity
  nodes.forEach((node) => {
    const pos = dagreGraph.node(node.id)
    if (pos && pos.x < minX) {
      minX = pos.x
    }
  })
  const offsetX = minX - opts.nodeWidth / 2 - 40 // 左边距

  // 更新节点位置
  const layoutedNodes = nodes.map((node) => {
    const nodePos = dagreGraph.node(node.id)
    if (!nodePos) {
      return node
    }

    return {
      ...node,
      position: {
        x: nodePos.x - offsetX - opts.nodeWidth / 2,
        y: nodePos.y - opts.nodeHeight / 2,
      },
      targetPosition: isHorizontal ? Position.Left : Position.Top,
      sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
    } as T
  })

  return { nodes: layoutedNodes, edges }
}

/**
 * 增量布局：只对新节点进行布局，保留已定位节点的位置
 */
export function layoutNewNodes<T extends FlowNode>(
  existingNodes: T[],
  newNodes: T[],
  edges: FlowEdge[],
  options: LayoutOptions = {},
): { nodes: T[]; edges: FlowEdge[] } {
  if (newNodes.length === 0) {
    return { nodes: existingNodes, edges }
  }

  const opts = { ...DEFAULT_OPTIONS, ...options }
  const isHorizontal = opts.direction === 'LR'

  const dagreGraph = new dagre.graphlib.Graph()
  dagreGraph.setDefaultEdgeLabel(() => ({}))

  dagreGraph.setGraph({
    rankdir: opts.direction,
    ranksep: opts.rankSeparation,
    nodesep: opts.nodeSeparation,
    marginx: 80,
    marginy: 60,
    ranker: 'tight-tree',
  })

  // 添加已存在节点（固定位置）
  existingNodes.forEach((node) => {
    const height = opts.customHeightFn ? opts.customHeightFn(node) : opts.nodeHeight
    dagreGraph.setNode(node.id, {
      width: opts.nodeWidth,
      height,
      [isHorizontal ? 'x' : 'y']: node.position.x + opts.nodeWidth / 2,
      [isHorizontal ? 'y' : 'x']: node.position.y + height / 2,
    })
  })

  // 添加新节点
  newNodes.forEach((node) => {
    const height = opts.customHeightFn ? opts.customHeightFn(node) : opts.nodeHeight
    dagreGraph.setNode(node.id, {
      width: opts.nodeWidth,
      height,
    })
  })

  // 添加边
  edges.forEach((edge) => {
    if (dagreGraph.hasNode(edge.source) && dagreGraph.hasNode(edge.target)) {
      dagreGraph.setEdge(edge.source, edge.target)
    }
  })

  // 运行布局
  dagre.layout(dagreGraph)

  // 计算新节点的位置
  const layoutedNewNodes = newNodes.map((node) => {
    const nodePos = dagreGraph.node(node.id)
    if (!nodePos) {
      return node
    }
    const height = opts.customHeightFn ? opts.customHeightFn(node) : opts.nodeHeight

    return {
      ...node,
      position: {
        x: nodePos.x - opts.nodeWidth / 2,
        y: nodePos.y - height / 2,
      },
      targetPosition: isHorizontal ? Position.Left : Position.Top,
      sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
    } as T
  })

  return {
    nodes: [...existingNodes, ...layoutedNewNodes],
    edges,
  }
}
