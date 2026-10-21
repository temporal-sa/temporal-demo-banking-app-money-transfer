import type { Account } from '../types'
import { Icon } from './Icon'

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
      {/* Header */}
      <div className="px-4 py-3 bg-(--space-black) border-b border-(--line)">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="text-(--gray-300) hover:text-(--off-white) cursor-pointer">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z"
                clipRule="evenodd"
              />
            </svg>
          </button>
          <h1 className="text-xl font-light tracking-tight">Review Transfer</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {/* Amount */}
        <div className="text-center mb-6">
          <p className="text-5xl font-light tracking-tight">{formatCurrency(amount)}</p>
          <p className="eyebrow text-xs mt-2">Transfer amount</p>
        </div>

        {/* From card */}
        <div className="bg-(--deepest-blue) p-4 border border-(--line) mb-2">
          <p className="panel-title text-xs mb-2">From</p>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex-shrink-0 border border-(--line-strong) bg-(--deep-blue) flex items-center justify-center text-lg">
              <Icon name={from?.account_type === 'checking' ? 'card' : 'bank'} className="text-(--indigo-200)" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">{from?.name}</p>
              <p className="text-xs text-(--gray-300) font-light">{from?.owner}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium">{formatCurrency(from?.balance ?? 0)}</p>
              <p className="text-[10px] font-(family-name:--mono) text-(--gray-400)">
                After: {formatCurrency((from?.balance ?? 0) - amount)}
              </p>
            </div>
          </div>
        </div>

        {/* Arrow */}
        <div className="flex justify-center py-1">
          <div className="w-8 h-8 border border-(--line-strong) flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-(--mint)">
              <path d="M8 3v10M5 10l3 3 3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>

        {/* To card */}
        <div className="bg-(--deepest-blue) p-4 border border-(--line) mb-6">
          <p className="panel-title text-xs mb-2">To</p>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex-shrink-0 border border-(--line-strong) bg-(--deep-blue) flex items-center justify-center text-lg">
              <Icon name={to?.account_type === 'checking' ? 'card' : 'bank'} className="text-(--indigo-200)" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">{to?.name}</p>
              <p className="text-xs text-(--gray-300) font-light">{to?.owner}</p>
            </div>
            <p className="text-[10px] font-(family-name:--mono) text-(--gray-400) uppercase">{to?.id}</p>
          </div>
        </div>
      </div>

      {/* Bottom */}
      <div className="p-4 bg-(--space-black) border-t border-(--line)">
        <button
          onClick={onConfirm}
          disabled={isLoading}
          aria-busy={isLoading}
          className="btn btn-primary w-full"
        >
          {isLoading && <span className="spinner" />}
          <span>{isLoading ? 'Sending...' : 'Confirm Transfer'}</span>
        </button>
      </div>
    </div>
  )
}
