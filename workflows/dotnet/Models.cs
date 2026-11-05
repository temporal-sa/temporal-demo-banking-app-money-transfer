using System.Text.Json.Serialization;

namespace Banking;

public record TransferInput(
    [property: JsonPropertyName("amount")] double Amount,
    [property: JsonPropertyName("fromAccount")] string FromAccount,
    [property: JsonPropertyName("toAccount")] string ToAccount);

public record DepositResponse([property: JsonPropertyName("chargeId")] string ChargeId);

public record TransferOutput([property: JsonPropertyName("depositResponse")] DepositResponse DepositResponse);

public record TransferStatus(
    [property: JsonPropertyName("progressPercentage")] int ProgressPercentage,
    [property: JsonPropertyName("transferState")] string TransferState,
    [property: JsonPropertyName("workflowStatus")] string WorkflowStatus,
    [property: JsonPropertyName("chargeResult")] DepositResponse ChargeResult,
    [property: JsonPropertyName("approvalTime")] int ApprovalTime);
