import { useDragResize } from '../../hooks/useDragResize'

interface ResizeHandleProps {
  edge: 'east' | 'west'
  value: number
  onChange: (next: number) => void
  min: number
  max: number
  title?: string
  onDoubleClick?: () => void
}

export function ResizeHandle({
  edge,
  value,
  onChange,
  min,
  max,
  title = '拖动调整宽度',
  onDoubleClick,
}: ResizeHandleProps) {
  const handlers = useDragResize({ edge, value, onChange, min, max })

  return (
    <div
      className={`resize-handle resize-handle--${edge}`}
      role="separator"
      aria-orientation="vertical"
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      title={title}
      onDoubleClick={onDoubleClick}
      {...handlers}
    />
  )
}
