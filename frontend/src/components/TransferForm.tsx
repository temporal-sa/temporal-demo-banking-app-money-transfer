import type { Account } from '../types'
import { BackButton } from './BackButton'
import { Select } from './Select'

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

const QUICK_AMOUNTS = [50, 100, 250, 500]

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

  const fromOptions = [
    { value: '', label: 'Select account' },
    ...accounts
      .filter((a) => a.id !== 'ACC-999')
      .map((a) => ({ value: a.id, label: `${a.name} (${formatCurrency(a.balance)})` })),
  ]
  const toOptions = [
    { value: '', label: 'Select account' },
    ...accounts.map((a) => ({
      value: a.id,
      label: `${a.name} — ${a.owner}`,
      disabled: a.id === fromAccount,
    })),
  ]

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border flex items-center gap-1">
        <BackButton onClick={onBack} />
        <h1 className="text-xl font-light tracking-tight">Send Money</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 grid gap-5 content-start">
        <Select label="From" value={fromAccount} options={fromOptions} onChange={onFromChange} />
        <Select label="To" value={toAccount} options={toOptions} onChange={onToChange} />

        <div className="field">
          <span id="amount-label">Amount</span>
          <div className="amount-input">
            <span aria-hidden="true">$</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              placeholder="0.00"
              aria-labelledby="amount-label"
              value={amount}
              onChange={(e) => onAmountChange(e.target.value)}
            />
          </div>
        </div>

        <div className="chips" role="group" aria-label="Quick amounts">
          {QUICK_AMOUNTS.map((val) => (
            <button
              key={val}
              type="button"
              className="chip flex-1"
              aria-pressed={amount === String(val)}
              onClick={() => onAmountChange(String(val))}
            >
              ${val}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 border-t border-border">
        <button
          type="button"
          onClick={onNext}
          disabled={!canProceed}
          className="button primary ultraviolet w-full"
        >
          Review transfer
        </button>
      </div>
    </div>
  )
}
