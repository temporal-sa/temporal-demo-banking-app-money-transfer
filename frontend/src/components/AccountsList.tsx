import { useEffect, useState } from 'react'
import type { Account } from '../types'
import { AccountIcon } from './Icon'

interface AccountsListProps {
  onStartTransfer: () => void
}

export function AccountsList({ onStartTransfer }: AccountsListProps) {
  const [accounts, setAccounts] = useState<Account[]>([])

  useEffect(() => {
    fetch('/api/accounts')
      .then((r) => r.json())
      .then(setAccounts)
      .catch(() => {})
  }, [])

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border grid gap-0.5">
        <h1 className="text-xl font-light tracking-tight">My Accounts</h1>
        <p className="eyebrow">Temporal Banking</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        <div className="card stat mb-4">
          <span className="stat-label">Total balance</span>
          <span className="stat-value">
            {formatCurrency(accounts.reduce((sum, a) => sum + a.balance, 0))}
          </span>
        </div>

        <div className="space-y-2.5">
          {accounts
            .filter((a) => a.id !== 'ACC-999')
            .map((account) => (
              <div key={account.id} className="bg-panel p-3.5 border border-border">
                <div className="flex items-center gap-3">
                  <AccountIcon type={account.account_type} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{account.name}</p>
                    <p className="text-xs text-t-slate">{account.owner}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium tabular-nums">
                      {formatCurrency(account.balance)}
                    </p>
                    <p className="text-[11px] font-mono text-t-slate uppercase">{account.id}</p>
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>

      <div className="p-4 border-t border-border">
        <button
          type="button"
          onClick={onStartTransfer}
          className="button primary ultraviolet w-full"
        >
          Send money
        </button>
      </div>
    </div>
  )
}
