import { useCallback, useEffect, useState } from 'react'
import { AccountsList } from './components/AccountsList'
import { BankOperations } from './components/BankOperations'
import { SettingsDialog } from './components/SettingsDialog'
import { TemporalCodeView } from './components/TemporalCodeView'
import { TransferBackstage } from './components/TransferBackstage'
import { TransferForm } from './components/TransferForm'
import { TransferReview } from './components/TransferReview'
import { TransferTracker } from './components/TransferTracker'
import { useCodeLanguage } from './hooks/useCodeLanguage'
import { PaneCollapseButton, PaneLayout, PhoneFrame, useLiveEvents } from './kit'
import { SCENARIOS } from './scenarios'
import type {
  Account,
  CreateTransferResponse,
  DemoTab,
  PhoneScreen,
  Settings,
  TemporalUiInfo,
  TransferEvent,
} from './types'

const DEFAULT_SETTINGS: Settings = {
  scenario: 'happy_path',
  presentation_mode: 'detailed',
}

const TRANSFER_EVENTS = { update: 'transfer_update', done: 'transfer_complete' }

function App() {
  const [tab, setTab] = useState<DemoTab>('customer')
  const [screen, setScreen] = useState<PhoneScreen>('accounts')
  const [accounts, setAccounts] = useState<Account[]>([])
  const [fromAccount, setFromAccount] = useState('')
  const [toAccount, setToAccount] = useState('')
  const [amount, setAmount] = useState('')
  const [transferId, setTransferId] = useState<string | null>(null)
  const [workflowId, setWorkflowId] = useState<string | null>(null)
  const [isTransferring, setIsTransferring] = useState(false)
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [temporalUi, setTemporalUi] = useState<TemporalUiInfo | null>(null)
  const [temporalWorkflowUrl, setTemporalWorkflowUrl] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [codeLanguage, setCodeLanguage] = useCodeLanguage()

  const { events, finalStatus, reset: resetEvents } = useLiveEvents<TransferEvent>(
    transferId ? `/api/transfers/${transferId}/events` : null,
    TRANSFER_EVENTS,
  )

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

  const handleNewTransfer = useCallback(() => {
    setTransferId(null)
    setWorkflowId(null)
    setTemporalWorkflowUrl(null)
    setFromAccount('')
    setToAccount('')
    setAmount('')
    setScreen('accounts')
    resetEvents()
  }, [resetEvents])

  const handleSaveSettings = useCallback(
    async (newSettings: Settings) => {
      setSettings(newSettings)
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings),
      })
      handleNewTransfer()
    },
    [handleNewTransfer]
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
      setWorkflowId(data.workflow_id || null)
      setTemporalWorkflowUrl(data.temporal_ui_url || null)
      setScreen('tracking')
    } finally {
      setIsTransferring(false)
    }
  }, [fromAccount, toAccount, amount])

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

  const scenarioLabel =
    SCENARIOS.find((s) => s.value === settings.scenario)?.label ?? settings.scenario

  return (
    <>
      <header className="topbar app-header">
        <a href="/" className="brand" aria-label="Money transfer demo home">
          <img src="/static/temporal-logo.svg" alt="Temporal" width="129" height="33" />
          <span className="brand-divider" />
          <p className="eyebrow">Money transfer</p>
        </a>
        <nav className="segmented" aria-label="Views">
          <button
            type="button"
            aria-current={tab === 'customer' ? 'page' : undefined}
            onClick={() => setTab('customer')}
          >
            Customer app
          </button>
          <button
            type="button"
            aria-current={tab === 'operations' ? 'page' : undefined}
            onClick={() => setTab('operations')}
          >
            Bank operations
          </button>
        </nav>
        <div className="topbar-actions">
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="button small secondary ultraviolet"
            aria-haspopup="dialog"
          >
            Scenario: {scenarioLabel}
          </button>
          <a
            href={temporalUi?.namespace_url || undefined}
            target="_blank"
            rel="noreferrer"
            aria-disabled={temporalUi?.namespace_url ? undefined : true}
            className="button small secondary green"
            title={
              temporalUi
                ? `Open ${temporalUi.namespace} in the Temporal UI`
                : 'Available once the server reports the Temporal UI address'
            }
          >
            Temporal UI &#8599;
          </a>
        </div>
      </header>

      <main className="flex-1 flex min-h-0">
        {tab === 'customer' ? (
          <PaneLayout
            className="flex-1"
            storageKey="banking-demo:panes"
            panes={[
              {
                id: 'phone',
                title: 'Customer app',
                defaultWidth: 380,
                minWidth: 260,
                content: (
                  <div className="pane-stack">
                    <div className="card-head pane-head">
                      <div>
                        <p className="eyebrow">What the customer sees</p>
                        <h2 className="heading">Customer app</h2>
                      </div>
                      <PaneCollapseButton />
                    </div>
                    <PhoneFrame
                      chrome="var(--space-black)"
                      background="var(--space-black)"
                      foreground="var(--off-white)"
                    >
                      {renderPhoneContent()}
                    </PhoneFrame>
                  </div>
                ),
              },
              {
                id: 'backstage',
                title: 'Behind the scenes',
                defaultWidth: 420,
                minWidth: 260,
                content: (
                  <TransferBackstage
                    events={events}
                    settings={settings}
                    finalStatus={finalStatus}
                    workflowId={workflowId}
                    executionUrl={temporalWorkflowUrl}
                  />
                ),
              },
              {
                id: 'code',
                title: 'Workflow code',
                minWidth: 320,
                content: (
                  <TemporalCodeView
                    events={events}
                    language={codeLanguage}
                    onLanguageChange={setCodeLanguage}
                  />
                ),
              },
            ]}
          />
        ) : (
          <BankOperations settings={settings} />
        )}
      </main>

      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onSave={handleSaveSettings}
      />
    </>
  )
}

export default App
