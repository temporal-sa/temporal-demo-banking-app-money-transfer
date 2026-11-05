<?php

declare(strict_types=1);

use Temporal\Workflow\WorkflowInterface;
use Temporal\Workflow\WorkflowMethod;

// One Workflow Type per scenario, all running TransferWorkflow::transfer().

#[WorkflowInterface]
class AccountTransferWorkflow extends TransferWorkflow
{
    #[WorkflowMethod(name: 'AccountTransferWorkflow')]
    public function run(array $input)
    {
        return yield from $this->transfer($input);
    }
}

#[WorkflowInterface]
class AdvancedVisibilityTransfer extends TransferWorkflow
{
    #[WorkflowMethod(name: 'AccountTransferWorkflowAdvancedVisibility')]
    public function run(array $input)
    {
        return yield from $this->transfer($input);
    }
}

#[WorkflowInterface]
class ApprovalTransfer extends TransferWorkflow
{
    #[WorkflowMethod(name: 'AccountTransferWorkflowHumanInLoop')]
    public function run(array $input)
    {
        return yield from $this->transfer($input);
    }
}

#[WorkflowInterface]
class ApiDowntimeTransfer extends TransferWorkflow
{
    #[WorkflowMethod(name: 'AccountTransferWorkflowAPIDowntime')]
    public function run(array $input)
    {
        return yield from $this->transfer($input);
    }
}

#[WorkflowInterface]
class RecoverableFailureTransfer extends TransferWorkflow
{
    #[WorkflowMethod(name: 'AccountTransferWorkflowRecoverableFailure')]
    public function run(array $input)
    {
        return yield from $this->transfer($input);
    }
}

#[WorkflowInterface]
class InvalidAccountTransfer extends TransferWorkflow
{
    #[WorkflowMethod(name: 'AccountTransferWorkflowInvalidAccount')]
    public function run(array $input)
    {
        return yield from $this->transfer($input);
    }
}
