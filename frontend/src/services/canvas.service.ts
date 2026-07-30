import { getData, putData } from '@/services/http'
import { isMockEnabled } from '@/services/config'
import { mockGetCanvas, mockSaveCanvas } from '@/mocks/canvas.mock'
import type { Canvas, SaveCanvasResponse } from '@/types/canvas'

function delay<T>(value: T, ms = 180): Promise<T> {
  return new Promise((resolve) => {
    window.setTimeout(() => resolve(value), ms)
  })
}

/** A 组画布读取入口 */
export async function getCanvas(decisionId: string): Promise<Canvas> {
  if (isMockEnabled()) {
    return delay(mockGetCanvas(decisionId))
  }
  return getData<Canvas>(`/decisions/${decisionId}/canvas`)
}

/** A 组整图保存；返回 changedNodeIds 供局部重推 */
export async function saveCanvas(
  decisionId: string,
  canvas: Canvas,
): Promise<SaveCanvasResponse> {
  if (isMockEnabled()) {
    return delay(mockSaveCanvas(decisionId, canvas))
  }
  return putData<SaveCanvasResponse>(`/decisions/${decisionId}/canvas`, canvas)
}
