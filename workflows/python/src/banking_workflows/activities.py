from __future__ import annotations

import asyncio
import logging
import os
from datetime import timedelta

from temporalio import activity
from temporalio.common import RetryPolicy
from temporalio.exceptions import ApplicationError

from banking_workflows.shared_objects import DepositResponse, TransferInput

logging.basicConfig(level=logging.INFO)

_BACKEND_URL = os.environ.get("BANKING_BACKEND_URL", "")


async def _emit_event(
    workflow_id: str,
    step: str,
    status: str,
    *,
    attempt: int = 1,
    max_attempts: int = 1,
    error: str | None = None,
    detail: str = "",
) -> None:
    """Push an SSE event to the backend for the UI."""
    if _BACKEND_URL:
        import aiohttp
        from datetime import datetime

        payload = {
            "workflow_id": workflow_id,
            "step": step,
            "status": status,
            "attempt": attempt,
            "max_attempts": max_attempts,
            "error": error,
            "detail": detail,
            "timestamp": datetime.now().isoformat(),
        }
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{_BACKEND_URL}/api/internal/events", json=payload
                ) as resp:
                    resp.raise_for_status()
        except Exception:
            pass


async def _register_pending_approval(workflow_id: str, payload: dict) -> None:
    if _BACKEND_URL:
        import aiohttp

        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{_BACKEND_URL}/api/internal/pending-approvals/{workflow_id}",
                    json=payload,
                ) as resp:
                    resp.raise_for_status()
        except Exception:
            pass


async def _remove_pending_approval(workflow_id: str) -> None:
    if _BACKEND_URL:
        import aiohttp

        try:
            async with aiohttp.ClientSession() as session:
                async with session.delete(
                    f"{_BACKEND_URL}/api/internal/pending-approvals/{workflow_id}",
                ) as resp:
                    resp.raise_for_status()
        except Exception:
            pass


class AccountTransferActivities:

    API_DOWNTIME = "AccountTransferWorkflowAPIDowntime"
    INVALID_ACCOUNT = "AccountTransferWorkflowInvalidAccount"

    retry_policy = RetryPolicy(
        initial_interval=timedelta(seconds=1),
        backoff_coefficient=2,
        maximum_interval=timedelta(seconds=30),
    )

    async def simulate_external_operation_ms(self, ms: int):
        try:
            await asyncio.sleep(ms / 1000)
        except InterruptedError as e:
            print(e.__traceback__)

    async def simulate_external_operation(
        self, ms: int, workflow_type: str, attempt: int
    ):
        await self.simulate_external_operation_ms(ms / attempt)
        return workflow_type if attempt < 5 else "NoError"

    @activity.defn
    async def validate(self, input: TransferInput) -> str:
        activity.logger.info(f"Validate activity started. Input {input}")
        workflow_id = activity.info().workflow_id
        await _emit_event(workflow_id, "validate", "running")

        await self.simulate_external_operation_ms(1000)

        await _emit_event(
            workflow_id, "validate", "completed",
            detail=f"Validated: {input.fromAccount} -> {input.toAccount}",
        )
        return "SUCCESS"

    @activity.defn
    async def withdraw(
        self, idempotencyKey: str, amount: float, workflow_type: str
    ) -> str:
        activity.logger.info(f"Withdraw activity started. amount {amount}")
        workflow_id = activity.info().workflow_id
        attempt = activity.info().attempt
        await _emit_event(workflow_id, "withdraw", "running", attempt=attempt, max_attempts=10)

        error = await self.simulate_external_operation(1000, workflow_type, attempt)
        activity.logger.info(
            f"Withdraw call complete, type {workflow_type}, error {error}"
        )

        if self.API_DOWNTIME == error:
            await _emit_event(
                workflow_id, "withdraw", "retrying",
                attempt=attempt, max_attempts=10,
                error="Withdraw API unavailable",
            )
            raise ApplicationError("Withdraw activity failed, API unavailable")

        await _emit_event(
            workflow_id, "withdraw", "completed",
            detail=f"Withdrawn ${amount:.2f}",
        )
        return "SUCCESS"

    @activity.defn
    async def deposit(
        self, idempotencyKey: str, amount: float, workflow_type: str
    ) -> DepositResponse:
        activity.logger.info(f"Deposit activity started. amount {amount}")
        workflow_id = activity.info().workflow_id
        attempt = activity.info().attempt
        await _emit_event(workflow_id, "deposit", "running", attempt=attempt, max_attempts=10)

        error = await self.simulate_external_operation(1000, workflow_type, attempt)
        activity.logger.info(
            f"Deposit activity complete. type {workflow_type} error {error}"
        )

        if self.INVALID_ACCOUNT == error:
            await _emit_event(
                workflow_id, "deposit", "failed",
                error="Account is invalid",
            )
            raise ApplicationError(
                "Deposit activity failed, account is invalid",
                type="InvalidAccount",
                non_retryable=True,
            )

        await _emit_event(
            workflow_id, "deposit", "completed",
            detail=f"Deposited ${amount:.2f}",
        )
        return DepositResponse("example-transfer-id")

    @activity.defn
    async def sendNotification(self, input: TransferInput) -> str:
        activity.logger.info(f"Send notification activity started. input = {input}")
        workflow_id = activity.info().workflow_id

        await self.simulate_external_operation_ms(1000)

        await _emit_event(
            workflow_id, "send_notification_success", "completed",
            detail="Customer notified: Transfer completed successfully!",
        )
        return "SUCCESS"

    @activity.defn
    async def undoWithdraw(self, amount: float) -> bool:
        workflow_id = activity.info().workflow_id
        await _emit_event(workflow_id, "undo_withdraw", "running")

        await self.simulate_external_operation_ms(1000)

        await _emit_event(
            workflow_id, "undo_withdraw", "completed",
            detail=f"Withdrawal reversed: ${amount:.2f}",
        )
        return True

    @activity.defn
    async def registerApproval(self, input: TransferInput) -> str:
        """Register a pending approval for the Bank Operations tab."""
        workflow_id = activity.info().workflow_id
        await _emit_event(
            workflow_id, "approval_wait", "running",
            detail="Awaiting bank employee approval...",
        )
        from datetime import datetime

        await _register_pending_approval(
            workflow_id,
            {
                "from_account": input.fromAccount,
                "to_account": input.toAccount,
                "amount": input.amount,
                "created_at": datetime.now().isoformat(),
            },
        )
        return "SUCCESS"

    @activity.defn
    async def removeApproval(self, input: TransferInput) -> str:
        """Remove a pending approval after timeout/denial."""
        workflow_id = activity.info().workflow_id
        await _remove_pending_approval(workflow_id)
        await _emit_event(
            workflow_id, "approval_wait", "failed",
            detail="Approval timed out — transfer denied automatically",
        )
        return "SUCCESS"
