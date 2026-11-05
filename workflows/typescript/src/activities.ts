import { activityInfo, ApplicationFailure, sleep } from '@temporalio/activity';
import type { BackendClient } from './backend';
import { API_DOWNTIME, INVALID_ACCOUNT, type DepositResponse, type TransferInput } from './types';

const EVENT_MAX_ATTEMPTS = 10;

function workflowId(): string {
  return activityInfo().workflowExecution!.workflowId;
}

/**
 * Stands in for a call to the bank. Each attempt is faster than the last, and
 * the fifth one always works.
 */
async function simulateExternalOperation(ms: number, workflowType: string, attempt: number): Promise<string> {
  await sleep(ms / attempt);
  return attempt < 5 ? workflowType : 'NoError';
}

export function createActivities(backend: BackendClient) {
  return {
    async validate(input: TransferInput): Promise<string> {
      const id = workflowId();
      await backend.emit(id, { step: 'validate', status: 'running' });
      await sleep(1000);
      await backend.emit(id, {
        step: 'validate',
        status: 'completed',
        detail: `Validated: ${input.fromAccount} -> ${input.toAccount}`,
      });
      return 'SUCCESS';
    },

    async withdraw(idempotencyKey: string, amount: number, workflowType: string): Promise<string> {
      const id = workflowId();
      const { attempt } = activityInfo();
      await backend.emit(id, { step: 'withdraw', status: 'running', attempt, maxAttempts: EVENT_MAX_ATTEMPTS });

      if ((await simulateExternalOperation(1000, workflowType, attempt)) === API_DOWNTIME) {
        await backend.emit(id, {
          step: 'withdraw',
          status: 'retrying',
          attempt,
          maxAttempts: EVENT_MAX_ATTEMPTS,
          error: 'Withdraw API unavailable',
        });
        throw ApplicationFailure.retryable('Withdraw activity failed, API unavailable');
      }

      await backend.emit(id, { step: 'withdraw', status: 'completed', detail: `Withdrawn $${amount.toFixed(2)}` });
      return 'SUCCESS';
    },

    async deposit(idempotencyKey: string, amount: number, workflowType: string): Promise<DepositResponse> {
      const id = workflowId();
      const { attempt } = activityInfo();
      await backend.emit(id, { step: 'deposit', status: 'running', attempt, maxAttempts: EVENT_MAX_ATTEMPTS });

      if ((await simulateExternalOperation(1000, workflowType, attempt)) === INVALID_ACCOUNT) {
        await backend.emit(id, { step: 'deposit', status: 'failed', error: 'Account is invalid' });
        // Retrying can't fix a bad account, so the Workflow compensates at once.
        throw ApplicationFailure.nonRetryable('Deposit activity failed, account is invalid', 'InvalidAccount');
      }

      await backend.emit(id, { step: 'deposit', status: 'completed', detail: `Deposited $${amount.toFixed(2)}` });
      return { chargeId: 'example-transfer-id' };
    },

    async sendNotification(): Promise<string> {
      await sleep(1000);
      await backend.emit(workflowId(), {
        step: 'send_notification_success',
        status: 'completed',
        detail: 'Customer notified: Transfer completed successfully!',
      });
      return 'SUCCESS';
    },

    async undoWithdraw(amount: number): Promise<boolean> {
      const id = workflowId();
      await backend.emit(id, { step: 'undo_withdraw', status: 'running' });
      await sleep(1000);
      await backend.emit(id, {
        step: 'undo_withdraw',
        status: 'completed',
        detail: `Withdrawal reversed: $${amount.toFixed(2)}`,
      });
      return true;
    },

    async registerApproval(input: TransferInput): Promise<string> {
      const id = workflowId();
      await backend.emit(id, {
        step: 'approval_wait',
        status: 'running',
        detail: 'Awaiting bank employee approval...',
      });
      await backend.registerApproval(id, input);
      return 'SUCCESS';
    },

    async removeApproval(): Promise<string> {
      const id = workflowId();
      await backend.removeApproval(id);
      await backend.emit(id, {
        step: 'approval_wait',
        status: 'failed',
        detail: 'Approval timed out — transfer denied automatically',
      });
      return 'SUCCESS';
    },
  };
}
