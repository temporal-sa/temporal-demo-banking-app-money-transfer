import { defineSearchAttributeKey, SearchAttributeType } from '@temporalio/common';
import {
  ActivityFailure,
  ApplicationFailure,
  condition,
  defineQuery,
  defineSignal,
  log,
  proxyActivities,
  setHandler,
  sleep,
  upsertSearchAttributes,
  uuid4,
  workflowInfo,
} from '@temporalio/workflow';
import type { createActivities } from './activities';
import type { DepositResponse, TransferInput, TransferOutput, TransferStatus } from './types';

const ADVANCED_VISIBILITY = 'AccountTransferWorkflowAdvancedVisibility';
const NEEDS_APPROVAL = 'AccountTransferWorkflowHumanInLoop';
const BUG = 'AccountTransferWorkflowRecoverableFailure';
const APPROVAL_SECONDS = 30;

const STEP = defineSearchAttributeKey('Step', SearchAttributeType.KEYWORD);

const approveTransfer = defineSignal('approveTransfer');
const transferStatus = defineQuery<TransferStatus>('transferStatus');

// No maximumAttempts: an outage can last longer than any count we'd pick, so
// Activities retry until they succeed or fail non-retryably.
const activities = proxyActivities<ReturnType<typeof createActivities>>({
  startToCloseTimeout: '5 seconds',
  retry: { initialInterval: '1 second', backoffCoefficient: 2, maximumInterval: '30 seconds' },
});

/**
 * The default export is a dynamic Workflow: it runs for every Workflow Type,
 * and the type picks the scenario.
 */
export default async function accountTransfer(input: TransferInput): Promise<TransferOutput> {
  const workflowType = workflowInfo().workflowType;
  const idempotencyKey = uuid4();

  let progress = 0;
  let transferState = '';
  let approved = false;
  let depositResponse: DepositResponse = { chargeId: '' };

  setHandler(transferStatus, () => ({
    progressPercentage: progress,
    transferState,
    workflowStatus: '',
    chargeResult: depositResponse,
    approvalTime: APPROVAL_SECONDS,
  }));
  setHandler(approveTransfer, () => {
    if (transferState === 'waiting') {
      approved = true;
    } else {
      log.info('Approval not applied. Transfer is not waiting for approval');
    }
  });

  const updateProgress = async (percent: number, seconds: number, state = 'running') => {
    if (seconds > 0) await sleep(seconds * 1000);
    transferState = state;
    progress = percent;
  };
  const upsertStep = (step: string) => {
    if (workflowType === ADVANCED_VISIBILITY) upsertSearchAttributes([{ key: STEP, value: step }]);
  };

  // Validate
  upsertStep('Validate');
  await activities.validate(input);
  await updateProgress(25, 1);

  // Withdraw
  upsertStep('Withdraw');
  await activities.withdraw(idempotencyKey, input.amount, workflowType);
  await updateProgress(50, 3);

  // Human in the loop: wait for the approveTransfer Signal
  if (workflowType === NEEDS_APPROVAL) {
    await activities.registerApproval(input);
    await updateProgress(30, 0, 'waiting');

    if (!(await condition(() => approved, `${APPROVAL_SECONDS} seconds`))) {
      await activities.removeApproval();
      throw ApplicationFailure.nonRetryable(
        `Approval not received within ${APPROVAL_SECONDS} seconds`,
        'ApprovalTimeout',
      );
    }
  }

  // A plain Error fails the Workflow Task, not the Workflow. The transfer stays
  // Running, and fixing the code lets it carry on from here.
  if (workflowType === BUG) {
    throw new Error('Simulated bug - fix me!');
  }

  // Deposit, and undo the withdrawal if it fails for good
  upsertStep('Deposit');
  try {
    depositResponse = await activities.deposit(idempotencyKey, input.amount, workflowType);
    await updateProgress(75, 1);
  } catch (err) {
    if (!(err instanceof ActivityFailure)) throw err;
    log.info('Deposit failed unrecoverable error, reverting withdraw');
    await activities.undoWithdraw(input.amount);
    throw ApplicationFailure.nonRetryable(err.cause?.message ?? err.message, 'DepositFailed');
  }

  // Send notification
  upsertStep('Send notification');
  await activities.sendNotification();
  await updateProgress(100, 1, 'finished');

  return { depositResponse };
}
