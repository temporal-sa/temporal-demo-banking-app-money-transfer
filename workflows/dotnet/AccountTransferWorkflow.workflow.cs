using Microsoft.Extensions.Logging;
using Temporalio.Common;
using Temporalio.Converters;
using Temporalio.Exceptions;
using Temporalio.Workflows;

namespace Banking;

/// <summary>
/// Moves money between two accounts. It's dynamic, so it runs for every
/// Workflow Type, and the type picks the scenario.
/// </summary>
[Workflow(Dynamic = true)]
public class AccountTransferWorkflow
{
    private const string AdvancedVisibility = "AccountTransferWorkflowAdvancedVisibility";
    private const string NeedsApproval = "AccountTransferWorkflowHumanInLoop";
    private const string Bug = "AccountTransferWorkflowRecoverableFailure";
    private const int ApprovalSeconds = 30;

    private static readonly SearchAttributeKey<string> Step = SearchAttributeKey.CreateKeyword("Step");

    // No MaximumAttempts: an outage can last longer than any count we'd pick,
    // so Activities retry until they succeed or fail non-retryably.
    private static readonly ActivityOptions Options = new()
    {
        StartToCloseTimeout = TimeSpan.FromSeconds(5),
        RetryPolicy = new()
        {
            InitialInterval = TimeSpan.FromSeconds(1),
            BackoffCoefficient = 2,
            MaximumInterval = TimeSpan.FromSeconds(30),
        },
    };

    private int progress;
    private string transferState = string.Empty;
    private bool approved;
    private DepositResponse depositResponse = new(string.Empty);
    private string workflowType = string.Empty;

    [WorkflowRun]
    public async Task<TransferOutput> RunAsync(IRawValue[] args)
    {
        var input = Workflow.PayloadConverter.ToValue<TransferInput>(args[0]);
        workflowType = Workflow.Info.WorkflowType;
        var idempotencyKey = Workflow.NewGuid().ToString();

        // Validate
        UpsertStep("Validate");
        await Workflow.ExecuteActivityAsync((TransferActivities a) => a.ValidateAsync(input), Options);
        await UpdateProgressAsync(25, 1);

        // Withdraw
        UpsertStep("Withdraw");
        await Workflow.ExecuteActivityAsync(
            (TransferActivities a) => a.WithdrawAsync(idempotencyKey, input.Amount, workflowType), Options);
        await UpdateProgressAsync(50, 3);

        // Human in the loop: wait for the approveTransfer Signal
        if (workflowType == NeedsApproval)
        {
            await Workflow.ExecuteActivityAsync((TransferActivities a) => a.RegisterApprovalAsync(input), Options);
            await UpdateProgressAsync(30, 0, "waiting");

            if (!await Workflow.WaitConditionAsync(() => approved, TimeSpan.FromSeconds(ApprovalSeconds)))
            {
                await Workflow.ExecuteActivityAsync((TransferActivities a) => a.RemoveApprovalAsync(), Options);
                throw new ApplicationFailureException(
                    $"Approval not received within {ApprovalSeconds} seconds",
                    errorType: "ApprovalTimeout",
                    nonRetryable: true);
            }
        }

        // A plain exception fails the Workflow Task, not the Workflow. The transfer
        // stays Running, and fixing the code lets it carry on from here.
        if (workflowType == Bug)
        {
            throw new InvalidOperationException("Simulated bug - fix me!");
        }

        // Deposit, and undo the withdrawal if it fails for good
        UpsertStep("Deposit");
        try
        {
            depositResponse = await Workflow.ExecuteActivityAsync(
                (TransferActivities a) => a.DepositAsync(idempotencyKey, input.Amount, workflowType), Options);
            await UpdateProgressAsync(75, 1);
        }
        catch (ActivityFailureException e)
        {
            Workflow.Logger.LogInformation("Deposit failed unrecoverable error, reverting withdraw");
            await Workflow.ExecuteActivityAsync((TransferActivities a) => a.UndoWithdrawAsync(input.Amount), Options);
            throw new ApplicationFailureException(
                e.InnerException?.Message ?? e.Message, errorType: "DepositFailed", nonRetryable: true);
        }

        // Send notification
        UpsertStep("Send notification");
        await Workflow.ExecuteActivityAsync((TransferActivities a) => a.SendNotificationAsync(), Options);
        await UpdateProgressAsync(100, 1, "finished");

        return new TransferOutput(depositResponse);
    }

    [WorkflowSignal("approveTransfer")]
    public Task ApproveTransferAsync()
    {
        if (transferState == "waiting")
        {
            approved = true;
        }
        else
        {
            Workflow.Logger.LogInformation("Approval not applied. Transfer is not waiting for approval");
        }
        return Task.CompletedTask;
    }

    [WorkflowQuery("transferStatus")]
    public TransferStatus GetTransferStatus() =>
        new(progress, transferState, string.Empty, depositResponse, ApprovalSeconds);

    private async Task UpdateProgressAsync(int percent, int seconds, string state = "running")
    {
        if (seconds > 0)
        {
            await Workflow.DelayAsync(TimeSpan.FromSeconds(seconds));
        }
        transferState = state;
        progress = percent;
    }

    private void UpsertStep(string step)
    {
        if (workflowType == AdvancedVisibility)
        {
            Workflow.UpsertTypedSearchAttributes(Step.ValueSet(step));
        }
    }
}
