mod activities;
mod backend;
mod codec;
mod workflow;

use activities::TransferActivities;
use backend::BackendClient;
use codec::EncryptionCodec;
use temporalio_client::{
    Client, ClientOptions, Connection, envconfig::LoadClientConfigProfileOptions,
};
use temporalio_common::data_converters::{DataConverter, DefaultFailureConverter, PayloadConverter};
use temporalio_sdk::{Runtime, Worker, WorkerOptions};
use workflow::{
    AdvancedVisibilityTransfer, ApiDowntimeTransfer, ApprovalTransfer, HappyPathTransfer,
    InvalidAccountTransfer, RecoverableFailureTransfer,
};

const DEFAULT_TASK_QUEUE: &str = "MoneyTransfer";

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let task_queue = env_or("TEMPORAL_TASK_QUEUE", DEFAULT_TASK_QUEUE);

    // Environment only: a developer's default CLI profile may point at a real
    // Cloud namespace.
    let runtime = Runtime::from_current_tokio(Default::default())?;
    let (mut conn_opts, mut client_opts) = ClientOptions::load_from_config(
        LoadClientConfigProfileOptions::builder()
            .disable_file(true)
            .build(),
    )?;
    // On by default, this balances across every address a hostname resolves to
    // and doesn't fall back. Docker's host-gateway entry for host.docker.internal
    // includes an IPv6 address that can be unreachable, which fails the connection.
    conn_opts.dns_load_balancing = None;

    if EncryptionCodec::enabled() {
        println!("Encrypting payloads");
        client_opts.data_converter = DataConverter::new(
            PayloadConverter::default(),
            DefaultFailureConverter::default(),
            EncryptionCodec::new(),
        );
    }

    let connection = Connection::connect(conn_opts).await?;
    let client = Client::new(connection, client_opts)?;

    // The SDK has no dynamic Workflows, so each scenario's Workflow Type is
    // registered by name. They all run the same code.
    let worker_options = WorkerOptions::new(task_queue.as_str())
        .register_workflow::<HappyPathTransfer>()?
        .register_workflow::<AdvancedVisibilityTransfer>()?
        .register_workflow::<ApprovalTransfer>()?
        .register_workflow::<ApiDowntimeTransfer>()?
        .register_workflow::<RecoverableFailureTransfer>()?
        .register_workflow::<InvalidAccountTransfer>()?
        .register_activities(TransferActivities::new(BackendClient::new(
            &env_or("BANKING_BACKEND_URL", ""),
        )?))
        .build();

    let mut worker = Worker::new(&runtime, client, worker_options)?;
    println!("Rust worker started, listening on task queue: {task_queue}");
    worker.run().await?;
    Ok(())
}

fn env_or(name: &str, default: &str) -> String {
    std::env::var(name)
        .ok()
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| default.to_string())
}
