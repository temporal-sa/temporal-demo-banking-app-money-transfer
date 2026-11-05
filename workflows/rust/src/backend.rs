use std::time::Duration;

use serde::Serialize;
use serde_json::json;

use crate::workflow::TransferInput;

/// A step update for the browser.
#[derive(Serialize)]
pub struct StepEvent {
    workflow_id: String,
    step: String,
    status: String,
    attempt: u32,
    max_attempts: u32,
    error: Option<String>,
    detail: String,
    timestamp: String,
}

impl StepEvent {
    pub fn new(step: &str, status: &str) -> Self {
        Self {
            workflow_id: String::new(),
            step: step.to_string(),
            status: status.to_string(),
            attempt: 1,
            max_attempts: 1,
            error: None,
            detail: String::new(),
            timestamp: chrono::Local::now().to_rfc3339(),
        }
    }

    pub fn attempt(mut self, attempt: u32, max_attempts: u32) -> Self {
        self.attempt = attempt;
        self.max_attempts = max_attempts;
        self
    }

    pub fn error(mut self, error: impl Into<String>) -> Self {
        self.error = Some(error.into());
        self
    }

    pub fn detail(mut self, detail: impl Into<String>) -> Self {
        self.detail = detail.into();
        self
    }
}

/// Pushes step updates and approvals to the API. Every call is best effort: a
/// missed UI update shouldn't fail the Activity.
pub struct BackendClient {
    base_url: String,
    http: reqwest::Client,
}

impl BackendClient {
    pub fn new(base_url: &str) -> reqwest::Result<Self> {
        Ok(Self {
            base_url: base_url.trim_end_matches('/').to_string(),
            http: reqwest::Client::builder()
                .timeout(Duration::from_secs(5))
                .build()?,
        })
    }

    pub async fn emit(&self, workflow_id: &str, mut event: StepEvent) {
        if self.base_url.is_empty() {
            return;
        }
        event.workflow_id = workflow_id.to_string();
        let url = format!("{}/api/internal/events", self.base_url);
        let _ = self.http.post(url).json(&event).send().await;
    }

    pub async fn register_approval(&self, workflow_id: &str, input: &TransferInput) {
        if self.base_url.is_empty() {
            return;
        }
        let url = format!("{}/api/internal/pending-approvals/{workflow_id}", self.base_url);
        let body = json!({
            "from_account": input.from_account,
            "to_account": input.to_account,
            "amount": input.amount,
            "created_at": chrono::Local::now().to_rfc3339(),
        });
        let _ = self.http.post(url).json(&body).send().await;
    }

    pub async fn remove_approval(&self, workflow_id: &str) {
        if self.base_url.is_empty() {
            return;
        }
        let url = format!("{}/api/internal/pending-approvals/{workflow_id}", self.base_url);
        let _ = self.http.delete(url).send().await;
    }
}
