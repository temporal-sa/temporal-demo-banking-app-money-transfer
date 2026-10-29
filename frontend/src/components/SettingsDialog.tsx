import { useEffect, useRef } from 'react'
import { SCENARIOS } from '../scenarios'
import type { Settings, TransferScenario } from '../types'

interface SettingsDialogProps {
  open: boolean
  onClose: () => void
  settings: Settings
  onSave: (s: Settings) => void
}

export function SettingsDialog({ open, onClose, settings, onSave }: SettingsDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  const handleSelectScenario = (scenario: TransferScenario) => {
    onSave({ ...settings, scenario })
    onClose()
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="settings-title"
      onClose={onClose}
      onClick={(event) => {
        // A click on the dialog element itself, not its content, landed on the backdrop.
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="card-head">
        <div>
          <p className="eyebrow">Demo settings</p>
          <h2 className="heading" id="settings-title">Choose a scenario</h2>
        </div>
      </div>

      <div className="scenario-list mt-4" role="group" aria-label="Transfer scenario">
        {SCENARIOS.map((s) => {
          const isActive = settings.scenario === s.value
          return (
            <button
              key={s.value}
              type="button"
              className="scenario"
              onClick={() => handleSelectScenario(s.value)}
              aria-pressed={isActive}
            >
              <span className="scenario-name">
                {s.label}
                {isActive && <span className="text-t-green"> · selected</span>}
              </span>
              <span className="scenario-note">{s.description}</span>
            </button>
          )
        })}
      </div>

      <div className="grid gap-2 mt-5">
        <p className="eyebrow" id="presentation-label">Presentation</p>
        <div className="chips" role="group" aria-labelledby="presentation-label">
          {(['simple', 'detailed'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              className="chip"
              onClick={() => onSave({ ...settings, presentation_mode: mode })}
              aria-pressed={settings.presentation_mode === mode}
            >
              {mode === 'simple' ? 'Simple' : 'Detailed'}
            </button>
          ))}
        </div>
      </div>

      <div className="dialog-actions">
        <button type="button" className="button small secondary ultraviolet" onClick={onClose}>
          Done
        </button>
      </div>
    </dialog>
  )
}
