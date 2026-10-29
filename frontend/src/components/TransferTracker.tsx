import type { Status } from '../kit'
import { stepState } from '../transferSteps'
import type { Settings, TransferEvent } from '../types'
import { Icon, type IconName } from './Icon'

interface TransferTrackerProps {
  events: TransferEvent[]
  finalStatus: string | null
  settings: Settings
  onNewTransfer: () => void
}

const PHASES: { key: string; label: string; icon: IconName; scenario?: Settings['scenario'] }[] = [
  { key: 'validate', label: 'Validated', icon: 'validate' },
  { key: 'withdraw', label: 'Funds withdrawn', icon: 'withdraw' },
  { key: 'approval_wait', label: 'Approval', icon: 'user', scenario: 'human_in_the_loop' },
  { key: 'deposit', label: 'Deposited', icon: 'deposit' },
  { key: 'send_notification_success', label: 'Complete', icon: 'bell' },
]

interface Hero {
  status: Status
  icon: IconName
  title: string
  subtitle: string
}

function heroFor(finalStatus: string | null, events: TransferEvent[]): Hero {
  if (finalStatus === 'completed') {
    return { status: 'completed', icon: 'check', title: 'Transfer complete', subtitle: 'Funds have been deposited successfully.' }
  }
  if (finalStatus === 'reversed') {
    return { status: 'failed', icon: 'undo', title: 'Transfer reversed', subtitle: 'Funds have been returned to your account. No charges made.' }
  }
  if (finalStatus === 'failed') {
    return { status: 'failed', icon: 'alert', title: 'Transfer failed', subtitle: "We couldn't complete this transfer. Please try again." }
  }
  if (stepState('approval_wait', events).status === 'waiting') {
    return { status: 'waiting', icon: 'user', title: 'Awaiting approval', subtitle: 'A bank employee is reviewing this transfer.' }
  }
  if (stepState('deposit', events).status === 'retrying') {
    return { status: 'retrying', icon: 'retry', title: 'Processing transfer…', subtitle: 'This may take a moment longer than usual.' }
  }
  if (stepState('deposit', events).status === 'active') {
    return { status: 'active', icon: 'deposit', title: 'Depositing funds…', subtitle: 'Almost there!' }
  }
  return { status: 'active', icon: 'clock', title: 'Processing transfer…', subtitle: 'Hang tight!' }
}

const PHASE_MARK: Partial<Record<Status, IconName>> = { completed: 'check', failed: 'alert' }

export function TransferTracker({
  events,
  finalStatus,
  settings,
  onNewTransfer,
}: TransferTrackerProps) {
  const isComplete = finalStatus === 'completed'
  const isDone = finalStatus !== null

  const visiblePhases = PHASES.filter((p) => !p.scenario || p.scenario === settings.scenario)
  const statuses = visiblePhases.map((p) => stepState(p.key, events).status)
  const hero = heroFor(finalStatus, events)

  const lastStarted = statuses.findLastIndex((s) => s !== 'pending')
  const progressSteps = isComplete
    ? visiblePhases.length - 1
    : Math.min(lastStarted + (isDone ? 1 : 0.5), visiblePhases.length - 1)

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border">
        <h1 className="text-xl font-light tracking-tight">Transfer Status</h1>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div
          data-status={hero.status}
          className="mx-4 mt-4 mb-5 p-5 bg-panel border border-border border-l-[3px] border-l-(--status) text-center"
        >
          <span className="mx-auto mb-3 w-12 h-12 border border-current flex items-center justify-center text-(--status)">
            <Icon name={hero.icon} size={24} />
          </span>
          <h2 className="text-xl font-light tracking-tight text-(--status)">{hero.title}</h2>
          <p className="text-sm mt-1 text-t-indigo-100">{hero.subtitle}</p>
        </div>

        <div className="px-6 mb-4">
          <div className="relative h-9 mx-3">
            <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 h-[3px] bg-border" />
            {lastStarted >= 0 && (
              <div
                className="absolute top-1/2 left-0 -translate-y-1/2 h-[3px] bg-t-green transition-all duration-700"
                style={{ width: `${(progressSteps / (visiblePhases.length - 1)) * 100}%` }}
              />
            )}
            <ol className="absolute inset-0" aria-label="Transfer progress">
              {visiblePhases.map((phase, i) => {
                const status = statuses[i]
                const filled = status === 'completed' || status === 'failed'
                const held = status === 'active' || status === 'waiting' || status === 'retrying'
                return (
                  <li
                    key={phase.key}
                    data-status={status}
                    aria-label={`${phase.label}: ${status === 'active' ? 'running' : status}`}
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full bg-space-black p-[3px]"
                    style={{ left: `${(i / (visiblePhases.length - 1)) * 100}%` }}
                  >
                    {/* The opaque backing hides the track; only this halo pulses, never the circle. */}
                    {held && <span className="absolute inset-0 rounded-full bg-(--status)/35 motion-safe:animate-pulse" />}
                    <div
                      className={`relative w-9 h-9 rounded-full flex items-center justify-center border-2 border-(--status) transition-colors duration-500 ${
                        filled ? 'bg-(--status) text-space-black' : 'bg-space-black text-(--status)'
                      }`}
                    >
                      <Icon
                        name={PHASE_MARK[status] ?? phase.icon}
                        size={16}
                        strokeWidth={filled ? 2.4 : 1.8}
                      />
                    </div>
                  </li>
                )
              })}
            </ol>
          </div>
        </div>

        {isDone && !isComplete && (
          <div className="state-banner is-error mx-4 mb-4">
            <span className="font-mono text-xs">
              {events.findLast((e) => e.error)?.error || 'Transfer could not be completed.'}
            </span>
          </div>
        )}

        <div className="mx-4 mb-4 px-4 py-3 bg-panel border border-border flex items-center gap-3">
          <Icon name="lock" className="flex-shrink-0 text-t-green" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Temporal Banking</p>
            <p className="text-xs text-t-slate">Secure, durable transfer</p>
          </div>
        </div>
      </div>

      {isDone && (
        <div className="p-4 border-t border-border">
          <button type="button" onClick={onNewTransfer} className="button primary ultraviolet w-full">
            New transfer
          </button>
        </div>
      )}
    </div>
  )
}
