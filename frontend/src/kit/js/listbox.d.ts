export interface ListboxHandle {
  sync: () => void
  open: () => void
  close: (refocus?: boolean) => void
  element: HTMLDivElement
}

declare global {
  interface Window {
    Listbox: {
      mount: (select: HTMLSelectElement, options?: { label?: string }) => ListboxHandle
    }
  }
}
