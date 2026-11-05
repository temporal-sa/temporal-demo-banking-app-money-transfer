<?php

declare(strict_types=1);

use Temporal\DataConverter\BinaryConverter;
use Temporal\DataConverter\DataConverter;
use Temporal\DataConverter\JsonConverter;
use Temporal\DataConverter\NullConverter;
use Temporal\DataConverter\ProtoConverter;
use Temporal\DataConverter\ProtoJsonConverter;
use Temporal\WorkerFactory;

ini_set('display_errors', 'stderr');
require __DIR__ . '/vendor/autoload.php';

$taskQueue = getenv('TEMPORAL_TASK_QUEUE') ?: 'MoneyTransfer';
$backendUrl = rtrim(getenv('BANKING_BACKEND_URL') ?: '', '/');

$converter = null;
if (EncryptingConverter::enabled()) {
    fwrite(STDERR, "Encrypting payloads\n");
    // The plain converters stay for decoding: the API doesn't use the codec, so
    // Workflow input arrives in plain JSON.
    $converter = new DataConverter(
        new EncryptingConverter(DataConverter::createDefault()),
        new NullConverter(),
        new BinaryConverter(),
        new ProtoJsonConverter(),
        new ProtoConverter(),
        new JsonConverter(),
    );
}

// RoadRunner owns the connection to Temporal (see .rr.yaml) and runs this script
// as its PHP worker pool.
$factory = WorkerFactory::create($converter);
$worker = $factory->newWorker($taskQueue);
// The SDK has no dynamic Workflows, so each scenario's Workflow Type is
// registered by name. They all run the same code.
$worker->registerWorkflowTypes(
    AccountTransferWorkflow::class,
    AdvancedVisibilityTransfer::class,
    ApprovalTransfer::class,
    ApiDowntimeTransfer::class,
    RecoverableFailureTransfer::class,
    InvalidAccountTransfer::class,
);
$worker->registerActivity(
    TransferActivities::class,
    static fn () => new TransferActivities(new BackendClient($backendUrl)),
);

fwrite(STDERR, "PHP worker started, listening on task queue: {$taskQueue}\n");
$factory->run();
