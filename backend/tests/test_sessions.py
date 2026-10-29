"""Each browser session runs its own demo: scenario, transfers, events and approvals."""

from __future__ import annotations

from dataclasses import dataclass, field

import pytest
from fastapi.testclient import TestClient

from banking_demo import sessions
from banking_demo.api import routes

TRANSFER = {"from_account": "ACC-001", "to_account": "ACC-002", "amount": 10}


@dataclass
class FakeTemporal:
    """Records what the API asks Temporal to do."""

    started: list[dict] = field(default_factory=list)
    signals: list[tuple[str, str]] = field(default_factory=list)

    async def start_workflow(self, workflow_type, arg, *, id, task_queue):
        self.started.append({"type": workflow_type, "id": id, "task_queue": task_queue})
        return _Handle(self, id)

    def get_workflow_handle(self, workflow_id):
        return _Handle(self, workflow_id)


@dataclass
class _Handle:
    temporal: FakeTemporal
    workflow_id: str
    first_execution_run_id: str = "run-1"
    run_id: str = "run-1"

    async def signal(self, name):
        self.temporal.signals.append((self.workflow_id, name))


@pytest.fixture
def temporal(monkeypatch):
    fake = FakeTemporal()

    async def get_client():
        return fake

    monkeypatch.setattr(routes, "get_temporal_client", get_client)
    monkeypatch.setattr(sessions, "_sessions", {})
    monkeypatch.setattr(sessions, "_transfers_by_workflow_id", {})
    return fake


def browser() -> TestClient:
    return TestClient(routes.app)


def start_transfer(client: TestClient) -> dict:
    response = client.post("/api/transfers", json=TRANSFER)
    response.raise_for_status()
    return response.json()


def use_scenario(client: TestClient, scenario: str) -> None:
    client.post(
        "/api/settings", json={"scenario": scenario, "presentation_mode": "detailed"}
    ).raise_for_status()


def test_a_new_browser_starts_on_happy_path_whatever_others_chose(temporal):
    alice, bob = browser(), browser()
    use_scenario(alice, "api_downtime")

    assert alice.get("/api/settings").json()["scenario"] == "api_downtime"
    assert bob.get("/api/settings").json()["scenario"] == "happy_path"


def test_each_browser_starts_its_own_scenario(temporal):
    alice, bob = browser(), browser()
    use_scenario(alice, "human_in_the_loop")
    start_transfer(alice)
    start_transfer(bob)

    assert [w["type"] for w in temporal.started] == [
        "AccountTransferWorkflowHumanInLoop",
        "AccountTransferWorkflow",
    ]


def test_workflow_id_carries_task_queue_and_a_session_tag_not_the_session_id(temporal, monkeypatch):
    monkeypatch.setenv("TEMPORAL_TASK_QUEUE", "MoneyTransfer-ws42")
    alice = browser()
    started = start_transfer(alice)

    session_id = alice.cookies[routes.SESSION_COOKIE]
    tag = sessions.resume_or_start(session_id).tag
    assert started["workflow_id"] == f"transfer-MoneyTransfer-ws42-{tag}-{started['transfer_id']}"
    assert session_id not in started["workflow_id"]
    assert temporal.started[0]["task_queue"] == "MoneyTransfer-ws42"


def test_a_browser_cannot_read_another_browsers_transfer(temporal):
    alice, bob = browser(), browser()
    transfer_id = start_transfer(alice)["transfer_id"]

    assert alice.get(f"/api/transfers/{transfer_id}").status_code == 200
    assert bob.get(f"/api/transfers/{transfer_id}").status_code == 404
    assert bob.get(f"/api/transfers/{transfer_id}/events").status_code == 404


def test_worker_updates_reach_the_transfer_that_owns_the_workflow(temporal):
    alice, bob = browser(), browser()
    alices = start_transfer(alice)
    bobs = start_transfer(bob)

    response = alice.post(
        "/api/internal/events",
        json={"workflow_id": alices["workflow_id"], "step": "validate", "status": "running"},
    )
    assert response.json() == {"status": "accepted"}

    alices_events = sessions.transfer_for_workflow(alices["workflow_id"]).events
    bobs_events = sessions.transfer_for_workflow(bobs["workflow_id"]).events
    event = alices_events.get_nowait()
    assert (event["transfer_id"], event["step"], event["status"]) == (
        alices["transfer_id"],
        "validate",
        "running",
    )
    assert "workflow_id" not in event
    assert bobs_events.empty()


def test_updates_for_an_unknown_workflow_are_ignored(temporal):
    response = browser().post(
        "/api/internal/events",
        json={"workflow_id": "transfer-elsewhere", "step": "validate", "status": "running"},
    )
    assert response.json()["status"] == "ignored"


def test_approvals_are_listed_and_decided_only_by_their_own_browser(temporal):
    alice, bob = browser(), browser()
    use_scenario(alice, "human_in_the_loop")
    started = start_transfer(alice)
    alice.post(
        f"/api/internal/pending-approvals/{started['workflow_id']}",
        json={"from_account": "ACC-001", "to_account": "ACC-002", "amount": 10},
    ).raise_for_status()

    pending = alice.get("/api/bank/pending-approvals").json()
    assert [p["transfer_id"] for p in pending] == [started["transfer_id"]]
    assert bob.get("/api/bank/pending-approvals").json() == []

    assert bob.post(f"/api/bank/approve/{started['transfer_id']}").status_code == 404
    assert bob.post(f"/api/bank/deny/{started['transfer_id']}").status_code == 404
    assert temporal.signals == []

    assert alice.post(f"/api/bank/approve/{started['transfer_id']}").status_code == 200
    assert temporal.signals == [(started["workflow_id"], "approveTransfer")]
    assert alice.get("/api/bank/pending-approvals").json() == []


def test_changing_scenario_forgets_only_that_browsers_transfers(temporal):
    alice, bob = browser(), browser()
    alices = start_transfer(alice)
    bobs = start_transfer(bob)

    use_scenario(alice, "invalid_account")

    assert alice.get(f"/api/transfers/{alices['transfer_id']}").status_code == 404
    assert sessions.transfer_for_workflow(alices["workflow_id"]) is None
    assert bob.get(f"/api/transfers/{bobs['transfer_id']}").status_code == 200


def test_a_session_id_the_api_did_not_mint_gets_a_fresh_session(temporal):
    client = browser()
    client.cookies.set(routes.SESSION_COOKIE, "chosen-by-the-browser")

    response = client.get("/api/settings")

    assert response.json()["scenario"] == "happy_path"
    assert response.cookies[routes.SESSION_COOKIE] != "chosen-by-the-browser"


def test_the_session_cookie_lasts_for_the_browser_session_and_hides_from_scripts(temporal):
    cookie = browser().get("/api/settings").headers["set-cookie"].lower()

    assert "httponly" in cookie
    assert "samesite=lax" in cookie
    assert "max-age" not in cookie and "expires" not in cookie
    assert "secure" not in cookie


def test_the_cookie_is_secure_behind_an_https_ingress(temporal):
    response = browser().get("/api/settings", headers={"X-Forwarded-Proto": "https"})

    assert "secure" in response.headers["set-cookie"].lower()


def test_idle_sessions_are_dropped_when_a_new_one_starts(temporal, monkeypatch):
    now = 1000.0
    monkeypatch.setattr(sessions.time, "monotonic", lambda: now)
    alice = browser()
    started = start_transfer(alice)
    alices_id = alice.cookies[routes.SESSION_COOKIE]

    now += sessions.IDLE_TIMEOUT_SECONDS + 1
    browser().get("/api/settings")

    assert alices_id not in sessions._sessions
    assert sessions.transfer_for_workflow(started["workflow_id"]) is None
    assert alice.get(f"/api/transfers/{started['transfer_id']}").status_code == 404
