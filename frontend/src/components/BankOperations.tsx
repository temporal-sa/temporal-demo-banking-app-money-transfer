import { useEffect, useRef, useState } from 'react'
import '../kit/js/live.js'
import type { LivePoll } from '../kit/js/live.js'
import type { Settings } from '../types'
import { Icon } from './Icon'

interface PendingTransfer {
  transfer_id: string
  from_account: string
  to_account: string
  amount: number
  created_at: string
}

type Decision = 'approved' | 'denied'

interface BankOperationsProps {
  settings: Settings
}

export function BankOperations({ settings }: BankOperationsProps) {
  const [pendingApprovals, setPendingApprovals] = useState<PendingTransfer[]>([])
  const [processedTransfers, setProcessedTransfers] = useState<Record<string, Decision>>({})
  const [sending, setSending] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const freshnessRef = useRef<HTMLSpanElement>(null)
  const feedRef = useRef<LivePoll | null>(null)

  useEffect(() => {
    const feed = window.Live.poll<PendingTransfer[]>({
      url: '/api/bank/pending-approvals',
      interval: 2000,
      onData: setPendingApprovals,
      onState: window.Live.freshness(freshnessRef.current),
    })
    feedRef.current = feed
    return () => feed.stop()
  }, [])

  const decide = async (transferId: string, decision: Decision) => {
    setSending(transferId)
    setErrors((prev) => {
      const next = { ...prev }
      delete next[transferId]
      return next
    })
    try {
      const action = decision === 'approved' ? 'approve' : 'deny'
      const res = await fetch(`/api/bank/${action}/${transferId}`, { method: 'POST' })
      if (!res.ok) {
        setErrors((prev) => ({
          ...prev,
          [transferId]: 'This transfer is no longer waiting. Its approval window may have closed.',
        }))
        return
      }
      setProcessedTransfers((prev) => ({ ...prev, [transferId]: decision }))
      setPendingApprovals((prev) => prev.filter((p) => p.transfer_id !== transferId))
    } catch {
      setErrors((prev) => ({ ...prev, [transferId]: "Couldn't reach the server. Try again." }))
    } finally {
      setSending(null)
      feedRef.current?.refresh()
    }
  }

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)

  const isHITL = settings.scenario === 'human_in_the_loop'
  const decisions = Object.values(processedTransfers)

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-6 grid gap-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Transfer approval dashboard</p>
            <h1 className="text-4xl font-light tracking-tight mt-1">Bank Operations Center</h1>
          </div>
          <span className="freshness" ref={freshnessRef} />
        </div>

        <div className="stats">
          <div className="card stat">
            <span className="stat-label">Approvals</span>
            <span className={`stat-value ${isHITL ? '' : 'text-t-slate'}`}>
              {isHITL ? 'Active' : 'Standby'}
            </span>
            <span className="stat-note">Human-in-the-Loop scenario</span>
          </div>
          <div className="card stat">
            <span className="stat-label">Pending</span>
            <span className="stat-value">{pendingApprovals.length}</span>
            <span className="stat-note">waiting for a decision</span>
          </div>
          <div className="card stat">
            <span className="stat-label">Approved</span>
            <span className="stat-value">{decisions.filter((d) => d === 'approved').length}</span>
            <span className="stat-note">from this browser</span>
          </div>
          <div className="card stat">
            <span className="stat-label">Denied</span>
            <span className="stat-value">{decisions.filter((d) => d === 'denied').length}</span>
            <span className="stat-note">from this browser</span>
          </div>
        </div>

        {!isHITL ? (
          <div className="card ops-card text-center grid gap-2">
            <p className="heading">No active approvals</p>
            <p className="text-sm text-t-slate">
              Switch to the Human-in-the-Loop scenario in settings to see transfers that need a
              bank employee's approval.
            </p>
          </div>
        ) : pendingApprovals.length === 0 && decisions.length === 0 ? (
          <div className="card ops-card text-center grid gap-2">
            <p className="heading">Waiting for transfers</p>
            <p className="text-sm text-t-slate">
              Start a transfer from the Customer app tab. It appears here for approval after the
              withdrawal step.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {pendingApprovals.map((transfer) => {
              const busy = sending === transfer.transfer_id
              return (
                <div key={transfer.transfer_id} className="card ops-card">
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="grid gap-1">
                      <p className="eyebrow">Transfer #{transfer.transfer_id}</p>
                      <p className="text-3xl font-light tracking-tight tabular-nums">
                        {formatCurrency(transfer.amount)}
                      </p>
                    </div>
                    <span className="status-badge" data-status="waiting">
                      Waiting for approval
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mb-5 text-sm font-mono text-t-indigo-100">
                    <span>{transfer.from_account}</span>
                    <Icon name="arrowRight" size={14} className="text-t-slate" />
                    <span>{transfer.to_account}</span>
                  </div>

                  {errors[transfer.transfer_id] && (
                    <div className="state-banner mb-4">
                      <span>{errors[transfer.transfer_id]}</span>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => decide(transfer.transfer_id, 'approved')}
                      disabled={busy}
                      className="button primary green flex-1"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => decide(transfer.transfer_id, 'denied')}
                      disabled={busy}
                      className="button secondary ultraviolet flex-1"
                    >
                      Deny
                    </button>
                  </div>
                </div>
              )
            })}

            {decisions.length > 0 && (
              <div className="card ops-card">
                <p className="eyebrow pb-2">Processed</p>
                {Object.entries(processedTransfers).map(([id, decision]) => (
                  <div
                    key={id}
                    className="flex items-center justify-between gap-4 py-2.5 border-t border-border first:border-t-0"
                  >
                    <span className="font-mono text-sm text-t-indigo-100">Transfer #{id}</span>
                    <span
                      className="status-badge"
                      data-status={decision === 'approved' ? 'completed' : 'skipped'}
                    >
                      {decision === 'approved' ? 'Approved' : 'Denied'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
