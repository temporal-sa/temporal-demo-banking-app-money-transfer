import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'

interface ResizeHandleProps {
  label: string
  /** Called with the total horizontal drag distance (px) since the drag began. */
  onDrag: (deltaX: number) => void
  onDragStart: () => void
  onReset: () => void
  value: number
}

const KEY_STEP = 24

export function ResizeHandle({ label, onDrag, onDragStart, onReset, value }: ResizeHandleProps) {
  const startX = useRef<number | null>(null)
  const [dragging, setDragging] = useState(false)

  const endDrag = () => {
    startX.current = null
    setDragging(false)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    startX.current = event.clientX
    setDragging(true)
    onDragStart()
    // Keep the resize cursor and suppress text selection while dragging over the panels.
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (startX.current === null) return
    onDrag(event.clientX - startX.current)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    onDragStart()
    onDrag(event.key === 'ArrowLeft' ? -KEY_STEP : KEY_STEP)
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={Math.round(value)}
      tabIndex={0}
      title={`${label} — drag to resize, double-click to reset`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={handleKeyDown}
      onDoubleClick={onReset}
      className={`group relative w-1.5 flex-shrink-0 cursor-col-resize touch-none outline-none transition-colors focus-visible:bg-(--indigo-300) ${
        dragging ? 'bg-(--ultraviolet)' : 'bg-(--line) hover:bg-(--indigo-300)'
      }`}
    >
      {/* Wider invisible hit area so the thin strip is easy to grab. */}
      <span className="absolute inset-y-0 -left-1.5 -right-1.5" />
      <span
        className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-8 w-0.5 ${
          dragging ? 'bg-(--off-white)' : 'bg-(--gray-500) group-hover:bg-(--off-white)'
        }`}
      />
    </div>
  )
}
