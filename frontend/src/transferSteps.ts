import { normalizeStatus, type Status } from './kit/status'
import type { TransferEvent } from './types'

export interface StepState {
  status: Status
  last?: TransferEvent
}

/**
 * A step's state in the kit's status vocabulary, from the latest event for it.
 * The approval step is held on a person rather than doing work, so it reads as waiting.
 */
export function stepState(step: string, events: TransferEvent[]): StepState {
  const last = events.findLast((e) => e.step === step)
  if (!last) return { status: 'pending' }
  if (step === 'approval_wait' && last.status === 'running') return { status: 'waiting', last }
  return { status: normalizeStatus(last.status), last }
}
