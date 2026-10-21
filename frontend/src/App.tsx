import { useCallback, useEffect, useRef, useState } from 'react'
import { AccountsList } from './components/AccountsList'
import { BackstagePanel } from './components/BackstagePanel'
import { BankOperations } from './components/BankOperations'
import { PhoneFrame } from './components/PhoneFrame'
import { ResizeHandle } from './components/ResizeHandle'
import { SettingsModal } from './components/SettingsModal'
import { TemporalCodeView } from './components/TemporalCodeView'
import { TransferForm } from './components/TransferForm'
import { TransferReview } from './components/TransferReview'
import { TransferTracker } from './components/TransferTracker'
import { PANE_MIN, usePaneWidths } from './hooks/usePaneWidths'
import { useSSE } from './hooks/useSSE'
import type {
  Account,
  CreateTransferResponse,
  DemoTab,
  PhoneScreen,
  Settings,
  TemporalUiInfo,
} from './types'

const DEFAULT_SETTINGS: Settings = {
  scenario: 'happy_path',
  presentation_mode: 'detailed',
}

const SCENARIO_LABELS: Record<string, string> = {
  happy_path: 'Happy Path',
  advanced_visibility: 'Advanced Visibility',
  human_in_the_loop: 'Human-in-the-Loop',
  api_downtime: 'API Downtime',
  bug_in_workflow: 'Bug in Workflow',
  invalid_account: 'Invalid Account',
}

function App() {
  const [tab, setTab] = useState<DemoTab>('customer')
  const [screen, setScreen] = useState<PhoneScreen>('accounts')
  const [accounts, setAccounts] = useState<Account[]>([])
  const [fromAccount, setFromAccount] = useState('')
  const [toAccount, setToAccount] = useState('')
  const [amount, setAmount] = useState('')
  const [transferId, setTransferId] = useState<string | null>(null)
  const [isTransferring, setIsTransferring] = useState(false)
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [temporalUi, setTemporalUi] = useState<TemporalUiInfo | null>(null)
  const [temporalWorkflowUrl, setTemporalWorkflowUrl] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [backstageCollapsed, setBackstageCollapsed] = useState(false)
  const panesRef = useRef<HTMLDivElement>(null)
  const panes = usePaneWidths(panesRef, !backstageCollapsed)

  const { events, finalStatus, reset: resetSSE } = useSSE(transferId)

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((s) => setSettings((prev) => ({ ...prev, ...s })))
      .catch(() => {})
    fetch('/api/accounts')
      .then((r) => r.json())
      .then(setAccounts)
      .catch(() => {})
    fetch('/api/temporal-ui')
      .then((r) => r.json())
      .then((data) => {
        if (data?.namespace_url) setTemporalUi(data)
      })
      .catch(() => {})
  }, [])

  const handleSaveSettings = useCallback(
    async (newSettings: Settings) => {
      setSettings(newSettings)
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings),
      })
      setTransferId(null)
      setTemporalWorkflowUrl(null)
      setScreen('accounts')
      setFromAccount('')
      setToAccount('')
      setAmount('')
      resetSSE()
    },
    [resetSSE]
  )

  const handleConfirmTransfer = useCallback(async () => {
    setIsTransferring(true)
    try {
      const res = await fetch('/api/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from_account: fromAccount,
          to_account: toAccount,
          amount: parseFloat(amount),
        }),
      })
      const data = (await res.json()) as CreateTransferResponse
      setTransferId(data.transfer_id)
      setTemporalWorkflowUrl(data.temporal_ui_url || null)
      setScreen('tracking')
    } finally {
      setIsTransferring(false)
    }
  }, [fromAccount, toAccount, amount])

  const handleNewTransfer = useCallback(() => {
    setTransferId(null)
    setTemporalWorkflowUrl(null)
    setFromAccount('')
    setToAccount('')
    setAmount('')
    setScreen('accounts')
    resetSSE()
  }, [resetSSE])

  const renderPhoneContent = () => {
    switch (screen) {
      case 'accounts':
        return <AccountsList onStartTransfer={() => setScreen('transfer')} />
      case 'transfer':
        return (
          <TransferForm
            accounts={accounts}
            fromAccount={fromAccount}
            toAccount={toAccount}
            amount={amount}
            onFromChange={setFromAccount}
            onToChange={setToAccount}
            onAmountChange={setAmount}
            onNext={() => setScreen('review')}
            onBack={() => setScreen('accounts')}
          />
        )
      case 'review':
        return (
          <TransferReview
            accounts={accounts}
            fromAccount={fromAccount}
            toAccount={toAccount}
            amount={parseFloat(amount) || 0}
            onConfirm={handleConfirmTransfer}
            onBack={() => setScreen('transfer')}
            isLoading={isTransferring}
          />
        )
      case 'tracking':
        return (
          <TransferTracker
            events={events}
            finalStatus={finalStatus}
            settings={settings}
            onNewTransfer={handleNewTransfer}
          />
        )
    }
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Top bar */}
      <header className="site-header">
        <div className="wrap header-inner max-w-none">
          <a href="/" className="brand" aria-label="Home">
            <img src="/static/temporal-logo.svg" alt="Temporal" width="129" height="33" />
            <span className="brand-product">Money Transfer</span>
          </a>
          <nav className="tabs" aria-label="Views">
            <a
              href="#customer"
              aria-current={tab === 'customer' ? 'page' : undefined}
              onClick={(event) => {
                event.preventDefault()
                setTab('customer')
              }}
            >
              Customer App
            </a>
            <a
              href="#operations"
              aria-current={tab === 'operations' ? 'page' : undefined}
              onClick={(event) => {
                event.preventDefault()
                setTab('operations')
              }}
            >
              Bank Operations
            </a>
          </nav>
          <div className="header-actions gap-3">
            <a
              href={temporalUi?.namespace_url || undefined}
              target="_blank"
              rel="noreferrer"
              aria-disabled={!temporalUi?.namespace_url}
              className="btn btn-secondary btn-sm"
              onClick={(event) => {
                if (!temporalUi?.namespace_url) event.preventDefault()
              }}
              title={
                temporalUi?.namespace
                  ? `Open ${temporalUi.namespace} in Temporal UI`
                  : 'Open Temporal namespace'
              }
            >
              <span>{SCENARIO_LABELS[settings.scenario] || settings.scenario}</span>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
              </svg>
            </a>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="icon-btn"
              title="Demo Settings"
              aria-label="Demo Settings"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12" />
                <circle cx="16" cy="6" r="2" />
                <circle cx="10" cy="12" r="2" />
                <circle cx="18" cy="18" r="2" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {tab === 'customer' ? (
          <div ref={panesRef} className="flex-1 flex items-stretch overflow-hidden">
            <div
              className="h-full overflow-hidden"
              style={{ flex: `0 1 ${panes.widths.phone}px`, minWidth: PANE_MIN.phone }}
            >
              <PhoneFrame>{renderPhoneContent()}</PhoneFrame>
            </div>
            <ResizeHandle
              label="Resize phone panel"
              value={panes.widths.phone}
              onDragStart={panes.beginDrag}
              onDrag={panes.resizePhone}
              onReset={panes.resetPhone}
            />
            {backstageCollapsed ? (
              <BackstagePanel
                events={events}
                settings={settings}
                finalStatus={finalStatus}
                temporalWorkflowUrl={temporalWorkflowUrl}
                collapsed
                onCollapsedChange={setBackstageCollapsed}
              />
            ) : (
              <>
                <div
                  className="h-full overflow-hidden"
                  style={{ flex: `0 1 ${panes.widths.backstage}px`, minWidth: PANE_MIN.backstage }}
                >
                  <BackstagePanel
                    events={events}
                    settings={settings}
                    finalStatus={finalStatus}
                    temporalWorkflowUrl={temporalWorkflowUrl}
                    collapsed={false}
                    onCollapsedChange={setBackstageCollapsed}
                  />
                </div>
                <ResizeHandle
                  label="Resize Behind the Scenes panel"
                  value={panes.widths.backstage}
                  onDragStart={panes.beginDrag}
                  onDrag={panes.resizeBackstage}
                  onReset={panes.resetBackstage}
                />
              </>
            )}
            <div
              className="h-full flex-1 overflow-hidden"
              style={{ flexBasis: 0, minWidth: PANE_MIN.code }}
            >
              <TemporalCodeView events={events} finalStatus={finalStatus} />
            </div>
          </div>
        ) : (
          <BankOperations settings={settings} />
        )}
      </div>

      {/* Settings modal */}
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onSave={handleSaveSettings}
      />
    </div>
  )
}

export default App
