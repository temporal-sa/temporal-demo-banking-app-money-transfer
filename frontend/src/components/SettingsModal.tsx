import type { CodeLanguage, Settings, TransferScenario } from '../types'

interface SettingsModalProps {
  open: boolean
  onClose: () => void
  settings: Settings
  onSave: (s: Settings) => void
  codeLanguage: CodeLanguage
  onCodeLanguageChange: (language: CodeLanguage) => void
}

const CODE_LANGUAGES: { value: CodeLanguage; label: string }[] = [
  { value: 'python', label: 'Python' },
  { value: 'go', label: 'Go' },
  { value: 'typescript', label: 'TypeScript' },
]

const SCENARIOS: {
  value: TransferScenario
  label: string
  description: string
  color: string
}[] = [
  {
    value: 'happy_path',
    label: 'Happy Path',
    description: 'Standard transfer — everything succeeds',
    color: 'green',
  },
  {
    value: 'advanced_visibility',
    label: 'Advanced Visibility',
    description: 'Updates search attributes at each workflow step',
    color: 'blue',
  },
  {
    value: 'human_in_the_loop',
    label: 'Human-in-the-Loop',
    description: 'Pauses for bank employee approval with 30s timeout',
    color: 'purple',
  },
  {
    value: 'api_downtime',
    label: 'API Downtime',
    description: 'Deposit fails ~5 times then recovers automatically',
    color: 'yellow',
  },
  {
    value: 'bug_in_workflow',
    label: 'Bug in Workflow',
    description: 'Intentional error — demonstrates versioning/patching',
    color: 'red',
  },
  {
    value: 'invalid_account',
    label: 'Invalid Account',
    description: 'Non-retryable failure — immediate fail on validation',
    color: 'red',
  },
]

const TONE: Record<string, string> = {
  green: 'border-l-(--mint)',
  blue: 'border-l-(--indigo-300)',
  purple: 'border-l-(--purple)',
  yellow: 'border-l-(--mustard)',
  red: 'border-l-(--coral)',
}

export function SettingsModal({
  open,
  onClose,
  settings,
  onSave,
  codeLanguage,
  onCodeLanguageChange,
}: SettingsModalProps) {
  if (!open) return null

  const handleSelectScenario = (scenario: TransferScenario) => {
    onSave({ ...settings, scenario })
    onClose()
  }

  return (
    <div className="drawer" role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <div className="drawer-backdrop" onClick={onClose} />
      <div className="drawer-panel w-[min(30rem,100%)]">
        <div className="drawer-head">
          <p className="eyebrow" id="settings-title">Demo Settings</p>
          <button type="button" onClick={onClose} className="icon-btn" aria-label="Close">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="drawer-body">
          <section>
            <p className="panel-title">Transfer Scenario</p>
            <div className="space-y-2">
              {SCENARIOS.map((s) => {
                const isActive = settings.scenario === s.value
                return (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => handleSelectScenario(s.value)}
                    aria-pressed={isActive}
                    className={`w-full text-left px-4 py-3 border border-l-[3px] cursor-pointer transition-colors ${TONE[s.color]} ${
                      isActive
                        ? 'bg-(--deep-blue) border-(--indigo-300)'
                        : 'bg-(--deepest-blue) border-(--line) hover:bg-(--deep-blue-hover)'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-(--off-white)">{s.label}</p>
                        <p className="text-xs text-(--indigo-100) font-light mt-0.5">{s.description}</p>
                      </div>
                      {isActive && <span className="tag tag-canonical">Active</span>}
                    </div>
                  </button>
                )
              })}
            </div>
          </section>

          <section>
            <p className="panel-title">Presentation</p>
            <div className="flex gap-2">
              {(['simple', 'detailed'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onSave({ ...settings, presentation_mode: mode })}
                  aria-pressed={settings.presentation_mode === mode}
                  className={`btn btn-sm flex-1 ${
                    settings.presentation_mode === mode ? 'btn-primary' : 'btn-secondary'
                  }`}
                >
                  <span>{mode === 'simple' ? 'Simple' : 'Detailed'}</span>
                </button>
              ))}
            </div>
          </section>

          <section>
            <p className="panel-title">Code Language</p>
            <div className="flex gap-2">
              {CODE_LANGUAGES.map((lang) => (
                <button
                  key={lang.value}
                  type="button"
                  onClick={() => onCodeLanguageChange(lang.value)}
                  aria-pressed={codeLanguage === lang.value}
                  className={`btn btn-sm flex-1 ${
                    codeLanguage === lang.value ? 'btn-primary' : 'btn-secondary'
                  }`}
                >
                  <span>{lang.label}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
