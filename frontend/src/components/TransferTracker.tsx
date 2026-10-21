import type { Settings, StepStatus, TransferEvent } from '../types'
import { Icon, type IconName } from './Icon'

interface TransferTrackerProps {
  events: TransferEvent[]
  finalStatus: string | null
  settings: Settings
  onNewTransfer: () => void
}

const PHASES = [
  {
    key: 'validated',
    label: 'Validated',
    icon: 'validate' as IconName,
    matchSteps: ['validate'],
  },
  {
    key: 'withdrawn',
    label: 'Funds Withdrawn',
    icon: 'withdraw' as IconName,
    matchSteps: ['withdraw'],
  },
  {
    key: 'approval',
    label: 'Approval',
    icon: 'user' as IconName,
    matchSteps: ['approval_wait'],
    conditionalScenario: 'human_in_the_loop' as const,
  },
  {
    key: 'deposited',
    label: 'Deposited',
    icon: 'deposit' as IconName,
    matchSteps: ['deposit'],
  },
  {
    key: 'complete',
    label: 'Complete',
    icon: 'bell' as IconName,
    matchSteps: ['send_notification_success'],
  },
]

function getPhaseStatus(matchSteps: string[], events: TransferEvent[]): StepStatus {
  const relevant = events.filter((e) => matchSteps.includes(e.step))
  if (relevant.length === 0) return 'pending'

  const lastByStep = new Map<string, TransferEvent>()
  for (const e of relevant) {
    lastByStep.set(e.step, e)
  }
  const statuses = [...lastByStep.values()].map((e) => e.status)

  if (statuses.includes('failed')) return 'failed'
  if (statuses.includes('retrying')) return 'retrying'
  if (statuses.includes('running')) return 'running'
  if (statuses.includes('completed')) return 'completed'
  return 'running'
}

export function TransferTracker({
  events,
  finalStatus,
  settings,
  onNewTransfer,
}: TransferTrackerProps) {
  const hasFailed = finalStatus === 'failed'
  const isComplete = finalStatus === 'completed'
  const isReversed = finalStatus === 'reversed'
  const isDone = hasFailed || isComplete || isReversed

  // Filter phases based on scenario
  const visiblePhases = PHASES.filter(
    (p) => !p.conditionalScenario || p.conditionalScenario === settings.scenario
  )

  // Check retry state
  const depositEvents = events.filter((e) => e.step === 'deposit')
  const lastDepositEvent = depositEvents[depositEvents.length - 1]
  const isActivelyRetrying =
    lastDepositEvent &&
    (lastDepositEvent.status === 'retrying' || lastDepositEvent.status === 'running') &&
    !isDone

  // Active phase index
  let lastActiveIndex = -1
  for (let i = 0; i < visiblePhases.length; i++) {
    const status = getPhaseStatus(visiblePhases[i].matchSteps, events)
    if (status !== 'pending') lastActiveIndex = i
  }

  // Hero status
  let heroIcon: IconName = 'clock'
  let heroTitle = 'Processing transfer...'
  let heroSubtitle = 'Hang tight!'
  let heroTone = 'border-l-(--indigo-300)'
  let heroTextColor = 'text-(--off-white)'

  if (isComplete) {
    heroIcon = 'check'
    heroTitle = 'Transfer Complete!'
    heroSubtitle = 'Funds have been deposited successfully.'
    heroTone = 'border-l-(--mint)'
    heroTextColor = 'text-(--mint)'
  } else if (isReversed) {
    heroIcon = 'undo'
    heroTitle = 'Transfer Reversed'
    heroSubtitle = 'Funds have been returned to your account. No charges made.'
    heroTone = 'border-l-(--mustard)'
    heroTextColor = 'text-(--mustard)'
  } else if (hasFailed) {
    heroIcon = 'alert'
    heroTitle = 'Transfer Failed'
    heroSubtitle = "We couldn't complete this transfer. Please try again."
    heroTone = 'border-l-(--coral)'
    heroTextColor = 'text-(--coral)'
  } else if (isActivelyRetrying) {
    heroIcon = 'retry'
    heroTitle = 'Processing transfer...'
    heroSubtitle = 'This may take a moment longer than usual.'
    heroTone = 'border-l-(--mustard)'
    heroTextColor = 'text-(--mustard)'
  } else if (lastActiveIndex >= 2) {
    heroIcon = 'deposit'
    heroTitle = 'Depositing funds...'
    heroSubtitle = "Almost there!"
  }

  // Check for approval waiting
  const approvalEvents = events.filter((e) => e.step === 'approval_wait')
  const lastApproval = approvalEvents[approvalEvents.length - 1]
  if (lastApproval?.status === 'running' && !isDone) {
    heroIcon = 'user'
    heroTitle = 'Awaiting Approval'
    heroSubtitle = 'A bank employee is reviewing this transfer.'
    heroTone = 'border-l-(--purple)'
    heroTextColor = 'text-(--purple)'
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 bg-(--space-black) border-b border-(--line)">
        <h1 className="text-xl font-light tracking-tight">Transfer Status</h1>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Hero card */}
        <div className={`panel mx-4 mt-4 mb-5 p-5 border-l-[3px] text-center ${heroTone}`}>
          <span className={`mx-auto mb-3 w-12 h-12 border border-current flex items-center justify-center ${heroTextColor}`}>
            <Icon name={heroIcon} size={24} />
          </span>
          <h2 className={`text-xl font-light tracking-tight ${heroTextColor}`}>{heroTitle}</h2>
          <p className="text-sm font-light mt-1 text-(--indigo-100)">{heroSubtitle}</p>
        </div>

        {/* Progress tracker */}
        <div className="px-6 mb-4">
          <div className="relative h-9 mx-3">
            {/* Gray track */}
            <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 h-[3px] bg-(--line)" />
            {/* Blue progress */}
            {lastActiveIndex >= 0 && (
              <div
                className="absolute top-1/2 left-0 -translate-y-1/2 h-[3px] bg-(--mint) transition-all duration-700"
                style={{
                  width: `${
                    ((isDone && isComplete
                      ? visiblePhases.length - 1
                      : Math.min(
                          lastActiveIndex + (isDone ? 1 : 0.5),
                          visiblePhases.length - 1
                        )) /
                      (visiblePhases.length - 1)) *
                    100
                  }%`,
                }}
              />
            )}
            {/* Circles */}
            {visiblePhases.map((phase, i) => {
              const status = getPhaseStatus(phase.matchSteps, events)
              const isActive = i === lastActiveIndex && !isDone
              const isCompleted = status === 'completed'
              const isPast = i < lastActiveIndex || (isDone && isCompleted)

              return (
                <div
                  key={phase.key}
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full bg-(--space-black) p-[3px]"
                  style={{
                    left: `${(i / (visiblePhases.length - 1)) * 100}%`,
                  }}
                >
                  {/* Opaque backing (above) hides the track; only this halo pulses, never the circle. */}
                  {isActive && !isPast && !isCompleted && (
                    <span
                      className={`absolute inset-0 rounded-full ${
                        status === 'retrying'
                          ? 'bg-(--mustard)/35 animate-pulse'
                          : status === 'failed'
                            ? 'bg-(--coral)/35'
                            : 'bg-(--ultraviolet)/45 animate-pulse'
                      }`}
                    />
                  )}
                  <div
                    className={`relative w-9 h-9 rounded-full flex items-center justify-center text-sm transition-colors duration-500 ${
                      isPast || isCompleted
                        ? 'bg-(--mint) text-(--space-black)'
                        : isActive
                          ? status === 'retrying'
                            ? 'bg-(--mustard) text-(--space-black)'
                            : status === 'failed'
                              ? 'bg-(--coral) text-(--space-black)'
                              : 'bg-(--ultraviolet) text-white'
                          : 'bg-(--deepest-blue) border-2 border-(--line-strong) text-(--gray-400)'
                    }`}
                  >
                    <Icon
                      name={
                        isPast || isCompleted
                          ? 'check'
                          : isActive && status === 'failed'
                            ? 'alert'
                            : phase.icon
                      }
                      size={16}
                      strokeWidth={isPast || isCompleted ? 2.4 : 1.8}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Error detail */}
        {isDone && !isComplete && (
          <div className="onboard-alert is-error mx-4 mb-4">
            <p className="text-xs font-(family-name:--mono)">
              {events
                .filter((e) => e.error)
                .map((e) => e.error)
                .pop() || 'Transfer could not be completed.'}
            </p>
          </div>
        )}

        {/* Transfer info */}
        <div className="mx-4 mb-4 px-4 py-3 bg-(--deepest-blue) border border-(--line) flex items-center gap-3">
          <Icon name="lock" className="flex-shrink-0 text-(--mint)" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Temporal Banking</p>
            <p className="text-xs font-light text-(--gray-300)">Secure, durable transfer</p>
          </div>
        </div>
      </div>

      {/* Bottom button */}
      {isDone && (
        <div className="p-4 bg-(--space-black) border-t border-(--line)">
          <button
            onClick={onNewTransfer}
            type="button"
            className="btn btn-primary w-full"
          >
            <span>New Transfer</span>
          </button>
        </div>
      )}
    </div>
  )
}
