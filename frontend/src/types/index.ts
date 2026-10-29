export type TransferScenario =
  | 'happy_path'
  | 'advanced_visibility'
  | 'human_in_the_loop'
  | 'api_downtime'
  | 'bug_in_workflow'
  | 'invalid_account'

export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'retrying'
export type PresentationMode = 'simple' | 'detailed'
export type CodeLanguage = 'python' | 'go' | 'typescript'

export interface Settings {
  scenario: TransferScenario
  presentation_mode: PresentationMode
}

export interface TemporalUiInfo {
  base_url: string
  namespace: string
  namespace_url: string
}

export interface CreateTransferResponse {
  transfer_id: string
  status: string
  workflow_id?: string
  run_id?: string
  temporal_ui_url?: string
}

export interface Account {
  id: string
  name: string
  owner: string
  balance: number
  account_type: string
}

export interface TransferEvent {
  transfer_id: string
  step: string
  status: StepStatus
  attempt: number
  max_attempts: number
  error: string | null
  detail: string
  timestamp: string
}

export type PhoneScreen = 'accounts' | 'transfer' | 'review' | 'tracking'
export type DemoTab = 'customer' | 'operations'
