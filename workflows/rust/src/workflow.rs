use std::time::Duration;

use serde::{Deserialize, Serialize};
use temporalio_common::{RetryPolicy, search_attributes::SearchAttributeKey};
use temporalio_macros::{workflow, workflow_methods};
use temporalio_sdk::{
    ActivityExecutionError, ActivityOptions, ApplicationFailure, SyncWorkflowContext,
    WorkflowContext, WorkflowContextView, WorkflowResult,
};

use crate::activities::{MoneyMovement, TransferActivities};

const ADVANCED_VISIBILITY: &str = "AccountTransferWorkflowAdvancedVisibility";
const NEEDS_APPROVAL: &str = "AccountTransferWorkflowHumanInLoop";
const BUG: &str = "AccountTransferWorkflowRecoverableFailure";
const APPROVAL_SECONDS: u64 = 30;

const STEP: SearchAttributeKey<String> = SearchAttributeKey::keyword("Step");

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransferInput {
    pub amount: f64,
    pub from_account: String,
    pub to_account: String,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DepositResponse {
    pub charge_id: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransferOutput {
    pub deposit_response: DepositResponse,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransferStatus {
    pub progress_percentage: u32,
    pub transfer_state: String,
    pub workflow_status: String,
    pub charge_result: DepositResponse,
    pub approval_time: u64,
}

/// What every scenario's Workflow keeps.
#[derive(Default)]
pub struct TransferState {
    status: TransferStatus,
    approved: bool,
}

/// Gives the shared Workflow code the state inside each scenario's type.
pub trait Transfer: Sized + 'static {
    fn transfer(&mut self) -> &mut TransferState;
    fn view(&self) -> &TransferState;
}

fn activity_options() -> ActivityOptions {
    // No maximum_attempts: an outage can last longer than any count we'd pick,
    // so Activities retry until they succeed or fail non-retryably.
    ActivityOptions::with_start_to_close_timeout(Duration::from_secs(5))
        .retry_policy(
            RetryPolicy::builder()
                .initial_interval(Duration::from_secs(1))
                .backoff_coefficient(2.0)
                .maximum_interval(Duration::from_secs(30))
                .build(),
        )
        .build()
}

async fn update_progress<W: Transfer>(
    ctx: &mut WorkflowContext<W>,
    progress: u32,
    seconds: u64,
    state: &str,
) {
    if seconds > 0 {
        let _ = ctx.timer(Duration::from_secs(seconds)).await;
    }
    ctx.state_mut(|s| {
        let status = &mut s.transfer().status;
        status.transfer_state = state.to_string();
        status.progress_percentage = progress;
    });
}

fn upsert_step<W: Transfer>(ctx: &WorkflowContext<W>, workflow_type: &str, step: &str) {
    if workflow_type == ADVANCED_VISIBILITY {
        ctx.upsert_search_attributes([STEP.value_set(step.to_string())]);
    }
}

/// Moves money between two accounts. The Workflow Type picks the scenario.
async fn account_transfer<W: Transfer>(
    ctx: &mut WorkflowContext<W>,
    input: TransferInput,
) -> WorkflowResult<TransferOutput> {
    let workflow_type = ctx.info().workflow_type().to_string();
    let idempotency_key = ctx.uuid4();
    ctx.state_mut(|s| s.transfer().status.approval_time = APPROVAL_SECONDS);

    let movement = MoneyMovement {
        idempotency_key,
        amount: input.amount,
        workflow_type: workflow_type.clone(),
    };

    // Validate
    upsert_step(ctx, &workflow_type, "Validate");
    ctx.execute_activity(TransferActivities::validate, input.clone(), activity_options())
        .await?;
    update_progress(ctx, 25, 1, "running").await;

    // Withdraw
    upsert_step(ctx, &workflow_type, "Withdraw");
    ctx.execute_activity(TransferActivities::withdraw, movement.clone(), activity_options())
        .await?;
    update_progress(ctx, 50, 3, "running").await;

    // Human in the loop: wait for the approveTransfer Signal
    if workflow_type == NEEDS_APPROVAL {
        ctx.execute_activity(
            TransferActivities::register_approval,
            input.clone(),
            activity_options(),
        )
        .await?;
        update_progress(ctx, 30, 0, "waiting").await;

        let approved = temporalio_sdk::workflows::select! {
            result = ctx.wait_condition(|s: &W| s.view().approved) => { result?; true }
            _ = ctx.timer(Duration::from_secs(APPROVAL_SECONDS)) => false,
        };
        if !approved {
            ctx.execute_activity(TransferActivities::remove_approval, (), activity_options())
                .await?;
            return Err(ApplicationFailure::builder(format!(
                "Approval not received within {APPROVAL_SECONDS} seconds"
            ))
            .type_name("ApprovalTimeout".to_string())
            .non_retryable(true)
            .build()
            .into());
        }
    }

    // A panic fails the Workflow Task, not the Workflow. The transfer stays
    // Running, and fixing the code lets it carry on from here.
    if workflow_type == BUG {
        panic!("Simulated bug - fix me!");
    }

    // Deposit, and undo the withdrawal if it fails for good
    upsert_step(ctx, &workflow_type, "Deposit");
    let deposit = match ctx
        .execute_activity(TransferActivities::deposit, movement, activity_options())
        .await
    {
        Ok(deposit) => deposit,
        Err(error) => {
            ctx.execute_activity(TransferActivities::undo_withdraw, input.amount, activity_options())
                .await?;
            return Err(ApplicationFailure::builder(deposit_failure(&error))
                .type_name("DepositFailed".to_string())
                .non_retryable(true)
                .build()
                .into());
        }
    };
    ctx.state_mut(|s| s.transfer().status.charge_result = deposit.clone());
    update_progress(ctx, 75, 1, "running").await;

    // Send notification
    upsert_step(ctx, &workflow_type, "Send notification");
    ctx.execute_activity(TransferActivities::send_notification, (), activity_options())
        .await?;
    update_progress(ctx, 100, 1, "finished").await;

    Ok(TransferOutput {
        deposit_response: deposit,
    })
}

/// The Activity's own message, which sits in the cause of the failure.
fn deposit_failure(error: &ActivityExecutionError) -> String {
    error
        .failure()
        .and_then(|failure| failure.cause.as_ref())
        .map_or_else(|| error.to_string(), |cause| cause.message.clone())
}

fn approve<W: Transfer>(workflow: &mut W) {
    let state = workflow.transfer();
    if state.status.transfer_state == "waiting" {
        state.approved = true;
    }
}

/// One Workflow Type per scenario, all running `account_transfer`.
macro_rules! transfer_workflow {
    ($name:ident, $workflow_type:literal) => {
        #[workflow]
        #[derive(Default)]
        pub struct $name {
            state: TransferState,
        }

        impl Transfer for $name {
            fn transfer(&mut self) -> &mut TransferState {
                &mut self.state
            }

            fn view(&self) -> &TransferState {
                &self.state
            }
        }

        #[workflow_methods]
        impl $name {
            #[run(name = $workflow_type)]
            pub async fn run(
                ctx: &mut WorkflowContext<Self>,
                input: TransferInput,
            ) -> WorkflowResult<TransferOutput> {
                account_transfer(ctx, input).await
            }

            #[signal(name = "approveTransfer")]
            pub fn approve_transfer(&mut self, _ctx: &mut SyncWorkflowContext<Self>) {
                approve(self);
            }

            #[query(name = "transferStatus")]
            pub fn transfer_status(&self, _ctx: &WorkflowContextView) -> TransferStatus {
                self.state.status.clone()
            }
        }
    };
}

transfer_workflow!(HappyPathTransfer, "AccountTransferWorkflow");
transfer_workflow!(AdvancedVisibilityTransfer, "AccountTransferWorkflowAdvancedVisibility");
transfer_workflow!(ApprovalTransfer, "AccountTransferWorkflowHumanInLoop");
transfer_workflow!(ApiDowntimeTransfer, "AccountTransferWorkflowAPIDowntime");
transfer_workflow!(RecoverableFailureTransfer, "AccountTransferWorkflowRecoverableFailure");
transfer_workflow!(InvalidAccountTransfer, "AccountTransferWorkflowInvalidAccount");
