import type { Account } from '../types'

interface TransferFormProps {
  accounts: Account[]
  fromAccount: string
  toAccount: string
  amount: string
  onFromChange: (id: string) => void
  onToChange: (id: string) => void
  onAmountChange: (amount: string) => void
  onNext: () => void
  onBack: () => void
}

export function TransferForm({
  accounts,
  fromAccount,
  toAccount,
  amount,
  onFromChange,
  onToChange,
  onAmountChange,
  onNext,
  onBack,
}: TransferFormProps) {
  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val)

  const canProceed =
    fromAccount && toAccount && fromAccount !== toAccount && parseFloat(amount) > 0

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
          <h1 className="text-xl font-light tracking-tight">Send Money</h1>
        </div>
      </div>

      <div className="onboard flex-1 overflow-y-auto px-4 py-4 gap-5 content-start">
        {/* From account */}
        <div className="onboard-field">
          <label className="onboard-label font-(family-name:--mono) uppercase text-xs">
            From
          </label>
          <select
            value={fromAccount}
            onChange={(e) => onFromChange(e.target.value)}
            className="min-h-12 text-sm"
          >
            <option value="">Select account</option>
            {accounts
              .filter((a) => a.id !== 'ACC-999')
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({formatCurrency(a.balance)})
                </option>
              ))}
          </select>
        </div>

        {/* To account */}
        <div className="onboard-field">
          <label className="onboard-label font-(family-name:--mono) uppercase text-xs">
            To
          </label>
          <select
            value={toAccount}
            onChange={(e) => onToChange(e.target.value)}
            className="min-h-12 text-sm"
          >
            <option value="">Select account</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id} disabled={a.id === fromAccount}>
                {a.name} — {a.owner}
              </option>
            ))}
          </select>
        </div>

        {/* Amount */}
        <div className="onboard-field">
          <label className="onboard-label font-(family-name:--mono) uppercase text-xs">
            Amount
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-(--gray-400) text-lg font-light">
              $
            </span>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => onAmountChange(e.target.value)}
              className="min-h-14 pl-8 text-2xl font-light"
            />
          </div>
        </div>

        {/* Quick amounts */}
        <div className="flex gap-2">
          {[50, 100, 250, 500].map((val) => (
            <button
              key={val}
              type="button"
              onClick={() => onAmountChange(String(val))}
              className="btn btn-secondary btn-sm flex-1 px-0"
            >
              ${val}
            </button>
          ))}
        </div>
      </div>

      {/* Bottom */}
      <div className="p-4 bg-(--space-black) border-t border-(--line)">
        <button
          onClick={onNext}
          disabled={!canProceed}
          aria-disabled={!canProceed}
          className="btn btn-primary w-full"
        >
          <span>Review Transfer</span>
        </button>
      </div>
    </div>
  )
}
