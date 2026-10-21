import { useEffect, useState } from 'react'
import type { Account } from '../types'
import { Icon } from './Icon'

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
      {/* Header */}
      <div className="px-4 py-3 bg-(--space-black) border-b border-(--line)">
        <h1 className="text-xl font-light tracking-tight">My Accounts</h1>
        <p className="eyebrow text-[11px] mt-0.5">Temporal Banking</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {/* Total balance card */}
        <div className="panel panel-isolated p-4 mb-4">
          <p className="panel-title mb-1">Total Balance</p>
          <p className="text-3xl font-light tracking-tight">
            {formatCurrency(accounts.reduce((sum, a) => sum + a.balance, 0))}
          </p>
        </div>

        {/* Account cards */}
        <div className="space-y-2.5">
          {accounts
            .filter((a) => a.id !== 'ACC-999')
            .map((account) => (
              <div
                key={account.id}
                className="bg-(--deepest-blue) p-3.5 border border-(--line)"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 flex-shrink-0 border border-(--line-strong) bg-(--deep-blue) flex items-center justify-center text-lg"
                  >
                    <Icon name={account.account_type === 'checking' ? 'card' : 'bank'} className="text-(--indigo-200)" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{account.name}</p>
                    <p className="text-xs text-(--gray-300) font-light">{account.owner}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      {formatCurrency(account.balance)}
                    </p>
                    <p className="text-[10px] font-(family-name:--mono) text-(--gray-400) uppercase">{account.id}</p>
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Bottom action */}
      <div className="p-4 bg-(--space-black) border-t border-(--line)">
        <button
          onClick={onStartTransfer}
          type="button"
          className="btn btn-primary w-full"
        >
          <span>Send Money</span>
        </button>
      </div>
    </div>
  )
}
