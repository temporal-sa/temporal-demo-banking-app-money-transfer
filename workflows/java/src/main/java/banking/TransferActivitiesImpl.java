package banking;

import banking.BackendClient.Event;
import banking.Transfers.DepositResponse;
import banking.Transfers.TransferInput;
import io.temporal.activity.Activity;
import io.temporal.failure.ApplicationFailure;

public class TransferActivitiesImpl implements TransferActivities {
    private static final String API_DOWNTIME = "AccountTransferWorkflowAPIDowntime";
    private static final String INVALID_ACCOUNT = "AccountTransferWorkflowInvalidAccount";
    private static final int EVENT_MAX_ATTEMPTS = 10;

    private final BackendClient backend;

    public TransferActivitiesImpl(BackendClient backend) {
        this.backend = backend;
    }

    @Override
    public String validate(TransferInput input) {
        String id = workflowId();
        backend.emit(id, Event.of("validate", "running"));
        pause(1000);
        backend.emit(id, Event.of("validate", "completed")
                .detail("Validated: " + input.fromAccount() + " -> " + input.toAccount()));
        return "SUCCESS";
    }

    @Override
    public String withdraw(String idempotencyKey, double amount, String workflowType) {
        String id = workflowId();
        int attempt = attempt();
        backend.emit(id, Event.of("withdraw", "running").attempt(attempt, EVENT_MAX_ATTEMPTS));

        if (API_DOWNTIME.equals(simulateExternalOperation(1000, workflowType, attempt))) {
            backend.emit(id, Event.of("withdraw", "retrying")
                    .attempt(attempt, EVENT_MAX_ATTEMPTS)
                    .error("Withdraw API unavailable"));
            throw ApplicationFailure.newFailure("Withdraw activity failed, API unavailable", "ApiUnavailable");
        }

        backend.emit(id, Event.of("withdraw", "completed").detail(String.format("Withdrawn $%.2f", amount)));
        return "SUCCESS";
    }

    @Override
    public DepositResponse deposit(String idempotencyKey, double amount, String workflowType) {
        String id = workflowId();
        int attempt = attempt();
        backend.emit(id, Event.of("deposit", "running").attempt(attempt, EVENT_MAX_ATTEMPTS));

        if (INVALID_ACCOUNT.equals(simulateExternalOperation(1000, workflowType, attempt))) {
            backend.emit(id, Event.of("deposit", "failed").error("Account is invalid"));
            // Retrying can't fix a bad account, so the Workflow compensates at once.
            throw ApplicationFailure.newNonRetryableFailure(
                    "Deposit activity failed, account is invalid", "InvalidAccount");
        }

        backend.emit(id, Event.of("deposit", "completed").detail(String.format("Deposited $%.2f", amount)));
        return new DepositResponse("example-transfer-id");
    }

    @Override
    public String sendNotification() {
        pause(1000);
        backend.emit(workflowId(), Event.of("send_notification_success", "completed")
                .detail("Customer notified: Transfer completed successfully!"));
        return "SUCCESS";
    }

    @Override
    public boolean undoWithdraw(double amount) {
        String id = workflowId();
        backend.emit(id, Event.of("undo_withdraw", "running"));
        pause(1000);
        backend.emit(id, Event.of("undo_withdraw", "completed")
                .detail(String.format("Withdrawal reversed: $%.2f", amount)));
        return true;
    }

    @Override
    public String registerApproval(TransferInput input) {
        String id = workflowId();
        backend.emit(id, Event.of("approval_wait", "running").detail("Awaiting bank employee approval..."));
        backend.registerApproval(id, input);
        return "SUCCESS";
    }

    @Override
    public String removeApproval() {
        String id = workflowId();
        backend.removeApproval(id);
        backend.emit(id, Event.of("approval_wait", "failed")
                .detail("Approval timed out — transfer denied automatically"));
        return "SUCCESS";
    }

    private static String workflowId() {
        return Activity.getExecutionContext().getInfo().getWorkflowId();
    }

    private static int attempt() {
        return Activity.getExecutionContext().getInfo().getAttempt();
    }

    /** Stands in for a call to the bank. Each attempt is faster than the last, and the fifth one always works. */
    private static String simulateExternalOperation(int ms, String workflowType, int attempt) {
        pause(ms / attempt);
        return attempt < 5 ? workflowType : "NoError";
    }

    private static void pause(long ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw Activity.wrap(e);
        }
    }
}
