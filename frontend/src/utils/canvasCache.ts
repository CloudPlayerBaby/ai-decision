/**
 * Canvas 前端缓存工具
 * 存储策略：sessionStorage 优先 → 失败降级到内存 Map
 * - sessionStorage：刷新页面不丢失
 * - 内存 Map：sessionStorage 写失败时兜底（页面内刷新仍可恢复，关闭标签页丢失）
 * - 保存成功后清空 dirty 标记
 */

import type { Canvas } from '@/types/canvas'

const PREFIX = 'canvas_'

export interface CachedCanvas {
  canvas: Canvas
  /** 后端 canvas.version，用于冲突检测 */
  serverVersion: number
  /** 缓存时间戳 */
  cachedAt: number
}

/** 内存缓存兜底（sessionStorage 不可用时） */
const memoryCache = new Map<string, CachedCanvas>()

/** 读取缓存：优先 sessionStorage，降级到内存 Map */
export function readCanvasCache(decisionId: string): CachedCanvas | null {
  const key = PREFIX + decisionId
  try {
    const raw = sessionStorage.getItem(key)
    if (raw) {
      const parsed = JSON.parse(raw) as CachedCanvas
      if (parsed.canvas?.nodes && parsed.canvas?.edges) return parsed
    }
  } catch {
    // ignore
  }
  return memoryCache.get(key) ?? null
}

/** 写入缓存：优先 sessionStorage，失败降级到内存 Map */
export function writeCanvasCache(
  decisionId: string,
  canvas: Canvas,
  serverVersion: number,
): void {
  const key = PREFIX + decisionId
  const value: CachedCanvas = {
    canvas,
    serverVersion,
    cachedAt: Date.now(),
  }
  try {
    sessionStorage.setItem(key, JSON.stringify(value))
  } catch {
    memoryCache.set(key, value)
  }
}

/** 清除缓存：同时清理 sessionStorage 和内存 */
export function clearCanvasCache(decisionId: string): void {
  const key = PREFIX + decisionId
  try {
    sessionStorage.removeItem(key)
  } catch {
    // ignore
  }
  memoryCache.delete(key)
}

/**
 * 检测是否需要用后端数据覆盖本地缓存
 * @param serverCanvas 后端最新数据
 * @param serverVersion 后端 canvas.version
 * @param cached 本地缓存
 * @returns true = 后端更新了，需要丢弃本地；false = 保留本地
 */
export function isServerNewer(
  _serverCanvas: Canvas,
  serverVersion: number,
  cached: CachedCanvas,
): boolean {
  if (serverVersion === cached.serverVersion) return false
  return true
}

/** 从缓存的 canvas 构建 serverVersion（初次加载时无缓存，version 传 0） */
export function buildServerVersion(canvas: Canvas | undefined): number {
  return (canvas as Canvas & { version?: number })?.version ?? 0
}
