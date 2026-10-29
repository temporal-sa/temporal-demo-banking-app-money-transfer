"""Per-browser demo state.

Each browser session has its own scenario, transfers and pending approvals, so
people using the same deployment at once don't see or change each other's demo.
The state lives in this process's memory, so the API runs as a single replica.
"""

from __future__ import annotations

import asyncio
import hashlib
import secrets
import time
from dataclasses import dataclass, field

from banking_demo.models import Settings, Transfer

# A session nobody has used for this long is dropped when the next one starts.
IDLE_TIMEOUT_SECONDS = 2 * 60 * 60


@dataclass
class TransferRecord:
    transfer: Transfer
    workflow_id: str
    events: asyncio.Queue = field(default_factory=asyncio.Queue)
    pending_approval: dict | None = None


@dataclass
class Session:
    id: str
    settings: Settings = field(default_factory=Settings)
    transfers: dict[str, TransferRecord] = field(default_factory=dict)
    last_seen: float = field(default_factory=time.monotonic)

    @property
    def tag(self) -> str:
        """A short label for the session that doesn't reveal its ID, for use in Workflow IDs."""
        return hashlib.sha256(self.id.encode()).hexdigest()[:8]


_sessions: dict[str, Session] = {}
_transfers_by_workflow_id: dict[str, TransferRecord] = {}


def resume_or_start(session_id: str | None) -> Session:
    """Return the caller's session, or start a new one.

    Only IDs this process minted are resumed, so a browser can't pick its own
    session ID or carry one over from before a restart.
    """
    now = time.monotonic()
    session = _sessions.get(session_id) if session_id else None
    if session is None:
        _drop_idle(now)
        session = Session(id=secrets.token_urlsafe(32))
        _sessions[session.id] = session
    session.last_seen = now
    return session


def add_transfer(session: Session, transfer: Transfer, workflow_id: str) -> TransferRecord:
    record = TransferRecord(transfer=transfer, workflow_id=workflow_id)
    session.transfers[transfer.transfer_id] = record
    _transfers_by_workflow_id[workflow_id] = record
    return record


def transfer_for_workflow(workflow_id: str) -> TransferRecord | None:
    """The transfer a Worker is reporting on, whichever session owns it."""
    return _transfers_by_workflow_id.get(workflow_id)


def clear(session: Session) -> None:
    """Forget the session's transfers. Their Workflows keep running in Temporal."""
    for record in session.transfers.values():
        _transfers_by_workflow_id.pop(record.workflow_id, None)
    session.transfers.clear()


def _drop_idle(now: float) -> None:
    idle = [s for s in _sessions.values() if now - s.last_seen > IDLE_TIMEOUT_SECONDS]
    for session in idle:
        clear(session)
        del _sessions[session.id]
