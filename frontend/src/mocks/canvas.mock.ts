import type { Canvas, SaveCanvasResponse } from '@/types/canvas'

export const MOCK_CANVAS: Canvas = {
  nodes: [
    {
      id: 'root',
      type: 'decision',
      label: '优先学习 Redis 还是 Docker',
      position: { x: 360, y: 40 },
      data: {},
    },
    {
      id: 'f_time',
      type: 'factor',
      label: '时间成本',
      position: { x: 140, y: 180 },
      data: { weight: 0.3 },
    },
    {
      id: 'f_benefit',
      type: 'factor',
      label: '求职收益',
      position: { x: 360, y: 180 },
      data: { weight: 0.35 },
    },
    {
      id: 'opt_redis',
      type: 'option',
      label: '优先学习 Redis',
      position: { x: 420, y: 340 },
      data: {
        scores: { cost: 4, time: 4, benefit: 5, risk: 3, feasibility: 4 },
      },
    },
    {
      id: 'opt_docker',
      type: 'option',
      label: '优先学习 Docker',
      position: { x: 200, y: 340 },
      data: {
        scores: { cost: 3, time: 3, benefit: 4, risk: 4, feasibility: 4 },
      },
    },
  ],
  edges: [
    { id: 'e1', source: 'root', target: 'f_time', relation: 'HAS_FACTOR' },
    { id: 'e2', source: 'root', target: 'f_benefit', relation: 'HAS_FACTOR' },
    { id: 'e3', source: 'f_time', target: 'opt_docker', relation: 'AFFECTS' },
    { id: 'e4', source: 'f_benefit', target: 'opt_redis', relation: 'AFFECTS' },
  ],
}

let canvasStore: Canvas = structuredClone(MOCK_CANVAS)

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
      JSON.stringify(prev.data) !== JSON.stringify(node.data) ||
      prev.label !== node.label
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
