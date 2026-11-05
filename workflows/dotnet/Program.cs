using Banking;
using Temporalio.Client;
using Temporalio.Common.EnvConfig;
using Temporalio.Converters;
using Temporalio.Worker;

// Environment only: a developer's default CLI profile may point at a real Cloud
// namespace.
var options = ClientEnvConfig.LoadClientConnectOptions(new() { DisableFile = true });
if (string.IsNullOrEmpty(options.TargetHost))
{
    options.TargetHost = "localhost:7233";
}
if (EncryptionCodec.Enabled)
{
    Console.WriteLine("Encrypting payloads");
    options.DataConverter = DataConverter.Default with { PayloadCodec = new EncryptionCodec() };
}
var client = await TemporalClient.ConnectAsync(options);

var configured = Environment.GetEnvironmentVariable("TEMPORAL_TASK_QUEUE");
var taskQueue = string.IsNullOrEmpty(configured) ? "MoneyTransfer" : configured;

using var shutdown = new CancellationTokenSource();
Console.CancelKeyPress += (_, eventArgs) =>
{
    eventArgs.Cancel = true;
    shutdown.Cancel();
};
AppDomain.CurrentDomain.ProcessExit += (_, _) => shutdown.Cancel();

var activities = new TransferActivities(new BackendClient(Environment.GetEnvironmentVariable("BANKING_BACKEND_URL")));
using var worker = new TemporalWorker(
    client,
    new TemporalWorkerOptions(taskQueue)
        .AddWorkflow<AccountTransferWorkflow>()
        .AddAllActivities(activities));

Console.WriteLine($".NET worker started, listening on task queue: {taskQueue}");
try
{
    await worker.ExecuteAsync(shutdown.Token);
}
catch (OperationCanceledException)
{
    Console.WriteLine("Worker stopped");
}
