package banking;

import banking.Transfers.TransferStatus;
import io.temporal.workflow.QueryMethod;
import io.temporal.workflow.SignalMethod;

/** The Signal and Query a transfer answers, whichever Workflow Type it's running as. */
public interface TransferMessages {
    @SignalMethod(name = "approveTransfer")
    void approveTransfer();

    @QueryMethod(name = "transferStatus")
    TransferStatus transferStatus();
}
