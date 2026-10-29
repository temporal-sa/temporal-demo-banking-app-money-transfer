import type { Account } from '../types'
import { BackButton } from './BackButton'
import { AccountIcon } from './Icon'

interface TransferReviewProps {
  accounts: Account[]
  fromAccount: string
  toAccount: string
  amount: number
  onConfirm: () => void
  onBack: () => void
  isLoading: boolean
}

export function TransferReview({
  accounts,
  fromAccount,
  toAccount,
  amount,
  onConfirm,
  onBack,
  isLoading,
}: TransferReviewProps) {
  const from = accounts.find((a) => a.id === fromAccount)
  const to = accounts.find((a) => a.id === toAccount)

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val)

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border flex items-center gap-1">
        <BackButton onClick={onBack} />
        <h1 className="text-xl font-light tracking-tight">Review Transfer</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="text-center mb-6 grid gap-2">
          <p className="text-5xl font-light tracking-tight tabular-nums">{formatCurrency(amount)}</p>
          <p className="eyebrow">Transfer amount</p>
        </div>

        <div className="bg-panel p-4 border border-border mb-2 grid gap-2">
          <p className="eyebrow">From</p>
          <div className="flex items-center gap-3">
            <AccountIcon type={from?.account_type} />
            <div className="flex-1">
              <p className="text-sm font-medium">{from?.name}</p>
              <p className="text-xs text-t-slate">{from?.owner}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium tabular-nums">{formatCurrency(from?.balance ?? 0)}</p>
              <p className="text-[11px] font-mono text-t-slate tabular-nums">
                After: {formatCurrency((from?.balance ?? 0) - amount)}
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-center py-1">
          <div className="w-8 h-8 border border-control-edge flex items-center justify-center text-t-green">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M8 3v10M5 10l3 3 3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>

        <div className="bg-panel p-4 border border-border mb-6 grid gap-2">
          <p className="eyebrow">To</p>
          <div className="flex items-center gap-3">
            <AccountIcon type={to?.account_type} />
            <div className="flex-1">
              <p className="text-sm font-medium">{to?.name}</p>
              <p className="text-xs text-t-slate">{to?.owner}</p>
            </div>
            <p className="text-[11px] font-mono text-t-slate uppercase">{to?.id}</p>
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-border">
        <button
          type="button"
          onClick={onConfirm}
          disabled={isLoading}
          aria-busy={isLoading}
          className="button primary ultraviolet w-full"
        >
          {isLoading ? 'Sending…' : 'Confirm transfer'}
        </button>
      </div>
    </div>
  )
}
