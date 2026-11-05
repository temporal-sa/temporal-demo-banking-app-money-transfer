use std::{sync::Arc, time::Duration};

use serde::{Deserialize, Serialize};
use temporalio_macros::activities;
use temporalio_sdk::{
    ApplicationFailure,
    activities::{ActivityContext, ActivityError},
};
use tokio::time::sleep;

use crate::{
    backend::{BackendClient, StepEvent},
    workflow::{DepositResponse, TransferInput},
};

const API_DOWNTIME: &str = "AccountTransferWorkflowAPIDowntime";
const INVALID_ACCOUNT: &str = "AccountTransferWorkflowInvalidAccount";
const EVENT_MAX_ATTEMPTS: u32 = 10;

/// The input to the withdrawal and the deposit.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct MoneyMovement {
    pub idempotency_key: String,
    pub amount: f64,
    pub workflow_type: String,
}

pub struct TransferActivities {
    backend: BackendClient,
}

impl TransferActivities {
    pub fn new(backend: BackendClient) -> Self {
        Self { backend }
    }
}

fn workflow_id(ctx: &ActivityContext) -> String {
    ctx.info().workflow_id.clone().unwrap_or_default()
}

/// Stands in for a call to the bank. Each attempt is faster than the last, and
/// the fifth one always works.
async fn simulate_external_operation(ms: u64, workflow_type: &str, attempt: u32) -> &str {
    sleep(Duration::from_millis(ms / u64::from(attempt))).await;
    if attempt < 5 { workflow_type } else { "NoError" }
}

#[activities]
impl TransferActivities {
    #[activity]
    pub async fn validate(
        self: Arc<Self>,
        ctx: ActivityContext,
        input: TransferInput,
    ) -> Result<String, ActivityError> {
        let id = workflow_id(&ctx);
        self.backend.emit(&id, StepEvent::new("validate", "running")).await;
        sleep(Duration::from_secs(1)).await;
        let detail = format!("Validated: {} -> {}", input.from_account, input.to_account);
        self.backend
            .emit(&id, StepEvent::new("validate", "completed").detail(detail))
            .await;
        Ok("SUCCESS".to_string())
    }

    #[activity]
    pub async fn withdraw(
        self: Arc<Self>,
        ctx: ActivityContext,
        movement: MoneyMovement,
    ) -> Result<String, ActivityError> {
        let id = workflow_id(&ctx);
        let attempt = ctx.info().attempt;
        self.backend
            .emit(&id, StepEvent::new("withdraw", "running").attempt(attempt, EVENT_MAX_ATTEMPTS))
            .await;

        if simulate_external_operation(1000, &movement.workflow_type, attempt).await == API_DOWNTIME {
            self.backend
                .emit(
                    &id,
                    StepEvent::new("withdraw", "retrying")
                        .attempt(attempt, EVENT_MAX_ATTEMPTS)
                        .error("Withdraw API unavailable"),
                )
                .await;
            return Err(ActivityError::application(ApplicationFailure::new(
                "Withdraw activity failed, API unavailable",
            )));
        }

        let detail = format!("Withdrawn ${:.2}", movement.amount);
        self.backend
            .emit(&id, StepEvent::new("withdraw", "completed").detail(detail))
            .await;
        Ok("SUCCESS".to_string())
    }

    #[activity]
    pub async fn deposit(
        self: Arc<Self>,
        ctx: ActivityContext,
        movement: MoneyMovement,
    ) -> Result<DepositResponse, ActivityError> {
        let id = workflow_id(&ctx);
        let attempt = ctx.info().attempt;
        self.backend
            .emit(&id, StepEvent::new("deposit", "running").attempt(attempt, EVENT_MAX_ATTEMPTS))
            .await;

        if simulate_external_operation(1000, &movement.workflow_type, attempt).await == INVALID_ACCOUNT {
            self.backend
                .emit(&id, StepEvent::new("deposit", "failed").error("Account is invalid"))
                .await;
            // Retrying can't fix a bad account, so the Workflow compensates at once.
            return Err(ActivityError::application(
                ApplicationFailure::builder("Deposit activity failed, account is invalid")
                    .type_name("InvalidAccount".to_string())
                    .non_retryable(true)
                    .build(),
            ));
        }

        let detail = format!("Deposited ${:.2}", movement.amount);
        self.backend
            .emit(&id, StepEvent::new("deposit", "completed").detail(detail))
            .await;
        Ok(DepositResponse {
            charge_id: "example-transfer-id".to_string(),
        })
    }

    #[activity]
    pub async fn send_notification(
        self: Arc<Self>,
        ctx: ActivityContext,
    ) -> Result<String, ActivityError> {
        sleep(Duration::from_secs(1)).await;
        self.backend
            .emit(
                &workflow_id(&ctx),
                StepEvent::new("send_notification_success", "completed")
                    .detail("Customer notified: Transfer completed successfully!"),
            )
            .await;
        Ok("SUCCESS".to_string())
    }

    #[activity]
    pub async fn undo_withdraw(
        self: Arc<Self>,
        ctx: ActivityContext,
        amount: f64,
    ) -> Result<bool, ActivityError> {
        let id = workflow_id(&ctx);
        self.backend.emit(&id, StepEvent::new("undo_withdraw", "running")).await;
        sleep(Duration::from_secs(1)).await;
        let detail = format!("Withdrawal reversed: ${amount:.2}");
        self.backend
            .emit(&id, StepEvent::new("undo_withdraw", "completed").detail(detail))
            .await;
        Ok(true)
    }

    #[activity]
    pub async fn register_approval(
        self: Arc<Self>,
        ctx: ActivityContext,
        input: TransferInput,
    ) -> Result<String, ActivityError> {
        let id = workflow_id(&ctx);
        self.backend
            .emit(
                &id,
                StepEvent::new("approval_wait", "running").detail("Awaiting bank employee approval..."),
            )
            .await;
        self.backend.register_approval(&id, &input).await;
        Ok("SUCCESS".to_string())
    }

    #[activity]
    pub async fn remove_approval(
        self: Arc<Self>,
        ctx: ActivityContext,
    ) -> Result<String, ActivityError> {
        let id = workflow_id(&ctx);
        self.backend.remove_approval(&id).await;
        self.backend
            .emit(
                &id,
                StepEvent::new("approval_wait", "failed")
                    .detail("Approval timed out — transfer denied automatically"),
            )
            .await;
        Ok("SUCCESS".to_string())
    }
}
