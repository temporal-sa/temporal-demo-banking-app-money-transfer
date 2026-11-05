from __future__ import annotations

import os
from urllib.parse import quote


def temporal_target_host() -> str:
    return (
        os.environ.get("TEMPORAL_ENDPOINT")
        or os.environ.get("TEMPORAL_ADDRESS")
        or "localhost:7233"
    )


def temporal_namespace() -> str:
    return os.environ.get("TEMPORAL_NAMESPACE", "default")


def temporal_ui_namespace() -> str:
    """The namespace Temporal UI links open.

    The demo platform sets TEMPORAL_UI_NAMESPACE for this: the qualified Cloud
    namespace, or a crashable workspace's dev server namespace. It can differ from
    the connection's TEMPORAL_NAMESPACE, which is "default" behind the proxy.
    """
    return os.environ.get("TEMPORAL_UI_NAMESPACE") or temporal_namespace()


def temporal_ui_base_url() -> str:
    explicit = os.environ.get("TEMPORAL_UI_URL")
    if explicit:
        return explicit
    if "tmprl.cloud" in temporal_target_host():
        return "https://cloud.temporal.io"
    return "http://localhost:8233"


def temporal_namespace_url() -> str:
    base_url = temporal_ui_base_url().rstrip("/")
    namespace_path = quote(temporal_ui_namespace(), safe="")
    return f"{base_url}/namespaces/{namespace_path}/workflows"


def temporal_workflow_url(*, workflow_id: str, run_id: str = "") -> str:
    base_url = temporal_ui_base_url().rstrip("/")
    namespace_path = quote(temporal_ui_namespace(), safe="")
    workflow_path = quote(workflow_id, safe="")
    run_path = quote(run_id, safe="")
    if run_path:
        return (
            f"{base_url}/namespaces/{namespace_path}/workflows/"
            f"{workflow_path}/{run_path}/timeline"
        )
    return f"{base_url}/namespaces/{namespace_path}/workflows/{workflow_path}"
