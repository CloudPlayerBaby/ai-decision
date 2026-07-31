/**
 * 画布 Mock 数据
 * 基于 docs/02-api-contract-v2.0.md API 契约
 *
 * 注意：
 * 1. API 契约字段严格按文档定义
 * 2. 非 API 契约字段（如 recommendationBadge）需注释标注
 */

import type { Canvas, SaveCanvasResponse } from '@/types/canvas'

/**
 * 画布 Mock 数据
 * 符合 API 契约 10.1 节格式
 *
 * 字段说明：
 * - nodes[].id: 唯一标识，决策问题固定为 "root"，其他为后端生成
 * - nodes[].type: 节点类型
 * - nodes[].position: 画布坐标
 * - nodes[].data: 节点数据，按 type 不同包含不同字段
 *
 * - edges[].id: 唯一标识
 * - edges[].source: 源节点 id
 * - edges[].target: 目标节点 id
 * - edges[].relation: 关系类型（HAS_FACTOR=决策-因素，AFFECTS=因素-方案）
 */
export const mockCanvas: Canvas = {
  nodes: [
    // 决策问题节点 - 来自 DecisionProblem.title
    {
      id: 'root',
      type: 'decision',
      position: { x: 24, y: 180 },
      data: {
        nodeType: 'decision',
        label: '优先学习 Redis 还是 Docker？',
      },
    },

    // 影响因素节点 - 来自 AnalysisResult.factors
    {
      id: 'f_time',
      type: 'factor',
      position: { x: 300, y: 40 },
      data: {
        nodeType: 'factor',
        label: '时间成本',
        weight: 0.3,
        description: '每天 2 小时，共 14 小时可用',
      },
    },
    {
      id: 'f_benefit',
      type: 'factor',
      position: { x: 300, y: 180 },
      data: {
        nodeType: 'factor',
        label: '求职收益',
        weight: 0.35,
        description: '面试高频度与项目可展示性',
      },
    },
    {
      id: 'f_practice',
      type: 'factor',
      position: { x: 300, y: 320 },
      data: {
        nodeType: 'factor',
        label: '项目实践',
        weight: 0.2,
        description: '能否形成可验证成果',
      },
    },
    {
      id: 'f_difficulty',
      type: 'factor',
      position: { x: 300, y: 460 },
      data: {
        nodeType: 'factor',
        label: '学习难度',
        weight: 0.15,
        description: '入门曲线与概念复杂度',
      },
    },

    // 候选方案节点 - 来自 AnalysisResult.options
    {
      id: 'opt_docker',
      type: 'option',
      position: { x: 580, y: 40 },
      data: {
        nodeType: 'option',
        label: '方案 A：优先 Docker',
        scores: {
          cost: 4, // 成本低（Docker 免费）
          time: 4, // 学习周期适中
          benefit: 4, // 工程化收益高
          risk: 4, // 低风险
          feasibility: 5, // 实践性强，易上手
        },
        pros: ['工程化能力提升', 'Dockerfile 可写进简历', '面试有场景题'],
        cons: ['概念较抽象', '高频面试题偏场景化'],
        risks: ['缺少深度八股文储备'],
        // 仅用于前端演示，非 API 契约字段
        recommendationBadge: undefined,
      },
    },
    {
      id: 'opt_redis',
      type: 'option',
      position: { x: 580, y: 200 },
      data: {
        nodeType: 'option',
        label: '方案 B：优先 Redis',
        scores: {
          cost: 4, // 缓存场景明确
          time: 4, // 一周可入门
          benefit: 5, // 面试极高频
          risk: 3, // 缺少项目实践
          feasibility: 4, // 概念相对集中
        },
        pros: ['面试高频缓存考点', '八股文集中'],
        cons: ['缺少项目实践支撑', '深入原理需要更多时间'],
        risks: ['面试被追问项目细节可能露馅'],
        // 仅用于前端演示，非 API 契约字段
        recommendationBadge: '推荐',
      },
    },
    {
      id: 'opt_both',
      type: 'option',
      position: { x: 580, y: 360 },
      data: {
        nodeType: 'option',
        label: '方案 C：双轨轻量',
        scores: {
          cost: 3, // 时间分配有冲突
          time: 2, // 两边都要学，时间紧张
          benefit: 4, // 覆盖面广
          risk: 4, // 风险可控
          feasibility: 3, // 深度可能不足
        },
        pros: ['覆盖更广', '心态更从容'],
        cons: ['两周内深度不足', '每个都只学皮毛'],
        risks: ['面试深度追问可能失利'],
        // 仅用于前端演示，非 API 契约字段
        recommendationBadge: undefined,
      },
    },
    {
      id: 'opt_focus',
      type: 'option',
      position: { x: 580, y: 520 },
      data: {
        nodeType: 'option',
        label: '方案 D：集中 Java',
        scores: {
          cost: 5, // 专注已有基础
          time: 5, // 不额外学新技术
          benefit: 3, // 基础更扎实但缺少亮点
          risk: 5, // 低风险
          feasibility: 5, // 完全可行
        },
        pros: ['巩固 Java 基础', 'JVM/并发等深入话题更稳'],
        cons: ['无差异化优势', 'Docker/Redis 不会可能扣分'],
        risks: ['面试官问到加分项时哑火'],
        // 仅用于前端演示，非 API 契约字段
        recommendationBadge: undefined,
      },
    },
  ],

  edges: [
    // 决策 → 影响因素
    { id: 'e1', source: 'root', target: 'f_time', relation: 'HAS_FACTOR' },
    { id: 'e2', source: 'root', target: 'f_benefit', relation: 'HAS_FACTOR' },
    { id: 'e3', source: 'root', target: 'f_practice', relation: 'HAS_FACTOR' },
    { id: 'e4', source: 'root', target: 'f_difficulty', relation: 'HAS_FACTOR' },

    // 影响因素 → 候选方案
    { id: 'e5', source: 'f_time', target: 'opt_docker', relation: 'AFFECTS' },
    { id: 'e6', source: 'f_time', target: 'opt_redis', relation: 'AFFECTS' },
    { id: 'e7', source: 'f_time', target: 'opt_both', relation: 'AFFECTS' },
    { id: 'e8', source: 'f_time', target: 'opt_focus', relation: 'AFFECTS' },

    { id: 'e9', source: 'f_benefit', target: 'opt_redis', relation: 'AFFECTS' },
    { id: 'e10', source: 'f_benefit', target: 'opt_docker', relation: 'AFFECTS' },

    { id: 'e11', source: 'f_practice', target: 'opt_docker', relation: 'AFFECTS' },
    { id: 'e12', source: 'f_practice', target: 'opt_both', relation: 'AFFECTS' },

    { id: 'e13', source: 'f_difficulty', target: 'opt_focus', relation: 'AFFECTS' },
    { id: 'e14', source: 'f_difficulty', target: 'opt_redis', relation: 'AFFECTS' },
  ],
}

/** 兼容旧命名 */
export const MOCK_CANVAS = mockCanvas

let canvasStore: Canvas = structuredClone(mockCanvas)

export function mockGetCanvas(_decisionId: string): Canvas {
  return structuredClone(canvasStore)
}

export function mockSaveCanvas(
  _decisionId: string,
  canvas: Canvas,
): SaveCanvasResponse {
  const prevIds = new Set(canvasStore.nodes.map((n) => n.id))
  const changedNodeIds: string[] = []

  for (const node of canvas.nodes) {
    const prev = canvasStore.nodes.find((n) => n.id === node.id)
    if (
      !prev ||
      prev.position.x !== node.position.x ||
      prev.position.y !== node.position.y ||
      JSON.stringify(prev.data) !== JSON.stringify(node.data)
    ) {
      changedNodeIds.push(node.id)
    }
  }
  for (const id of prevIds) {
    if (!canvas.nodes.some((n) => n.id === id)) {
      changedNodeIds.push(id)
    }
  }

  canvasStore = structuredClone(canvas)
  return {
    changedNodeIds: changedNodeIds.length > 0 ? changedNodeIds : ['f_time'],
    canvas: structuredClone(canvasStore),
  }
}
