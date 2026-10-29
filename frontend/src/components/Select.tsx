import { useEffect, useRef } from 'react'
import '../kit/js/listbox.js'
import type { ListboxHandle } from '../kit/js/listbox.js'

interface SelectProps {
  label: string
  value: string
  options: { value: string; label: string; disabled?: boolean }[]
  onChange: (value: string) => void
}

/** A <select> drawn by the kit's Listbox, which keeps the select as the value. */
export function Select({ label, value, options, onChange }: SelectProps) {
  const selectRef = useRef<HTMLSelectElement>(null)
  const listboxRef = useRef<ListboxHandle | null>(null)
  // Listbox copies the options when it mounts, so it remounts when they change.
  const optionsKey = options.map((o) => `${o.value}\t${o.label}\t${o.disabled ? 1 : 0}`).join('\n')

  useEffect(() => {
    const select = selectRef.current
    if (!select) return
    const listbox = window.Listbox.mount(select, { label })
    listboxRef.current = listbox
    return () => {
      listbox.element.remove()
      select.hidden = false
      listboxRef.current = null
    }
  }, [label, optionsKey])

  useEffect(() => {
    listboxRef.current?.sync()
  }, [value, optionsKey])

  return (
    <label className="field">
      <span>{label}</span>
      <select ref={selectRef} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}
