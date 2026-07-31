import { useEffect } from 'react'
import { useLayoutStore } from '@/stores/layoutStore'

/**
 * 监听视口宽度，钳制左右栏并在过窄时自动收起。
 * 避免窗口缩放时左右栏固定像素把中间内容挤没。
 */
export function LayoutViewportSync() {
  const syncToViewport = useLayoutStore((state) => state.syncToViewport)

  useEffect(() => {
    let frame = 0

    const run = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        syncToViewport(window.innerWidth)
      })
    }

    run()
    window.addEventListener('resize', run)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', run)
    }
  }, [syncToViewport])

  return null
}
