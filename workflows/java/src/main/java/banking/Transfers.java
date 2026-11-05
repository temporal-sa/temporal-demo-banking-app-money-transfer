package banking;

/** The data a transfer passes around. Field names match the API's JSON. */
public final class Transfers {
    private Transfers() {}

    public record TransferInput(double amount, String fromAccount, String toAccount) {}

    public record DepositResponse(String chargeId) {}

    public record TransferOutput(DepositResponse depositResponse) {}

    public record TransferStatus(
            int progressPercentage,
            String transferState,
            String workflowStatus,
            DepositResponse chargeResult,
            int approvalTime) {}
}
