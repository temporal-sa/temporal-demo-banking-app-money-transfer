// Package transfer holds the money transfer Workflow, its Activities and the
// payload codec.
package transfer

import (
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"go.temporal.io/sdk/temporal"
	"go.temporal.io/sdk/workflow"
)

const (
	// TaskQueue is used when TEMPORAL_TASK_QUEUE is not set.
	TaskQueue = "MoneyTransfer"

	happyPath          = "AccountTransferWorkflow"
	advancedVisibility = "AccountTransferWorkflowAdvancedVisibility"
	needsApproval      = "AccountTransferWorkflowHumanInLoop"
	apiDowntime        = "AccountTransferWorkflowAPIDowntime"
	bug                = "AccountTransferWorkflowRecoverableFailure"
	invalidAccount     = "AccountTransferWorkflowInvalidAccount"

	approvalSeconds = 30
)

// WorkflowTypes lists the scenarios the API can start, one Workflow Type each.
var WorkflowTypes = []string{happyPath, advancedVisibility, needsApproval, apiDowntime, bug, invalidAccount}

var stepAttribute = temporal.NewSearchAttributeKeyKeyword("Step")

// Input is what the API starts each transfer with.
type Input struct {
	Amount      float64 `json:"amount"`
	FromAccount string  `json:"fromAccount"`
	ToAccount   string  `json:"toAccount"`
}

// DepositResponse identifies the deposit.
type DepositResponse struct {
	ChargeID string `json:"chargeId"`
}

// Output is the Workflow's result.
type Output struct {
	DepositResponse DepositResponse `json:"depositResponse"`
}

// Status is what the transferStatus Query returns.
type Status struct {
	ProgressPercentage int             `json:"progressPercentage"`
	TransferState      string          `json:"transferState"`
	WorkflowStatus     string          `json:"workflowStatus"`
	ChargeResult       DepositResponse `json:"chargeResult"`
	ApprovalTime       int             `json:"approvalTime"`
}

// AccountTransfer moves money between two accounts. Its Workflow Type picks the
// scenario.
func AccountTransfer(ctx workflow.Context, input Input) (Output, error) {
	logger := workflow.GetLogger(ctx)
	workflowType := workflow.GetInfo(ctx).WorkflowType.Name

	status := Status{ApprovalTime: approvalSeconds}
	if err := workflow.SetQueryHandler(ctx, "transferStatus", func() (Status, error) {
		return status, nil
	}); err != nil {
		return Output{}, err
	}

	approved := false
	approvals := workflow.GetSignalChannel(ctx, "approveTransfer")
	workflow.Go(ctx, func(ctx workflow.Context) {
		for {
			approvals.Receive(ctx, nil)
			if status.TransferState == "waiting" {
				approved = true
			} else {
				logger.Info("Approval not applied. Transfer is not waiting for approval")
			}
		}
	})

	updateProgress := func(progress int, sleep time.Duration, state string) error {
		if err := workflow.Sleep(ctx, sleep); err != nil {
			return err
		}
		status.TransferState = state
		status.ProgressPercentage = progress
		return nil
	}
	upsertStep := func(step string) error {
		if workflowType != advancedVisibility {
			return nil
		}
		return workflow.UpsertTypedSearchAttributes(ctx, stepAttribute.ValueSet(step))
	}

	// No MaximumAttempts: an outage can last longer than any count we'd pick,
	// so Activities retry until they succeed or fail non-retryably.
	ctx = workflow.WithActivityOptions(ctx, workflow.ActivityOptions{
		StartToCloseTimeout: 5 * time.Second,
		RetryPolicy: &temporal.RetryPolicy{
			InitialInterval:    time.Second,
			BackoffCoefficient: 2,
			MaximumInterval:    30 * time.Second,
		},
	})

	// The same key on the withdrawal and the deposit lets the bank spot a retry.
	var idempotencyKey string
	if err := workflow.SideEffect(ctx, func(workflow.Context) any {
		return uuid.NewString()
	}).Get(&idempotencyKey); err != nil {
		return Output{}, err
	}

	var acts *Activities

	// Validate
	if err := upsertStep("Validate"); err != nil {
		return Output{}, err
	}
	if err := workflow.ExecuteActivity(ctx, acts.Validate, input).Get(ctx, nil); err != nil {
		return Output{}, err
	}
	if err := updateProgress(25, time.Second, "running"); err != nil {
		return Output{}, err
	}

	// Withdraw
	if err := upsertStep("Withdraw"); err != nil {
		return Output{}, err
	}
	if err := workflow.ExecuteActivity(ctx, acts.Withdraw, idempotencyKey, input.Amount, workflowType).Get(ctx, nil); err != nil {
		return Output{}, err
	}
	if err := updateProgress(50, 3*time.Second, "running"); err != nil {
		return Output{}, err
	}

	// Human in the loop: wait for the approveTransfer Signal
	if workflowType == needsApproval {
		if err := workflow.ExecuteActivity(ctx, acts.RegisterApproval, input).Get(ctx, nil); err != nil {
			return Output{}, err
		}
		if err := updateProgress(30, 0, "waiting"); err != nil {
			return Output{}, err
		}

		ok, err := workflow.AwaitWithTimeout(ctx, approvalSeconds*time.Second, func() bool { return approved })
		if err != nil {
			return Output{}, err
		}
		if !ok {
			if err := workflow.ExecuteActivity(ctx, acts.RemoveApproval, input).Get(ctx, nil); err != nil {
				return Output{}, err
			}
			return Output{}, temporal.NewNonRetryableApplicationError(
				fmt.Sprintf("Approval not received within %d seconds", approvalSeconds), "ApprovalTimeout", nil,
			)
		}
	}

	// A panic fails the Workflow Task, not the Workflow. The transfer stays
	// Running, and fixing the code lets it carry on from here.
	if workflowType == bug {
		panic("Simulated bug - fix me!")
	}

	// Deposit, and undo the withdrawal if it fails for good
	if err := upsertStep("Deposit"); err != nil {
		return Output{}, err
	}
	var deposit DepositResponse
	if err := workflow.ExecuteActivity(ctx, acts.Deposit, idempotencyKey, input.Amount, workflowType).Get(ctx, &deposit); err != nil {
		logger.Info("Deposit failed unrecoverable error, reverting withdraw")
		if err := workflow.ExecuteActivity(ctx, acts.UndoWithdraw, input.Amount).Get(ctx, nil); err != nil {
			return Output{}, err
		}
		message := err.Error()
		var cause *temporal.ApplicationError
		if errors.As(err, &cause) {
			message = cause.Message()
		}
		return Output{}, temporal.NewNonRetryableApplicationError(message, "DepositFailed", nil)
	}
	status.ChargeResult = deposit
	if err := updateProgress(75, time.Second, "running"); err != nil {
		return Output{}, err
	}

	// Send notification
	if err := upsertStep("Send notification"); err != nil {
		return Output{}, err
	}
	if err := workflow.ExecuteActivity(ctx, acts.SendNotification, input).Get(ctx, nil); err != nil {
		return Output{}, err
	}
	if err := updateProgress(100, time.Second, "finished"); err != nil {
		return Output{}, err
	}

	return Output{DepositResponse: deposit}, nil
}
