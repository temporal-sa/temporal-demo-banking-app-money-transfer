import { loadClientConnectConfig } from '@temporalio/envconfig';
import { NativeConnection, Worker } from '@temporalio/worker';
import { createActivities } from './activities';
import { BackendClient } from './backend';
import { EncryptionCodec } from './codec';

const TRUE_VALUES = ['1', 'true', 'yes', 'on'];

async function main() {
  // Environment only: a developer's default CLI profile may point at a real
  // Cloud namespace.
  const { connectionOptions, namespace } = loadClientConnectConfig({ configSource: undefined, disableFile: true });
  const connection = await NativeConnection.connect({
    ...connectionOptions,
    address: connectionOptions.address ?? 'localhost:7233',
  });

  const encrypt = TRUE_VALUES.includes((process.env.BANKING_ENCRYPT ?? '').toLowerCase());
  if (encrypt) console.log('Encrypting payloads');

  const taskQueue = process.env.TEMPORAL_TASK_QUEUE || 'MoneyTransfer';
  const worker = await Worker.create({
    connection,
    namespace: namespace ?? 'default',
    taskQueue,
    workflowsPath: require.resolve('./workflows'),
    activities: createActivities(new BackendClient((process.env.BANKING_BACKEND_URL ?? '').replace(/\/$/, ''))),
    dataConverter: encrypt ? { payloadCodecs: [new EncryptionCodec()] } : undefined,
  });

  console.log(`TypeScript worker started, listening on task queue: ${taskQueue}`);
  await worker.run();
}

main().catch((err) => {
  console.error('Worker failed:', err);
  process.exit(1);
});
