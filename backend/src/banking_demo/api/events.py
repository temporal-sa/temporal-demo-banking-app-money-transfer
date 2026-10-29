from __future__ import annotations

import asyncio
import json

from banking_demo.models import StepUpdate, TransferEvent
from banking_demo.sessions import TransferRecord


async def publish(record: TransferRecord, update: StepUpdate) -> None:
    """Queue a step update for the browser following this transfer."""
    event = TransferEvent(
        transfer_id=record.transfer.transfer_id,
        **update.model_dump(include=set(StepUpdate.model_fields)),
    )
    await record.events.put(event.model_dump(mode="json"))


async def event_generator(record: TransferRecord):
    """Async generator yielding SSE events for a given transfer."""
    queue = record.events

    while True:
        try:
            event = await asyncio.wait_for(queue.get(), timeout=300)
            yield {"event": "transfer_update", "data": json.dumps(event)}

            status = event.get("status")
            step = event.get("step")

            # Success: notification sent after successful transfer
            if status == "completed" and step == "send_notification_success":
                yield {
                    "event": "transfer_complete",
                    "data": json.dumps({"final_status": "completed"}),
                }
                return

            # Compensation complete: withdrawal reversed
            if status == "completed" and step == "undo_withdraw":
                yield {
                    "event": "transfer_complete",
                    "data": json.dumps({"final_status": "reversed"}),
                }
                return

            # Failure notification sent
            if status == "completed" and step == "send_notification_failure":
                yield {
                    "event": "transfer_complete",
                    "data": json.dumps({"final_status": "failed"}),
                }
                return

            # Non-retryable failure on validate (no side effects yet, no compensation needed)
            if status == "failed" and step == "validate":
                yield {
                    "event": "transfer_complete",
                    "data": json.dumps({"final_status": "failed"}),
                }
                return

        except asyncio.TimeoutError:
            yield {"event": "timeout", "data": json.dumps({"timeout": True})}
            return
