from __future__ import annotations

import os
from typing import Annotated
from uuid import uuid4

from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse

from banking_demo import config, sessions
from banking_demo.api.events import event_generator, publish
from banking_demo.models import (
    SCENARIO_TO_WORKFLOW_TYPE,
    Settings,
    StepStatus,
    StepUpdate,
    Transfer,
    TransferRequest,
    WorkerEvent,
)
from banking_demo.sessions import Session, TransferRecord
from banking_demo.temporal_ui import (
    temporal_namespace,
    temporal_namespace_url,
    temporal_ui_base_url,
    temporal_workflow_url,
)

app = FastAPI(title="Banking Transfer Demo API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Temporal client (lazy singleton)
# ---------------------------------------------------------------------------

_temporal_client = None


async def get_temporal_client():
    global _temporal_client
    if _temporal_client is None:
        from temporalio.client import Client, TLSConfig

        addr = os.environ.get("TEMPORAL_ADDRESS", "localhost:7233")
        namespace = os.environ.get("TEMPORAL_NAMESPACE", "default")
        api_key = os.environ.get("TEMPORAL_API_KEY", "")
        tls_cert_path = os.environ.get("TEMPORAL_CERT_PATH", "")
        tls_key_path = os.environ.get("TEMPORAL_KEY_PATH", "")

        kwargs: dict = {"target_host": addr, "namespace": namespace}

        if api_key:
            kwargs["api_key"] = api_key
            kwargs["tls"] = True
        elif tls_cert_path and tls_key_path:
            with open(tls_cert_path, "rb") as f:
                cert = f.read()
            with open(tls_key_path, "rb") as f:
                key = f.read()
            kwargs["tls"] = TLSConfig(client_cert=cert, client_private_key=key)

        _temporal_client = await Client.connect(**kwargs)
    return _temporal_client


# ---------------------------------------------------------------------------
# Browser sessions
# ---------------------------------------------------------------------------

SESSION_COOKIE = "banking_session"


def current_session(request: Request, response: Response) -> Session:
    """The caller's session, set as a cookie with no expiry so it ends with the browser session."""
    sent = request.cookies.get(SESSION_COOKIE)
    session = sessions.resume_or_start(sent)
    if sent != session.id:
        response.set_cookie(
            SESSION_COOKIE,
            session.id,
            httponly=True,
            samesite="lax",
            secure=request.headers.get("x-forwarded-proto") == "https",
        )
    return session


CurrentSession = Annotated[Session, Depends(current_session)]


def session_transfer(session: Session, transfer_id: str) -> TransferRecord:
    record = session.transfers.get(transfer_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Transfer not found")
    return record


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------


@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.get("/api/temporal-ui")
async def temporal_ui():
    return {
        "base_url": temporal_ui_base_url(),
        "namespace": temporal_namespace(),
        "namespace_url": temporal_namespace_url(),
    }


# ---------------------------------------------------------------------------
# Accounts
# ---------------------------------------------------------------------------


@app.get("/api/accounts")
async def get_accounts():
    return [acct.model_dump() for acct in config.ACCOUNTS]


# ---------------------------------------------------------------------------
# Settings
# ---------------------------------------------------------------------------


@app.get("/api/settings")
async def get_settings(session: CurrentSession):
    return session.settings.model_dump()


@app.post("/api/settings")
async def update_settings(new_settings: Settings, session: CurrentSession):
    session.settings = new_settings
    sessions.clear(session)
    return session.settings.model_dump()


# ---------------------------------------------------------------------------
# Transfers
# ---------------------------------------------------------------------------


@app.post("/api/transfers")
async def create_transfer(request: TransferRequest, session: CurrentSession):
    transfer_id = uuid4().hex[:8]
    scenario = session.settings.scenario
    workflow_type = SCENARIO_TO_WORKFLOW_TYPE[scenario]
    task_queue = os.environ.get("TEMPORAL_TASK_QUEUE") or "MoneyTransfer"

    transfer = Transfer(
        transfer_id=transfer_id,
        from_account=request.from_account,
        to_account=request.to_account,
        amount=request.amount,
        scenario=scenario,
        workflow_type=workflow_type,
    )
    # Crashable workspaces share a Namespace and differ only by task queue, and
    # browser sessions share a workspace, so the ID carries both.
    workflow_id = f"transfer-{task_queue}-{session.tag}-{transfer_id}"
    sessions.add_transfer(session, transfer, workflow_id)

    client = await get_temporal_client()
    handle = await client.start_workflow(
        workflow_type,
        {
            "amount": request.amount,
            "fromAccount": request.from_account,
            "toAccount": request.to_account,
        },
        id=workflow_id,
        task_queue=task_queue,
    )
    run_id = handle.first_execution_run_id or handle.run_id or ""

    return {
        "transfer_id": transfer_id,
        "status": "accepted",
        "workflow_id": workflow_id,
        "run_id": run_id,
        "temporal_ui_url": temporal_workflow_url(
            workflow_id=workflow_id,
            run_id=run_id,
        ),
    }


@app.get("/api/transfers/{transfer_id}")
async def get_transfer(transfer_id: str, session: CurrentSession):
    return session_transfer(session, transfer_id).transfer.model_dump(mode="json")


@app.get("/api/transfers/{transfer_id}/events")
async def transfer_events(transfer_id: str, session: CurrentSession):
    return EventSourceResponse(event_generator(session_transfer(session, transfer_id)))


# ---------------------------------------------------------------------------
# Bank Operations (human-in-the-loop)
# ---------------------------------------------------------------------------


@app.get("/api/bank/pending-approvals")
async def get_pending_approvals(session: CurrentSession):
    return [
        {"transfer_id": transfer_id, **record.pending_approval}
        for transfer_id, record in session.transfers.items()
        if record.pending_approval is not None
    ]


def pending_transfer(session: Session, transfer_id: str) -> TransferRecord:
    record = session.transfers.get(transfer_id)
    if record is None or record.pending_approval is None:
        raise HTTPException(status_code=404, detail="No pending approval for this transfer")
    return record


@app.post("/api/bank/approve/{transfer_id}")
async def approve_transfer(transfer_id: str, session: CurrentSession):
    record = pending_transfer(session, transfer_id)

    client = await get_temporal_client()
    await client.get_workflow_handle(record.workflow_id).signal("approveTransfer")

    record.pending_approval = None

    await publish(
        record,
        StepUpdate(
            step="approval_wait",
            status=StepStatus.COMPLETED,
            detail="Transfer approved by bank operations",
        ),
    )

    return {"status": "approved", "transfer_id": transfer_id}


@app.post("/api/bank/deny/{transfer_id}")
async def deny_transfer(transfer_id: str, session: CurrentSession):
    """Remove from pending approvals — workflow will timeout and compensate."""
    record = pending_transfer(session, transfer_id)
    record.pending_approval = None

    await publish(
        record,
        StepUpdate(
            step="approval_wait",
            status=StepStatus.FAILED,
            detail="Transfer denied — will timeout and compensate",
        ),
    )

    return {"status": "denied", "transfer_id": transfer_id}


# ---------------------------------------------------------------------------
# Internal: used by the Worker. Activities identify their transfer by Workflow ID.
# The frontend's proxy doesn't forward these paths, so browsers can't reach them.
# ---------------------------------------------------------------------------


@app.post("/api/internal/events")
async def push_event(event: WorkerEvent):
    """Accept a step update from an Activity."""
    record = sessions.transfer_for_workflow(event.workflow_id)
    if record is None:
        return {"status": "ignored", "reason": "unknown transfer"}
    await publish(record, event)
    return {"status": "accepted"}


@app.post("/api/internal/pending-approvals/{workflow_id}")
async def register_pending_approval(workflow_id: str, payload: dict):
    """Register a transfer as needing approval (from worker)."""
    record = sessions.transfer_for_workflow(workflow_id)
    if record is None:
        return {"status": "ignored", "reason": "unknown transfer"}
    record.pending_approval = payload
    return {"status": "accepted"}


@app.delete("/api/internal/pending-approvals/{workflow_id}")
async def remove_pending_approval(workflow_id: str):
    """Remove a pending approval (from worker)."""
    record = sessions.transfer_for_workflow(workflow_id)
    if record is not None:
        record.pending_approval = None
    return {"status": "removed"}


# ---------------------------------------------------------------------------
# Reset
# ---------------------------------------------------------------------------


@app.post("/api/reset")
async def reset(session: CurrentSession):
    sessions.clear(session)
    return {"status": "reset"}
