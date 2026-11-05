package transfer

import (
	"context"
	"fmt"
	"time"

	"go.temporal.io/sdk/activity"
	"go.temporal.io/sdk/temporal"
)

const eventMaxAttempts = 10

// Activities holds what the Activities need, injected when the Worker starts.
type Activities struct {
	Backend *BackendClient
}

// simulateExternalOperation stands in for a call to the bank. Each attempt is
// faster than the last, and the fifth one always works.
func simulateExternalOperation(ms int, workflowType string, attempt int32) string {
	time.Sleep(time.Duration(ms/int(attempt)) * time.Millisecond)
	if attempt < 5 {
		return workflowType
	}
	return "NoError"
}

// Validate checks the transfer.
func (a *Activities) Validate(ctx context.Context, input Input) (string, error) {
	workflowID := activity.GetInfo(ctx).WorkflowExecution.ID
	a.Backend.Emit(workflowID, Event{Step: "validate", Status: "running"})
	time.Sleep(time.Second)
	a.Backend.Emit(workflowID, Event{
		Step: "validate", Status: "completed",
		Detail: fmt.Sprintf("Validated: %s -> %s", input.FromAccount, input.ToAccount),
	})
	return "SUCCESS", nil
}

// Withdraw takes the money from the source account.
func (a *Activities) Withdraw(ctx context.Context, idempotencyKey string, amount float64, workflowType string) (string, error) {
	info := activity.GetInfo(ctx)
	workflowID := info.WorkflowExecution.ID
	attempt := int(info.Attempt)
	a.Backend.Emit(workflowID, Event{Step: "withdraw", Status: "running", Attempt: attempt, MaxAttempts: eventMaxAttempts})

	result := simulateExternalOperation(1000, workflowType, info.Attempt)
	if result == apiDowntime {
		a.Backend.Emit(workflowID, Event{
			Step: "withdraw", Status: "retrying", Attempt: attempt, MaxAttempts: eventMaxAttempts,
			Error: "Withdraw API unavailable",
		})
		return "", temporal.NewApplicationError("Withdraw activity failed, API unavailable", "")
	}

	a.Backend.Emit(workflowID, Event{Step: "withdraw", Status: "completed", Detail: fmt.Sprintf("Withdrawn $%.2f", amount)})
	return "SUCCESS", nil
}

// Deposit puts the money in the destination account.
func (a *Activities) Deposit(ctx context.Context, idempotencyKey string, amount float64, workflowType string) (DepositResponse, error) {
	info := activity.GetInfo(ctx)
	workflowID := info.WorkflowExecution.ID
	a.Backend.Emit(workflowID, Event{Step: "deposit", Status: "running", Attempt: int(info.Attempt), MaxAttempts: eventMaxAttempts})

	result := simulateExternalOperation(1000, workflowType, info.Attempt)
	if result == invalidAccount {
		a.Backend.Emit(workflowID, Event{Step: "deposit", Status: "failed", Error: "Account is invalid"})
		// Retrying can't fix a bad account, so the Workflow compensates at once.
		return DepositResponse{}, temporal.NewNonRetryableApplicationError(
			"Deposit activity failed, account is invalid", "InvalidAccount", nil,
		)
	}

	a.Backend.Emit(workflowID, Event{Step: "deposit", Status: "completed", Detail: fmt.Sprintf("Deposited $%.2f", amount)})
	return DepositResponse{ChargeID: "example-transfer-id"}, nil
}

// SendNotification tells the customer the transfer finished.
func (a *Activities) SendNotification(ctx context.Context, input Input) (string, error) {
	workflowID := activity.GetInfo(ctx).WorkflowExecution.ID
	time.Sleep(time.Second)
	a.Backend.Emit(workflowID, Event{
		Step: "send_notification_success", Status: "completed",
		Detail: "Customer notified: Transfer completed successfully!",
	})
	return "SUCCESS", nil
}

// UndoWithdraw puts the money back after a failed deposit.
func (a *Activities) UndoWithdraw(ctx context.Context, amount float64) (bool, error) {
	workflowID := activity.GetInfo(ctx).WorkflowExecution.ID
	a.Backend.Emit(workflowID, Event{Step: "undo_withdraw", Status: "running"})
	time.Sleep(time.Second)
	a.Backend.Emit(workflowID, Event{
		Step: "undo_withdraw", Status: "completed", Detail: fmt.Sprintf("Withdrawal reversed: $%.2f", amount),
	})
	return true, nil
}

// RegisterApproval puts the transfer on the Bank Operations tab.
func (a *Activities) RegisterApproval(ctx context.Context, input Input) (string, error) {
	workflowID := activity.GetInfo(ctx).WorkflowExecution.ID
	a.Backend.Emit(workflowID, Event{Step: "approval_wait", Status: "running", Detail: "Awaiting bank employee approval..."})
	a.Backend.RegisterApproval(workflowID, input)
	return "SUCCESS", nil
}

// RemoveApproval takes the transfer off the Bank Operations tab after a timeout.
func (a *Activities) RemoveApproval(ctx context.Context, input Input) (string, error) {
	workflowID := activity.GetInfo(ctx).WorkflowExecution.ID
	a.Backend.RemoveApproval(workflowID)
	a.Backend.Emit(workflowID, Event{
		Step: "approval_wait", Status: "failed", Detail: "Approval timed out — transfer denied automatically",
	})
	return "SUCCESS", nil
}
