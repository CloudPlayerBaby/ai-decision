import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react'

type ResizeEdge = 'east' | 'west'

interface UseDragResizeOptions {
  /** east: 拖右边增大宽度；west: 拖左边增大宽度 */
  edge: ResizeEdge
  value: number
  onChange: (next: number) => void
  min: number
  max: number
}

/**
 * 原生指针拖拽调宽，不引入额外依赖。
 */
export function useDragResize({
  edge,
  value,
  onChange,
  min,
  max,
}: UseDragResizeOptions) {
  const draggingRef = useRef(false)
  const startXRef = useRef(0)
  const startValueRef = useRef(value)

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      event.preventDefault()
      draggingRef.current = true
      startXRef.current = event.clientX
      startValueRef.current = value
      event.currentTarget.setPointerCapture(event.pointerId)
      document.body.classList.add('is-resizing')
    },
    [value],
  )

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!draggingRef.current) return
      const delta = event.clientX - startXRef.current
      const next =
        edge === 'east'
          ? startValueRef.current + delta
          : startValueRef.current - delta
      onChange(Math.min(max, Math.max(min, Math.round(next))))
    },
    [edge, max, min, onChange],
  )

  const endDrag = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (!draggingRef.current) return
    draggingRef.current = false
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    document.body.classList.remove('is-resizing')
  }, [])

  useEffect(() => {
    return () => {
      document.body.classList.remove('is-resizing')
    }
  }, [])

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
  }
}
