package banking;

import io.temporal.client.WorkflowClient;
import io.temporal.client.WorkflowClientOptions;
import io.temporal.common.converter.CodecDataConverter;
import io.temporal.common.converter.DefaultDataConverter;
import io.temporal.envconfig.ClientConfigProfile;
import io.temporal.envconfig.LoadClientConfigProfileOptions;
import io.temporal.serviceclient.WorkflowServiceStubs;
import io.temporal.worker.Worker;
import io.temporal.worker.WorkerFactory;
import java.io.IOException;
import java.util.List;

public final class BankingWorker {
    private BankingWorker() {}

    public static void main(String[] args) throws IOException {
        // Environment only: a developer's default CLI profile may point at a real Cloud namespace.
        ClientConfigProfile profile = ClientConfigProfile.load(
                LoadClientConfigProfileOptions.newBuilder().setDisableFile(true).build());

        WorkflowClientOptions.Builder clientOptions = WorkflowClientOptions.newBuilder(profile.toWorkflowClientOptions());
        if (EncryptionCodec.enabled()) {
            System.out.println("Encrypting payloads");
            clientOptions.setDataConverter(new CodecDataConverter(
                    DefaultDataConverter.newDefaultInstance(), List.of(new EncryptionCodec())));
        }

        WorkflowServiceStubs service = WorkflowServiceStubs.newServiceStubs(profile.toWorkflowServiceStubsOptions());
        WorkflowClient client = WorkflowClient.newInstance(service, clientOptions.build());

        String configured = System.getenv("TEMPORAL_TASK_QUEUE");
        String taskQueue = configured == null || configured.isEmpty() ? "MoneyTransfer" : configured;

        WorkerFactory factory = WorkerFactory.newInstance(client);
        Worker worker = factory.newWorker(taskQueue);
        worker.registerWorkflowImplementationTypes(AccountTransferWorkflow.class);
        worker.registerActivitiesImplementations(
                new TransferActivitiesImpl(new BackendClient(System.getenv("BANKING_BACKEND_URL"))));

        factory.start();
        System.out.println("Java worker started, listening on task queue: " + taskQueue);
    }
}
