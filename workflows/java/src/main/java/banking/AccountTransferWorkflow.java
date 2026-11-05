package banking;

import banking.Transfers.DepositResponse;
import banking.Transfers.TransferInput;
import banking.Transfers.TransferOutput;
import banking.Transfers.TransferStatus;
import io.temporal.activity.ActivityOptions;
import io.temporal.common.RetryOptions;
import io.temporal.common.SearchAttributeKey;
import io.temporal.common.converter.EncodedValues;
import io.temporal.failure.ActivityFailure;
import io.temporal.failure.ApplicationFailure;
import io.temporal.workflow.DynamicWorkflow;
import io.temporal.workflow.Workflow;
import java.time.Duration;
import org.slf4j.Logger;

/** Moves money between two accounts. It's dynamic, so it runs for every Workflow Type, and the type picks the scenario. */
public class AccountTransferWorkflow implements DynamicWorkflow, TransferMessages {
    private static final String ADVANCED_VISIBILITY = "AccountTransferWorkflowAdvancedVisibility";
    private static final String NEEDS_APPROVAL = "AccountTransferWorkflowHumanInLoop";
    private static final String BUG = "AccountTransferWorkflowRecoverableFailure";
    private static final int APPROVAL_SECONDS = 30;

    private static final SearchAttributeKey<String> STEP = SearchAttributeKey.forKeyword("Step");
    private static final Logger logger = Workflow.getLogger(AccountTransferWorkflow.class);

    // No maximum attempts: an outage can last longer than any count we'd pick,
    // so Activities retry until they succeed or fail non-retryably.
    private final TransferActivities activities = Workflow.newActivityStub(
            TransferActivities.class,
            ActivityOptions.newBuilder()
                    .setStartToCloseTimeout(Duration.ofSeconds(5))
                    .setRetryOptions(RetryOptions.newBuilder()
                            .setInitialInterval(Duration.ofSeconds(1))
                            .setBackoffCoefficient(2)
                            .setMaximumInterval(Duration.ofSeconds(30))
                            .build())
                    .build());

    private int progress = 0;
    private String transferState = "";
    private boolean approved = false;
    private DepositResponse depositResponse = new DepositResponse("");
    private String workflowType;

    @Override
    public Object execute(EncodedValues args) {
        TransferInput input = args.get(0, TransferInput.class);
        workflowType = Workflow.getInfo().getWorkflowType();
        String idempotencyKey = Workflow.randomUUID().toString();

        // Validate
        upsertStep("Validate");
        activities.validate(input);
        updateProgress(25, 1, "running");

        // Withdraw
        upsertStep("Withdraw");
        activities.withdraw(idempotencyKey, input.amount(), workflowType);
        updateProgress(50, 3, "running");

        // Human in the loop: wait for the approveTransfer Signal
        if (NEEDS_APPROVAL.equals(workflowType)) {
            activities.registerApproval(input);
            updateProgress(30, 0, "waiting");

            if (!Workflow.await(Duration.ofSeconds(APPROVAL_SECONDS), () -> approved)) {
                activities.removeApproval();
                throw ApplicationFailure.newNonRetryableFailure(
                        "Approval not received within " + APPROVAL_SECONDS + " seconds", "ApprovalTimeout");
            }
        }

        // A plain exception fails the Workflow Task, not the Workflow. The transfer
        // stays Running, and fixing the code lets it carry on from here.
        if (BUG.equals(workflowType)) {
            throw new IllegalStateException("Simulated bug - fix me!");
        }

        // Deposit, and undo the withdrawal if it fails for good
        upsertStep("Deposit");
        try {
            depositResponse = activities.deposit(idempotencyKey, input.amount(), workflowType);
            updateProgress(75, 1, "running");
        } catch (ActivityFailure e) {
            logger.info("Deposit failed unrecoverable error, reverting withdraw");
            activities.undoWithdraw(input.amount());
            String reason = e.getCause() instanceof ApplicationFailure cause ? cause.getOriginalMessage() : e.getMessage();
            throw ApplicationFailure.newNonRetryableFailure(reason, "DepositFailed");
        }

        // Send notification
        upsertStep("Send notification");
        activities.sendNotification();
        updateProgress(100, 1, "finished");

        return new TransferOutput(depositResponse);
    }

    @Override
    public void approveTransfer() {
        if ("waiting".equals(transferState)) {
            approved = true;
        } else {
            logger.info("Approval not applied. Transfer is not waiting for approval");
        }
    }

    @Override
    public TransferStatus transferStatus() {
        return new TransferStatus(progress, transferState, "", depositResponse, APPROVAL_SECONDS);
    }

    private void updateProgress(int percent, int seconds, String state) {
        if (seconds > 0) {
            Workflow.sleep(Duration.ofSeconds(seconds));
        }
        transferState = state;
        progress = percent;
    }

    private void upsertStep(String step) {
        if (ADVANCED_VISIBILITY.equals(workflowType)) {
            Workflow.upsertTypedSearchAttributes(STEP.valueSet(step));
        }
    }
}
