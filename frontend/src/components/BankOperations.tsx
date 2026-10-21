import { useEffect, useState } from 'react'
import type { Settings } from '../types'
import { Icon } from './Icon'

interface PendingTransfer {
  transfer_id: string
  from_account: string
  to_account: string
  amount: number
  created_at: string
}

interface BankOperationsProps {
  settings: Settings
}

export function BankOperations({ settings }: BankOperationsProps) {
  const [pendingApprovals, setPendingApprovals] = useState<PendingTransfer[]>([])
  const [processedTransfers, setProcessedTransfers] = useState<Record<string, 'approved' | 'denied'>>({})

  useEffect(() => {
    const poll = () => {
      fetch('/api/bank/pending-approvals')
        .then((r) => r.json())
        .then(setPendingApprovals)
        .catch(() => {})
    }
    poll()
    const interval = setInterval(poll, 2000)
    return () => clearInterval(interval)
  }, [])

  const handleApprove = async (transferId: string) => {
    await fetch(`/api/bank/approve/${transferId}`, { method: 'POST' })
    setProcessedTransfers((prev) => ({ ...prev, [transferId]: 'approved' }))
    setPendingApprovals((prev) => prev.filter((p) => p.transfer_id !== transferId))
  }

  const handleDeny = async (transferId: string) => {
    await fetch(`/api/bank/deny/${transferId}`, { method: 'POST' })
    setProcessedTransfers((prev) => ({ ...prev, [transferId]: 'denied' }))
    setPendingApprovals((prev) => prev.filter((p) => p.transfer_id !== transferId))
  }

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)

  const isHITL = settings.scenario === 'human_in_the_loop'

  const decisions = Object.values(processedTransfers)

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="page-head">
        <div className="wrap page-head-inner">
          <div className="page-title">
            <h1>Bank Operations Center</h1>
            <p>Transfer approval dashboard</p>
          </div>
          <dl className="stats">
            <div>
              <dd className={isHITL ? 'text-(--mint)' : 'text-(--gray-400)'}>
                {isHITL ? 'Active' : 'Standby'}
              </dd>
              <dt>Status</dt>
            </div>
            <div>
              <dd>{pendingApprovals.length}</dd>
              <dt>Pending</dt>
            </div>
            <div>
              <dd>{decisions.filter((d) => d === 'approved').length}</dd>
              <dt>Approved</dt>
            </div>
            <div>
              <dd>{decisions.filter((d) => d === 'denied').length}</dd>
              <dt>Denied</dt>
            </div>
          </dl>
        </div>
      </div>

      <div className="catalog flex-1 overflow-y-auto">
        <div className="wrap max-w-3xl">
          {!isHITL ? (
            <div className="empty">
              <p className="text-(--off-white) mb-2">No active approvals</p>
              <p className="normal-case font-(family-name:--font) font-light text-sm">
                Switch to the <span className="text-(--purple)">Human-in-the-Loop</span> scenario
                in settings to see transfers that require manual bank approval.
              </p>
            </div>
          ) : pendingApprovals.length === 0 && decisions.length === 0 ? (
            <div className="empty">
              <p className="ws-live mb-3">Waiting for transfers</p>
              <p className="normal-case font-(family-name:--font) font-light text-sm">
                Initiate a transfer from the Customer App tab.
                It will appear here for approval after the withdrawal step.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Pending approvals */}
              {pendingApprovals.map((transfer) => (
                <div key={transfer.transfer_id} className="panel panel-isolated">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="panel-title mb-1">Transfer #{transfer.transfer_id}</p>
                      <p className="text-3xl font-light tracking-tight">
                        {formatCurrency(transfer.amount)}
                      </p>
                    </div>
                    <span className="tag text-(--mustard) border-(--mustard) animate-pulse">
                      Pending Approval
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mb-5 text-sm font-(family-name:--mono) text-(--gray-200)">
                    <span>{transfer.from_account}</span>
                    <Icon name="arrowRight" size={14} className="text-(--gray-500)" />
                    <span>{transfer.to_account}</span>
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => handleApprove(transfer.transfer_id)}
                      className="btn btn-green flex-1"
                    >
                      <span>Approve</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeny(transfer.transfer_id)}
                      className="btn btn-pink flex-1"
                    >
                      <span>Deny</span>
                    </button>
                  </div>
                </div>
              ))}

              {/* Processed transfers */}
              {decisions.length > 0 && (
                <div className="panel">
                  <p className="panel-title">Processed</p>
                  {Object.entries(processedTransfers).map(([id, decision]) => (
                    <div key={id} className="asset-row">
                      <span className="font-(family-name:--mono) text-sm text-(--gray-200)">
                        Transfer #{id}
                      </span>
                      <span className={`tag ${decision === 'approved' ? 'tag-canonical' : 'tag-hot'}`}>
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
    </div>
  )
}
