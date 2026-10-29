import type { TransferScenario } from './types'

export const SCENARIOS: {
  value: TransferScenario
  label: string
  description: string
}[] = [
  {
    value: 'happy_path',
    label: 'Happy Path',
    description: 'Standard transfer — everything succeeds',
  },
  {
    value: 'advanced_visibility',
    label: 'Advanced Visibility',
    description: 'Updates search attributes at each workflow step',
  },
  {
    value: 'human_in_the_loop',
    label: 'Human-in-the-Loop',
    description: 'Pauses for bank employee approval with 30s timeout',
  },
  {
    value: 'api_downtime',
    label: 'API Downtime',
    description: 'Deposit fails ~5 times then recovers automatically',
  },
  {
    value: 'bug_in_workflow',
    label: 'Bug in Workflow',
    description: 'Intentional error — demonstrates versioning/patching',
  },
  {
    value: 'invalid_account',
    label: 'Invalid Account',
    description: 'Non-retryable failure — immediate fail on validation',
  },
]
