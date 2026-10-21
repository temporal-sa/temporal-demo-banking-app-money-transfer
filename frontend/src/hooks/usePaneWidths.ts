import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

export interface PaneWidths {
  phone: number
  backstage: number
}

const STORAGE_KEY = 'banking-demo:pane-widths'
const HANDLE_WIDTH = 6

export const PANE_DEFAULTS: PaneWidths = { phone: 380, backstage: 420 }
export const PANE_MIN = { phone: 260, backstage: 260, code: 320 }

function loadWidths(): PaneWidths {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    if (typeof saved?.phone === 'number' && typeof saved?.backstage === 'number') return saved
  } catch {
    // Storage unavailable or corrupt — fall back to defaults.
  }
  return PANE_DEFAULTS
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max))

/**
 * Widths for the resizable phone and backstage panes. The code pane takes the
 * remaining space and is never squeezed below PANE_MIN.code by a drag.
 */
export function usePaneWidths(containerRef: RefObject<HTMLElement | null>, backstageVisible: boolean) {
  const [widths, setWidths] = useState<PaneWidths>(loadWidths)
  const dragStart = useRef(widths)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(widths))
    } catch {
      // Persisting is a convenience only.
    }
  }, [widths])

  const beginDrag = useCallback(() => {
    dragStart.current = widths
  }, [widths])

  const resizePhone = useCallback(
    (deltaX: number) => {
      const start = dragStart.current
      const others = backstageVisible ? start.backstage + HANDLE_WIDTH * 2 : HANDLE_WIDTH
      const total = containerRef.current?.clientWidth ?? window.innerWidth
      const max = total - others - PANE_MIN.code
      setWidths({ ...start, phone: clamp(start.phone + deltaX, PANE_MIN.phone, max) })
    },
    [containerRef, backstageVisible]
  )

  const resizeBackstage = useCallback(
    (deltaX: number) => {
      const start = dragStart.current
      const total = containerRef.current?.clientWidth ?? window.innerWidth
      const max = total - start.phone - HANDLE_WIDTH * 2 - PANE_MIN.code
      setWidths({ ...start, backstage: clamp(start.backstage + deltaX, PANE_MIN.backstage, max) })
    },
    [containerRef]
  )

  const resetPhone = useCallback(() => setWidths((w) => ({ ...w, phone: PANE_DEFAULTS.phone })), [])
  const resetBackstage = useCallback(
    () => setWidths((w) => ({ ...w, backstage: PANE_DEFAULTS.backstage })),
    []
  )

  return { widths, beginDrag, resizePhone, resizeBackstage, resetPhone, resetBackstage }
}
