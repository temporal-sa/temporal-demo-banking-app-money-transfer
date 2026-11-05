export interface TransferInput {
  amount: number;
  fromAccount: string;
  toAccount: string;
}

export interface DepositResponse {
  chargeId: string;
}

export interface TransferOutput {
  depositResponse: DepositResponse;
}

export interface TransferStatus {
  progressPercentage: number;
  transferState: string;
  workflowStatus: string;
  chargeResult: DepositResponse;
  approvalTime: number;
}

export const API_DOWNTIME = 'AccountTransferWorkflowAPIDowntime';
export const INVALID_ACCOUNT = 'AccountTransferWorkflowInvalidAccount';
