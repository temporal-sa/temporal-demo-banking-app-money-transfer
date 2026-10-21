import { useState } from 'react'
import type { Settings, StepStatus, TransferEvent } from '../types'
import { Icon, type IconName } from './Icon'

interface WorkflowDiagramProps {
  events: TransferEvent[]
  settings: Settings
  finalStatus: string | null
  temporalWorkflowUrl?: string | null
}

interface StepDef {
  key: string
  label: string
  service: string
  icon: IconName
  conditionalScenario?: string
}

const WORKFLOW_STEPS: StepDef[] = [
  { key: 'validate', label: 'Validate Transfer', service: 'Bank Service', icon: 'validate' },
  { key: 'withdraw', label: 'Withdraw Funds', service: 'Bank Service', icon: 'withdraw' },
  { key: 'approval_wait', label: 'Await Approval', service: 'Signal (Human)', icon: 'user', conditionalScenario: 'human_in_the_loop' },
  { key: 'deposit', label: 'Deposit Funds', service: 'Bank Service', icon: 'deposit' },
  { key: 'send_notification_success', label: 'Send Notification', service: 'Notification', icon: 'bell' },
]

const COMPENSATION_STEPS: StepDef[] = [
  { key: 'undo_withdraw', label: 'Undo Withdrawal', service: 'Bank Service', icon: 'undo' },
  { key: 'send_notification_failure', label: 'Notify Failure', service: 'Notification', icon: 'bell' },
]

function getStepState(stepKey: string, events: TransferEvent[]) {
  const stepEvents = events.filter((e) => e.step === stepKey)
  if (stepEvents.length === 0) return { status: 'pending' as StepStatus, events: [], last: undefined }
  const last = stepEvents[stepEvents.length - 1]
  return { status: last.status, events: stepEvents, last }
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'border-(--line) bg-(--slab)',
  running: 'border-(--ultraviolet) bg-(--deep-blue)',
  completed: 'border-(--mint)/60 bg-(--slab)',
  failed: 'border-(--coral) bg-(--slab)',
  retrying: 'border-(--mustard) bg-(--slab)',
}

const STATUS_DOT: Record<string, string> = {
  pending: 'bg-(--gray-500)',
  running: 'bg-(--ultraviolet) animate-pulse',
  completed: 'bg-(--mint)',
  failed: 'bg-(--coral)',
  retrying: 'bg-(--mustard) animate-pulse',
}

const STATUS_LINE: Record<string, string> = {
  pending: 'bg-(--line-strong)',
  completed: 'bg-(--mint)',
}

export function WorkflowDiagram({
  events,
  settings,
  finalStatus,
  temporalWorkflowUrl,
}: WorkflowDiagramProps) {
  const isDetailed = settings.presentation_mode === 'detailed'
  const showCompensation = events.some((e) =>
    COMPENSATION_STEPS.some((cs) => cs.key === e.step)
  )

  const visibleSteps = WORKFLOW_STEPS.filter(
    (s) => !s.conditionalScenario || s.conditionalScenario === settings.scenario
  )

  return (
    <div className="space-y-1">
      {/* Mode badge */}
      <div className="mb-3">
        <a
          href={temporalWorkflowUrl || undefined}
          target="_blank"
          rel="noreferrer"
          aria-disabled={!temporalWorkflowUrl}
          className="btn btn-secondary btn-sm"
          onClick={(event) => {
            if (!temporalWorkflowUrl) event.preventDefault()
          }}
          title={
            temporalWorkflowUrl
              ? 'Open this workflow in Temporal UI'
              : 'Start a transfer to open the workflow'
          }
        >
          <span>Open in Temporal UI</span>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
          </svg>
        </a>
      </div>

      {/* Main steps */}
      {visibleSteps.map((step, i) => {
        const state = getStepState(step.key, events)
        const isLast = i === visibleSteps.length - 1

        return (
          <div key={step.key}>
            <div
              className={`border p-3 transition-all duration-300 ${STATUS_COLORS[state.status]}`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 flex-shrink-0 ${STATUS_DOT[state.status]}`}
                />
                <Icon name={step.icon} className="flex-shrink-0 text-(--indigo-200)" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-(--off-white)">{step.label}</p>
                  <p className="text-xs font-(family-name:--mono) uppercase text-(--gray-400)">{step.service}</p>
                </div>
                {step.key === 'approval_wait' && state.status === 'pending' && (
                  <span className="tag tag-isolated">signal</span>
                )}
              </div>

              {step.key === 'approval_wait' && state.status === 'running' && state.last && (
                <ApproveAction transferId={state.last.transfer_id} />
              )}

              {isDetailed && state.last && (
                <div className="mt-2 ml-8 text-xs space-y-0.5">
                  {state.last.detail && (
                    <p className="text-(--indigo-100)">{state.last.detail}</p>
                  )}
                  {state.last.error && (
                    <p className="text-(--coral) font-(family-name:--mono)">{state.last.error}</p>
                  )}
                  {state.last.attempt > 1 && (
                    <p className="text-(--mustard) font-(family-name:--mono)">
                      Attempt {state.last.attempt}/{state.last.max_attempts}
                    </p>
                  )}
                </div>
              )}

              {state.status === 'retrying' && state.last && !isDetailed && (
                <div className="mt-1.5 ml-8">
                  <span className="tag text-(--mustard) border-(--mustard)">
                    Retry {state.last.attempt}/{state.last.max_attempts}
                  </span>
                </div>
              )}
            </div>

            {!isLast && (
              <div className="flex justify-center py-0.5">
                <div
                  className={`w-0.5 h-4 ${STATUS_LINE[state.status === 'pending' ? 'pending' : 'completed']}`}
                />
              </div>
            )}
          </div>
        )
      })}

      {/* Compensation branch */}
      {showCompensation && (
        <>
          <div className="flex justify-center py-1">
            <div className="w-0.5 h-4 bg-(--coral)" />
          </div>
          <div className="ml-4 border-l-2 border-dashed border-(--coral)/50 pl-3 space-y-1">
            <p className="eyebrow text-(--coral) text-xs mb-2">
              Compensation (Saga)
            </p>
            {COMPENSATION_STEPS.map((step) => {
              const state = getStepState(step.key, events)
              if (state.status === 'pending') return null
              return (
                <div
                  key={step.key}
                  className={`border p-3 transition-all duration-300 ${STATUS_COLORS[state.status]}`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 flex-shrink-0 ${STATUS_DOT[state.status]}`}
                    />
                    <Icon name={step.icon} className="flex-shrink-0 text-(--indigo-200)" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-(--off-white)">{step.label}</p>
                      <p className="text-xs font-(family-name:--mono) uppercase text-(--gray-400)">{step.service}</p>
                    </div>
                  </div>
                  {isDetailed && state.last?.detail && (
                    <p className="mt-1 ml-8 text-xs text-(--indigo-100)">{state.last.detail}</p>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Final status banner */}
      {finalStatus === 'completed' && (
        <div className="onboard-alert is-success mt-3">
          <strong>Transfer completed successfully</strong>
        </div>
      )}
      {finalStatus === 'failed' && (
        <div className="onboard-alert is-error mt-3">
          <strong>Transfer failed</strong>
        </div>
      )}
      {finalStatus === 'reversed' && (
        <div className="onboard-alert is-warn mt-3">
          <strong>Withdrawal reversed — funds returned</strong>
        </div>
      )}
    </div>
  )
}

/** Sends the approval Signal from right here, so the presenter needn't switch to Bank Operations. */
function ApproveAction({ transferId }: { transferId: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  const approve = async () => {
    setState('sending')
    try {
      const res = await fetch(`/api/bank/approve/${transferId}`, { method: 'POST' })
      setState(res.ok ? 'sent' : 'error')
    } catch {
      setState('error')
    }
  }

  return (
    <div className="mt-3 ml-8 flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={approve}
        aria-busy={state === 'sending'}
        aria-disabled={state === 'sending' || state === 'sent'}
        className="btn btn-green btn-sm"
      >
        <span>{state === 'sent' ? 'Approval sent' : 'Approve transfer'}</span>
      </button>
      <span className="text-xs text-(--gray-400)">
        {state === 'error'
          ? 'Not ready yet — try again in a second.'
          : 'or use the Bank Operations tab'}
      </span>
    </div>
  )
}
