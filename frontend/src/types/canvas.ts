/** 业务画布模型（对齐接口手册 v2.0 §10；独立于 React Flow 内部字段） */

export type CanvasNodeType = 'decision' | 'factor' | 'option' | string

export interface CanvasPosition {
  x: number
  y: number
}

export interface CanvasNode {
  id: string
  type: CanvasNodeType
  label: string
  position: CanvasPosition
  data: Record<string, unknown>
}

export interface CanvasEdge {
  id: string
  source: string
  target: string
  relation?: string
}

export interface Canvas {
  nodes: CanvasNode[]
  edges: CanvasEdge[]
}

export interface SaveCanvasResponse {
  changedNodeIds: string[]
  canvas: Canvas
}
