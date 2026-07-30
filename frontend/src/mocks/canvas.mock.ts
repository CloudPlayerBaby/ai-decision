/**
 * 画布 Mock 数据
 * 基于 docs/02-api-contract-v2.0.md API 契约 10.1 节
 *
 * 契约原则：
 * - pros/cons/risks 属于 AnalysisResult，不混入 Canvas.nodes[].data
 * - 根节点 data 为空对象 {}（对齐 10.1 示例）
 * - 方案节点 data 仅含 scores
 *
 * 前端展示所需的 pros/cons/risks、goal、constraints、
 * description 由 CanvasViewModel 单独注入，不在此 Mock 中存储
 */

import type { Canvas } from '../types/canvas'

export const mockCanvas: Canvas = {
  nodes: [
    // 决策问题节点 - data: {}（对齐 10.1 示例）
    {
      id: 'root',
      type: 'decision',
      position: { x: 24, y: 180 },
      data: {
        nodeType: 'decision',
        label: '优先学习 Redis 还是 Docker？',
      },
    },

    // 影响因素节点 - description 由 factorsDetail 注入
    {
      id: 'f_time',
      type: 'factor',
      position: { x: 300, y: 40 },
      data: {
        nodeType: 'factor',
        label: '时间成本',
        weight: 0.30,
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
      },
    },
    {
      id: 'f_practice',
      type: 'factor',
      position: { x: 300, y: 320 },
      data: {
        nodeType: 'factor',
        label: '项目实践',
        weight: 0.20,
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
      },
    },

    // 候选方案节点 - data 仅含 scores；pros/cons/risks 由 optionsDetail 注入
    {
      id: 'opt_docker',
      type: 'option',
      position: { x: 580, y: 40 },
      data: {
        nodeType: 'option',
        label: '优先学习 Docker',
        scores: {
          cost: 4,
          time: 4,
          benefit: 4,
          risk: 4,
          feasibility: 5,
        },
      },
    },
    {
      id: 'opt_redis',
      type: 'option',
      position: { x: 580, y: 200 },
      data: {
        nodeType: 'option',
        label: '优先学习 Redis',
        scores: {
          cost: 4,
          time: 4,
          benefit: 5,
          risk: 3,
          feasibility: 4,
        },
      },
    },
    {
      id: 'opt_both',
      type: 'option',
      position: { x: 580, y: 360 },
      data: {
        nodeType: 'option',
        label: '双轨轻量',
        scores: {
          cost: 3,
          time: 2,
          benefit: 4,
          risk: 4,
          feasibility: 3,
        },
      },
    },
    {
      id: 'opt_focus',
      type: 'option',
      position: { x: 580, y: 520 },
      data: {
        nodeType: 'option',
        label: '集中 Java',
        scores: {
          cost: 5,
          time: 5,
          benefit: 3,
          risk: 5,
          feasibility: 5,
        },
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
