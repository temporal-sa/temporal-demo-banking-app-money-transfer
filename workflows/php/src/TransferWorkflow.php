<?php

declare(strict_types=1);

use Temporal\Activity\ActivityOptions;
use Temporal\Common\RetryOptions;
use Temporal\Common\SearchAttributes\SearchAttributeKey;
use Temporal\Exception\Failure\ActivityFailure;
use Temporal\Exception\Failure\ApplicationFailure;
use Temporal\Exception\Failure\TemporalFailure;
use Temporal\Workflow;
use Temporal\Workflow\QueryMethod;
use Temporal\Workflow\SignalMethod;

/** Moves money between two accounts. The Workflow Type picks the scenario. */
abstract class TransferWorkflow
{
    private const ADVANCED_VISIBILITY = 'AccountTransferWorkflowAdvancedVisibility';
    private const NEEDS_APPROVAL = 'AccountTransferWorkflowHumanInLoop';
    private const BUG = 'AccountTransferWorkflowRecoverableFailure';
    private const APPROVAL_SECONDS = 30;

    private int $progress = 0;
    private string $transferState = '';
    private bool $approved = false;
    private array $depositResponse = ['chargeId' => ''];
    private string $workflowType = '';

    protected function transfer(array $input)
    {
        // No maximum attempts: an outage can last longer than any count we'd
        // pick, so Activities retry until they succeed or fail non-retryably.
        $activities = Workflow::newActivityStub(
            TransferActivities::class,
            ActivityOptions::new()
                ->withStartToCloseTimeout('5 seconds')
                ->withRetryOptions(
                    RetryOptions::new()
                        ->withInitialInterval('1 second')
                        ->withBackoffCoefficient(2.0)
                        ->withMaximumInterval('30 seconds'),
                ),
        );

        $this->workflowType = Workflow::getInfo()->type->name;
        $idempotencyKey = (yield Workflow::uuid())->toString();

        // Validate
        $this->upsertStep('Validate');
        yield $activities->validate($input);
        yield from $this->updateProgress(25, 1);

        // Withdraw
        $this->upsertStep('Withdraw');
        yield $activities->withdraw($idempotencyKey, $input['amount'], $this->workflowType);
        yield from $this->updateProgress(50, 3);

        // Human in the loop: wait for the approveTransfer Signal
        if ($this->workflowType === self::NEEDS_APPROVAL) {
            yield $activities->registerApproval($input);
            yield from $this->updateProgress(30, 0, 'waiting');

            $approved = yield Workflow::awaitWithTimeout(self::APPROVAL_SECONDS, fn () => $this->approved);
            if (!$approved) {
                yield $activities->removeApproval();
                throw new ApplicationFailure(
                    sprintf('Approval not received within %d seconds', self::APPROVAL_SECONDS),
                    'ApprovalTimeout',
                    true,
                );
            }
        }

        // An \Error fails the Workflow Task, not the Workflow. The transfer stays
        // Running, and fixing the code lets it carry on from here. In PHP an
        // \Exception would fail the Workflow, so a bug has to be an \Error.
        if ($this->workflowType === self::BUG) {
            throw new \Error('Simulated bug - fix me!');
        }

        // Deposit, and undo the withdrawal if it fails for good
        $this->upsertStep('Deposit');
        try {
            $this->depositResponse = yield $activities->deposit($idempotencyKey, $input['amount'], $this->workflowType);
            yield from $this->updateProgress(75, 1);
        } catch (ActivityFailure $e) {
            yield $activities->undoWithdraw($input['amount']);
            $cause = $e->getPrevious();
            $reason = $cause instanceof TemporalFailure ? $cause->getOriginalMessage() : $e->getMessage();
            throw new ApplicationFailure($reason, 'DepositFailed', true);
        }

        // Send notification
        $this->upsertStep('Send notification');
        yield $activities->sendNotification();
        yield from $this->updateProgress(100, 1, 'finished');

        return ['depositResponse' => $this->depositResponse];
    }

    #[SignalMethod(name: 'approveTransfer')]
    public function approveTransfer(): void
    {
        if ($this->transferState === 'waiting') {
            $this->approved = true;
        }
    }

    #[QueryMethod(name: 'transferStatus')]
    public function transferStatus(): array
    {
        return [
            'progressPercentage' => $this->progress,
            'transferState' => $this->transferState,
            'workflowStatus' => '',
            'chargeResult' => $this->depositResponse,
            'approvalTime' => self::APPROVAL_SECONDS,
        ];
    }

    private function updateProgress(int $progress, int $seconds, string $state = 'running')
    {
        if ($seconds > 0) {
            yield Workflow::timer($seconds);
        }
        $this->transferState = $state;
        $this->progress = $progress;
    }

    private function upsertStep(string $step): void
    {
        if ($this->workflowType === self::ADVANCED_VISIBILITY) {
            Workflow::upsertTypedSearchAttributes(SearchAttributeKey::forKeyword('Step')->valueSet($step));
        }
    }
}
