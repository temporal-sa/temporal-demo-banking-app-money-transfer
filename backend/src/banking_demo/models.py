from __future__ import annotations

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class TransferScenario(str, Enum):
    HAPPY_PATH = "happy_path"
    ADVANCED_VISIBILITY = "advanced_visibility"
    HUMAN_IN_THE_LOOP = "human_in_the_loop"
    API_DOWNTIME = "api_downtime"
    BUG_IN_WORKFLOW = "bug_in_workflow"
    INVALID_ACCOUNT = "invalid_account"


# Maps scenario setting to Temporal workflow type name
SCENARIO_TO_WORKFLOW_TYPE: dict[TransferScenario, str] = {
    TransferScenario.HAPPY_PATH: "AccountTransferWorkflow",
    TransferScenario.ADVANCED_VISIBILITY: "AccountTransferWorkflowAdvancedVisibility",
    TransferScenario.HUMAN_IN_THE_LOOP: "AccountTransferWorkflowHumanInLoop",
    TransferScenario.API_DOWNTIME: "AccountTransferWorkflowAPIDowntime",
    TransferScenario.BUG_IN_WORKFLOW: "AccountTransferWorkflowRecoverableFailure",
    TransferScenario.INVALID_ACCOUNT: "AccountTransferWorkflowInvalidAccount",
}


class StepStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    RETRYING = "retrying"


class PresentationMode(str, Enum):
    SIMPLE = "simple"
    DETAILED = "detailed"


class Settings(BaseModel):
    scenario: TransferScenario = TransferScenario.HAPPY_PATH
    presentation_mode: PresentationMode = PresentationMode.DETAILED


class Account(BaseModel):
    id: str
    name: str
    owner: str
    balance: float
    account_type: str  # "checking" | "savings"


class TransferRequest(BaseModel):
    from_account: str
    to_account: str
    amount: float


class Transfer(BaseModel):
    transfer_id: str
    from_account: str
    to_account: str
    amount: float
    status: str = "pending"
    scenario: TransferScenario = TransferScenario.HAPPY_PATH
    workflow_type: str = "AccountTransferWorkflow"
    created_at: datetime = Field(default_factory=datetime.now)


class StepUpdate(BaseModel):
    step: str
    status: StepStatus
    attempt: int = 1
    max_attempts: int = 1
    error: str | None = None
    detail: str = ""
    timestamp: datetime = Field(default_factory=datetime.now)


class TransferEvent(StepUpdate):
    """A step update as the browser receives it."""

    transfer_id: str


class WorkerEvent(StepUpdate):
    """A step update as an Activity reports it, by Workflow ID."""

    workflow_id: str
