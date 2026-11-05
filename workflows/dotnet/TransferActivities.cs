using Temporalio.Activities;
using Temporalio.Exceptions;

namespace Banking;

public class TransferActivities
{
    private const string ApiDowntime = "AccountTransferWorkflowAPIDowntime";
    private const string InvalidAccount = "AccountTransferWorkflowInvalidAccount";
    private const int EventMaxAttempts = 10;

    private readonly BackendClient backend;

    public TransferActivities(BackendClient backend) => this.backend = backend;

    private static ActivityInfo Info => ActivityExecutionContext.Current.Info;

    private static string WorkflowId => Info.WorkflowId!;

    /// <summary>
    /// Stands in for a call to the bank. Each attempt is faster than the last,
    /// and the fifth one always works.
    /// </summary>
    private static async Task<string> SimulateExternalOperationAsync(int ms, string workflowType, int attempt)
    {
        await Task.Delay(ms / attempt);
        return attempt < 5 ? workflowType : "NoError";
    }

    [Activity]
    public async Task<string> ValidateAsync(TransferInput input)
    {
        await backend.EmitAsync(WorkflowId, new("validate", "running"));
        await Task.Delay(1000);
        await backend.EmitAsync(WorkflowId, new("validate", "completed")
        {
            Detail = $"Validated: {input.FromAccount} -> {input.ToAccount}",
        });
        return "SUCCESS";
    }

    [Activity]
    public async Task<string> WithdrawAsync(string idempotencyKey, double amount, string workflowType)
    {
        var attempt = Info.Attempt;
        await backend.EmitAsync(WorkflowId, new("withdraw", "running") { Attempt = attempt, MaxAttempts = EventMaxAttempts });

        if (await SimulateExternalOperationAsync(1000, workflowType, attempt) == ApiDowntime)
        {
            await backend.EmitAsync(WorkflowId, new("withdraw", "retrying")
            {
                Attempt = attempt,
                MaxAttempts = EventMaxAttempts,
                Error = "Withdraw API unavailable",
            });
            throw new ApplicationFailureException("Withdraw activity failed, API unavailable");
        }

        await backend.EmitAsync(WorkflowId, new("withdraw", "completed") { Detail = $"Withdrawn ${amount:F2}" });
        return "SUCCESS";
    }

    [Activity]
    public async Task<DepositResponse> DepositAsync(string idempotencyKey, double amount, string workflowType)
    {
        var attempt = Info.Attempt;
        await backend.EmitAsync(WorkflowId, new("deposit", "running") { Attempt = attempt, MaxAttempts = EventMaxAttempts });

        if (await SimulateExternalOperationAsync(1000, workflowType, attempt) == InvalidAccount)
        {
            await backend.EmitAsync(WorkflowId, new("deposit", "failed") { Error = "Account is invalid" });
            // Retrying can't fix a bad account, so the Workflow compensates at once.
            throw new ApplicationFailureException(
                "Deposit activity failed, account is invalid", errorType: "InvalidAccount", nonRetryable: true);
        }

        await backend.EmitAsync(WorkflowId, new("deposit", "completed") { Detail = $"Deposited ${amount:F2}" });
        return new DepositResponse("example-transfer-id");
    }

    [Activity]
    public async Task<string> SendNotificationAsync()
    {
        await Task.Delay(1000);
        await backend.EmitAsync(WorkflowId, new("send_notification_success", "completed")
        {
            Detail = "Customer notified: Transfer completed successfully!",
        });
        return "SUCCESS";
    }

    [Activity]
    public async Task<bool> UndoWithdrawAsync(double amount)
    {
        await backend.EmitAsync(WorkflowId, new("undo_withdraw", "running"));
        await Task.Delay(1000);
        await backend.EmitAsync(WorkflowId, new("undo_withdraw", "completed")
        {
            Detail = $"Withdrawal reversed: ${amount:F2}",
        });
        return true;
    }

    [Activity]
    public async Task<string> RegisterApprovalAsync(TransferInput input)
    {
        await backend.EmitAsync(WorkflowId, new("approval_wait", "running")
        {
            Detail = "Awaiting bank employee approval...",
        });
        await backend.RegisterApprovalAsync(WorkflowId, input);
        return "SUCCESS";
    }

    [Activity]
    public async Task<string> RemoveApprovalAsync()
    {
        await backend.RemoveApprovalAsync(WorkflowId);
        await backend.EmitAsync(WorkflowId, new("approval_wait", "failed")
        {
            Detail = "Approval timed out — transfer denied automatically",
        });
        return "SUCCESS";
    }
}
