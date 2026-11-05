package banking;

import banking.Transfers.DepositResponse;
import banking.Transfers.TransferInput;
import io.temporal.activity.ActivityInterface;

@ActivityInterface
public interface TransferActivities {
    String validate(TransferInput input);

    String withdraw(String idempotencyKey, double amount, String workflowType);

    DepositResponse deposit(String idempotencyKey, double amount, String workflowType);

    String sendNotification();

    boolean undoWithdraw(double amount);

    String registerApproval(TransferInput input);

    String removeApproval();
}
