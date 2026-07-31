/**
 * 画布 Mock 数据
 * 基于 docs/02-api-contract-v2.0.md API 契约 10.1 节
 *
 * 契约原则：
 * - label 在 CanvasNode 顶层，不在 data 里
 * - decision 节点 data 为空对象 {}
 * - factor 节点 data 只有 weight
 * - option 节点 data 只有 scores
 * - pros/cons/risks 属于 AnalysisResult，不出现在 Canvas 中
 */

import type { Canvas } from '../types/canvas'

export const mockCanvas: Canvas = {
  nodes: [
    // 决策问题节点 - data: {}
    {
      id: 'root',
      type: 'decision',
      label: '优先学习 Redis 还是 Docker？',
      position: { x: 24, y: 180 },
      data: {},
    },

    // 影响因素节点 - data: { weight }
    {
      id: 'f_time',
      type: 'factor',
      label: '时间成本',
      position: { x: 300, y: 40 },
      data: { weight: 0.30 },
    },
    {
      id: 'f_benefit',
      type: 'factor',
      label: '求职收益',
      position: { x: 300, y: 180 },
      data: { weight: 0.35 },
    },
    {
      id: 'f_practice',
      type: 'factor',
      label: '项目实践',
      position: { x: 300, y: 320 },
      data: { weight: 0.20 },
    },
    {
      id: 'f_difficulty',
      type: 'factor',
      label: '学习难度',
      position: { x: 300, y: 460 },
      data: { weight: 0.15 },
    },

    // 候选方案节点 - data: { scores }
    {
      id: 'opt_docker',
      type: 'option',
      label: '优先学习 Docker',
      position: { x: 580, y: 40 },
      data: {
        scores: { cost: 4, time: 4, benefit: 4, risk: 4, feasibility: 5 },
      },
    },
    {
      id: 'opt_redis',
      type: 'option',
      label: '优先学习 Redis',
      position: { x: 580, y: 200 },
      data: {
        scores: { cost: 4, time: 4, benefit: 5, risk: 3, feasibility: 4 },
      },
    },
    {
      id: 'opt_both',
      type: 'option',
      label: '双轨轻量',
      position: { x: 580, y: 360 },
      data: {
        scores: { cost: 3, time: 2, benefit: 4, risk: 4, feasibility: 3 },
      },
    },
    {
      id: 'opt_focus',
      type: 'option',
      label: '集中 Java',
      position: { x: 580, y: 520 },
      data: {
        scores: { cost: 5, time: 5, benefit: 3, risk: 5, feasibility: 5 },
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
