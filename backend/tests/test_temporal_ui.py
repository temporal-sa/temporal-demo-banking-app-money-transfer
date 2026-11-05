"""Temporal UI links follow what the demo platform injects, and work with nothing set."""

from __future__ import annotations

import pytest

from banking_demo.temporal_ui import temporal_namespace_url, temporal_workflow_url

ENV = (
    "TEMPORAL_UI_URL",
    "TEMPORAL_UI_NAMESPACE",
    "TEMPORAL_NAMESPACE",
    "TEMPORAL_ADDRESS",
    "TEMPORAL_ENDPOINT",
)


@pytest.fixture(autouse=True)
def clean_env(monkeypatch):
    for name in ENV:
        monkeypatch.delenv(name, raising=False)


def test_platform_base_and_namespace(monkeypatch):
    monkeypatch.setenv("TEMPORAL_UI_URL", "https://cloud.temporal.io")
    monkeypatch.setenv("TEMPORAL_UI_NAMESPACE", "demo.acct")
    monkeypatch.setenv("TEMPORAL_NAMESPACE", "default")
    assert temporal_namespace_url() == "https://cloud.temporal.io/namespaces/demo.acct/workflows"
    assert (
        temporal_workflow_url(workflow_id="transfer/1")
        == "https://cloud.temporal.io/namespaces/demo.acct/workflows/transfer%2F1"
    )


def test_workspace_base_with_a_trailing_slash(monkeypatch):
    monkeypatch.setenv("TEMPORAL_UI_URL", "https://ws.example/_temporal/")
    monkeypatch.setenv("TEMPORAL_UI_NAMESPACE", "demo")
    assert (
        temporal_workflow_url(workflow_id="wf", run_id="run")
        == "https://ws.example/_temporal/namespaces/demo/workflows/wf/run/timeline"
    )


def test_nothing_set_is_the_local_dev_server():
    assert temporal_namespace_url() == "http://localhost:8233/namespaces/default/workflows"


def test_a_cloud_connection_without_the_platform_env(monkeypatch):
    monkeypatch.setenv("TEMPORAL_ADDRESS", "demo.acct.tmprl.cloud:7233")
    monkeypatch.setenv("TEMPORAL_NAMESPACE", "demo.acct")
    assert temporal_namespace_url() == "https://cloud.temporal.io/namespaces/demo.acct/workflows"
