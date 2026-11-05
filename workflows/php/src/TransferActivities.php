<?php

declare(strict_types=1);

use Temporal\Activity;
use Temporal\Activity\ActivityInterface;
use Temporal\Activity\ActivityMethod;
use Temporal\Exception\Failure\ApplicationFailure;

#[ActivityInterface(prefix: 'TransferActivities.')]
class TransferActivities
{
    private const API_DOWNTIME = 'AccountTransferWorkflowAPIDowntime';
    private const INVALID_ACCOUNT = 'AccountTransferWorkflowInvalidAccount';
    private const EVENT_MAX_ATTEMPTS = 10;

    public function __construct(private readonly BackendClient $backend) {}

    #[ActivityMethod]
    public function validate(array $input): string
    {
        $id = $this->workflowId();
        $this->backend->emit($id, 'validate', 'running');
        sleep(1);
        $this->backend->emit(
            $id,
            'validate',
            'completed',
            detail: "Validated: {$input['fromAccount']} -> {$input['toAccount']}",
        );
        return 'SUCCESS';
    }

    #[ActivityMethod]
    public function withdraw(string $idempotencyKey, float $amount, string $workflowType): string
    {
        $id = $this->workflowId();
        $attempt = Activity::getInfo()->attempt;
        $this->backend->emit($id, 'withdraw', 'running', attempt: $attempt, maxAttempts: self::EVENT_MAX_ATTEMPTS);

        if ($this->simulateExternalOperation(1000, $workflowType, $attempt) === self::API_DOWNTIME) {
            $this->backend->emit(
                $id,
                'withdraw',
                'retrying',
                attempt: $attempt,
                maxAttempts: self::EVENT_MAX_ATTEMPTS,
                error: 'Withdraw API unavailable',
            );
            throw new ApplicationFailure('Withdraw activity failed, API unavailable', 'ApiUnavailable', false);
        }

        $this->backend->emit($id, 'withdraw', 'completed', detail: sprintf('Withdrawn $%.2f', $amount));
        return 'SUCCESS';
    }

    #[ActivityMethod]
    public function deposit(string $idempotencyKey, float $amount, string $workflowType): array
    {
        $id = $this->workflowId();
        $attempt = Activity::getInfo()->attempt;
        $this->backend->emit($id, 'deposit', 'running', attempt: $attempt, maxAttempts: self::EVENT_MAX_ATTEMPTS);

        if ($this->simulateExternalOperation(1000, $workflowType, $attempt) === self::INVALID_ACCOUNT) {
            $this->backend->emit($id, 'deposit', 'failed', error: 'Account is invalid');
            // Retrying can't fix a bad account, so the Workflow compensates at once.
            throw new ApplicationFailure('Deposit activity failed, account is invalid', 'InvalidAccount', true);
        }

        $this->backend->emit($id, 'deposit', 'completed', detail: sprintf('Deposited $%.2f', $amount));
        return ['chargeId' => 'example-transfer-id'];
    }

    #[ActivityMethod]
    public function sendNotification(): string
    {
        sleep(1);
        $this->backend->emit(
            $this->workflowId(),
            'send_notification_success',
            'completed',
            detail: 'Customer notified: Transfer completed successfully!',
        );
        return 'SUCCESS';
    }

    #[ActivityMethod]
    public function undoWithdraw(float $amount): bool
    {
        $id = $this->workflowId();
        $this->backend->emit($id, 'undo_withdraw', 'running');
        sleep(1);
        $this->backend->emit($id, 'undo_withdraw', 'completed', detail: sprintf('Withdrawal reversed: $%.2f', $amount));
        return true;
    }

    #[ActivityMethod]
    public function registerApproval(array $input): string
    {
        $id = $this->workflowId();
        $this->backend->emit($id, 'approval_wait', 'running', detail: 'Awaiting bank employee approval...');
        $this->backend->registerApproval($id, $input);
        return 'SUCCESS';
    }

    #[ActivityMethod]
    public function removeApproval(): string
    {
        $id = $this->workflowId();
        $this->backend->removeApproval($id);
        $this->backend->emit(
            $id,
            'approval_wait',
            'failed',
            detail: 'Approval timed out — transfer denied automatically',
        );
        return 'SUCCESS';
    }

    private function workflowId(): string
    {
        return Activity::getInfo()->workflowExecution->getID();
    }

    /** Stands in for a call to the bank. Each attempt is faster than the last, and the fifth one always works. */
    private function simulateExternalOperation(int $ms, string $workflowType, int $attempt): string
    {
        usleep(intdiv($ms * 1000, $attempt));
        return $attempt < 5 ? $workflowType : 'NoError';
    }
}
