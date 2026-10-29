import { useState } from 'react'
import { BackstagePanel, StepList, type Step } from '../kit'
import { stepState } from '../transferSteps'
import type { Settings, TransferEvent } from '../types'

interface TransferBackstageProps {
  events: TransferEvent[]
  settings: Settings
  finalStatus: string | null
  workflowId: string | null
  executionUrl: string | null
}

interface StepDef {
  key: string
  label: string
  service: string
  scenario?: Settings['scenario']
}

const WORKFLOW_STEPS: StepDef[] = [
  { key: 'validate', label: 'Validate transfer', service: 'Bank service' },
  { key: 'withdraw', label: 'Withdraw funds', service: 'Bank service' },
  { key: 'approval_wait', label: 'Await approval', service: 'Signal from a bank employee', scenario: 'human_in_the_loop' },
  { key: 'deposit', label: 'Deposit funds', service: 'Bank service' },
  { key: 'send_notification_success', label: 'Send notification', service: 'Notification service' },
]

const COMPENSATION_STEPS: StepDef[] = [
  { key: 'undo_withdraw', label: 'Undo withdrawal', service: 'Bank service' },
  { key: 'send_notification_failure', label: 'Notify failure', service: 'Notification service' },
]

const LEGEND = ['pending', 'active', 'waiting', 'retrying', 'completed', 'failed'] as const

function toSteps(defs: StepDef[], events: TransferEvent[], detailed: boolean): Step[] {
  return defs.map((def) => {
    const { status, last } = stepState(def.key, events)
    return {
      key: def.key,
      label: def.label,
      status,
      attempt: last?.attempt,
      detail: (detailed && last?.detail) || def.service,
      note: (detailed && last?.error) || undefined,
    }
  })
}

export function TransferBackstage({
  events,
  settings,
  finalStatus,
  workflowId,
  executionUrl,
}: TransferBackstageProps) {
  const detailed = settings.presentation_mode === 'detailed'
  const steps = events.length
    ? toSteps(
        WORKFLOW_STEPS.filter((s) => !s.scenario || s.scenario === settings.scenario),
        events,
        detailed
      )
    : []
  const compensating = events.some((e) => COMPENSATION_STEPS.some((s) => s.key === e.step))
  const compensationSteps = compensating
    ? toSteps(COMPENSATION_STEPS, events, detailed).filter((s) => s.status !== 'pending')
    : []
  const approval = stepState('approval_wait', events)

  let banner = null
  if (approval.status === 'waiting' && approval.last) {
    banner = <ApprovalBanner transferId={approval.last.transfer_id} />
  } else if (compensating && !finalStatus) {
    banner = (
      <div className="state-banner">
        <strong>Compensating</strong>
        <span>The deposit failed, so the Workflow is reversing the withdrawal.</span>
      </div>
    )
  } else if (finalStatus === 'reversed') {
    banner = (
      <div className="state-banner is-error">
        <strong>Transfer failed · withdrawal reversed</strong>
        <span>The funds are back in the source account.</span>
      </div>
    )
  } else if (finalStatus === 'failed') {
    banner = (
      <div className="state-banner is-error">
        <strong>Transfer failed</strong>
      </div>
    )
  }

  return (
    <BackstagePanel
      steps={steps}
      title="Behind the scenes"
      subtitle="Temporal Workflow"
      empty="Start a transfer to see what happens behind the scenes"
      workflowId={workflowId}
      executionUrl={executionUrl}
      banner={banner}
    >
      {compensationSteps.length > 0 && (
        <div className="grid gap-2">
          <p className="eyebrow">Compensation (saga)</p>
          <StepList steps={compensationSteps} />
        </div>
      )}
      <div className="legend" aria-hidden="true">
        {LEGEND.map((status) => (
          <span key={status} data-status={status}>
            <i className="status-dot" />
            {status === 'active' ? 'Running' : status}
          </span>
        ))}
      </div>
    </BackstagePanel>
  )
}

/** Sends the approval Signal from right here, so the presenter needn't switch to Bank Operations. */
function ApprovalBanner({ transferId }: { transferId: string }) {
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
    <div className="state-banner">
      <strong>Waiting for approval</strong>
      <span>
        {state === 'error'
          ? 'Not ready yet. Try again in a second.'
          : 'A bank employee has 30 seconds to approve. Approve here or on the Bank operations tab.'}
      </span>
      <div className="mt-1">
        <button
          type="button"
          onClick={approve}
          disabled={state === 'sending' || state === 'sent'}
          className="button small primary green"
        >
          {state === 'sent' ? 'Approval sent' : state === 'sending' ? 'Sending…' : 'Approve transfer'}
        </button>
      </div>
    </div>
  )
}
