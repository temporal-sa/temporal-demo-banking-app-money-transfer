# Runbook: Banking money transfer demo

This runbook is for presenting the demo. The [README](README.md) explains what it is and how it's built.

## What it shows

A customer sends money between accounts in a phone banking app, and a Temporal Workflow moves it: validate, withdraw, deposit, notify. Each scenario breaks the transfer a different way, and the Workflow handles it without the app or a person stepping in.

The demo makes four problems visible:

- **A bank API goes down partway through a transfer.** The withdrawal call fails four times and then recovers. The Workflow retries it on a backoff and the transfer finishes. Beat 2 shows it.
- **The money left one account and can't reach the other.** The deposit is rejected for good, so the Workflow reverses the withdrawal. Beat 3 shows it.
- **Some transfers need a person to approve them before the money moves.** The Workflow waits for a bank employee's approval, with a 30-second deadline. Beat 4 shows it.
- **A bug in the transfer code.** The transfer pauses where the bug is instead of failing, and finishes once the fix is deployed. Beat 5 shows it, on a local run.

## Before you start

- Install Docker with Compose, and `make`. The Temporal dev server and every service run in containers. To run without Docker, `scripts/start.sh` runs everything as local processes instead; it needs the [Temporal CLI](https://docs.temporal.io/cli), [uv](https://docs.astral.sh/uv/) and [Node.js](https://nodejs.org/).
- Clone the repo. The first start builds the containers.
- Locally, the demo uses ports 7233 and 8233 (Temporal), 8000 (API) and 5173 (app), plus 8081 with `ENCRYPT=1`.
- To run against Temporal Cloud instead of the local dev server:
  1. Copy `cloud.env.example` to `cloud.env` and set `TEMPORAL_ADDRESS`, `TEMPORAL_NAMESPACE`, and either `TEMPORAL_API_KEY` or `TEMPORAL_CERT_PATH` and `TEMPORAL_KEY_PATH`.
  2. Add the Search Attribute `Step` (Keyword) to the Namespace if you'll run **Advanced Visibility**. The local dev server registers it at start; a Cloud Namespace doesn't have it until you add it.
  3. Start with `make demo CLOUD_ENV=cloud.env`.

### On tmprl-demo.cloud

The catalog runs this demo at https://banking-app.tmprl-demo.cloud on a Temporal Cloud Namespace, with the Python Worker on the default `MoneyTransfer` Task Queue. There's no crashable environment for this demo, so you can't deploy a fix there (beat 5) or turn on encryption (beat 7).

The deployment is shared. The scenario lives in the API's memory, and changing it resets the screen for everyone using the demo at that moment.

## Start it

From the repository root:

```bash
make demo             # local dev server
make demo ENCRYPT=1   # local, with payload encryption and a codec server
```

`make demo` returns once every service is up and prints the URLs. Stop everything with `make down`.

Open http://localhost:5173. A healthy start shows the **Customer app** tab with a phone on **My Accounts** and a total balance of $180,000.00, **Scenario: Happy Path** and **Temporal UI** buttons in the top-right corner, a **Behind the scenes** panel that reads "Start a transfer to see what happens behind the scenes", and the **Workflow code** panel. The Temporal UI is at http://localhost:8233.

**Temporal UI** in the top-right corner opens the Namespace in the Temporal UI. After you confirm a transfer, **Open execution** at the bottom of **Behind the scenes** opens that transfer's execution.

To give a panel more room on screen, drag the divider between two panels. Double-click a divider to reset it. To put a panel away, press the button in its top-right corner; it folds to a narrow strip you can click to bring it back. The browser remembers the widths and folded panels.

## The walkthrough

Every beat starts the same way: pick the scenario, then send a transfer.

1. Click the **Scenario:** button in the top-right corner (**Demo settings**) and click a scenario under **Choose a scenario**. The settings close and the phone goes back to **My Accounts**.
2. On the phone, press **Send money**. Pick a **From** and a **To** account, type an amount or press one of **$50**, **$100**, **$250**, **$500**, and press **Review transfer**.
3. Press **Confirm transfer**. The phone switches to **Transfer Status**.
4. When it finishes, press **New transfer** to go back to the accounts.

To show the Workflow in another SDK language, pick it in the tabs under **Workflow code**.

The balances on screen are mock data and don't change after a transfer.

Leave **Presentation** on **Detailed** (the default) to see each step's result and error messages in **Behind the scenes**. **Simple** shows only the step's service and its attempt count.

**Behind the scenes** colours each step by its state: cyan while it runs, pink while it waits to retry, yellow while it waits on a person, green when it finishes and red when it fails. The legend at the bottom of the panel spells this out.

### 1. A transfer, step by step (Happy Path)

1. Pick **Happy Path** and send a transfer.
2. **Behind the scenes** lights up **Validate transfer**, **Withdraw funds**, **Deposit funds** and **Send notification** in turn, and the lines for the running step highlight in **Workflow code**. The phone ends on **Transfer complete**. It takes about ten seconds.
3. Say: "The app started one Workflow. Each of these boxes is an Activity, a call to a bank service. Temporal records each step as it finishes, so if anything crashed now, the transfer would pick up after the last finished step instead of starting over."
4. For proof, click **Open execution** and show the Event History: one scheduled, started and completed set per Activity.

The **Workflow code** panel is a simplified picture of the Workflow, not a copy of it. Its retry settings and the `compensations` list don't match the real code. Use [Show it in code](#show-it-in-code) for the real lines.

### 2. The bank API goes down, and the transfer still finishes (API Downtime)

1. Pick **API Downtime** and send a transfer.
2. **Withdraw funds** turns pink with "Withdraw API unavailable" between attempts, and its label counts up **· attempt 2**, **3**, **4**, with a longer pause each time. The fifth attempt succeeds, and the transfer finishes. Locally, the retries took about 17 seconds.
3. The phone only says "Processing transfer…". The customer never sees the outage.
4. Say: "The withdrawal service was down for a few seconds. Nobody wrote retry code for that. The Activity has a retry policy, and Temporal retried it with backoff until the service came back."
5. For proof, open the execution while it's retrying: the pending Activity shows its attempt count and last failure. The Event History doesn't get an event per failed attempt; it records the Activity once, when it finishes.

The settings say the deposit fails in this scenario. In the code, it's the withdrawal. The real retry policy has no attempt limit, whatever the **Workflow code** panel shows.

### 3. The deposit is rejected, and the money goes back (Invalid Account)

1. Pick **Invalid Account** and send a transfer to any account.
2. **Validate transfer** and **Withdraw funds** succeed. **Deposit funds** fails on its first attempt with "Account is invalid", and a **Compensation (saga)** list appears with **Undo withdrawal**. The phone ends on **Transfer reversed**: "Funds have been returned to your account."
3. Say: "This time retrying can't help: the account doesn't exist. The Activity marks the error as not retryable, so Temporal stops right away, and the Workflow runs the step that puts the money back."
4. For proof, open the execution. It ends **Failed** with type `DepositFailed`, and the history shows `undoWithdraw` completing before the failure.

This scenario fails every transfer, whichever accounts you pick. The **Invalid Test Account** in the **To** list doesn't change anything.

### 4. A bank employee approves the transfer (Human-in-the-Loop)

1. Pick **Human-in-the-Loop** and send a transfer.
2. After the withdrawal, the phone shows **Awaiting approval** and **Behind the scenes** shows **Await approval** in yellow, under a **Waiting for approval** banner.
3. Switch to the **Bank operations** tab. The transfer appears as a card marked **Waiting for approval** within a couple of seconds. Press **Approve** within 30 seconds of the withdrawal.
4. Switch back to **Customer app**. The deposit and notification run, and the phone ends on **Transfer complete**.

   To stay on **Customer app**, press **Approve transfer** in the **Waiting for approval** banner in **Behind the scenes** instead of steps 3 and 4. It sends the same Signal.
5. Say: "The Workflow has been waiting for a Signal from the bank's back office. It isn't holding a thread or polling a database. When the employee approves, Temporal delivers the Signal and the transfer carries on. It can wait like that for 30 seconds or 30 days."
6. For proof, open the execution and find the `WorkflowExecutionSignaled` event for `approveTransfer`.

Don't use this beat to show compensation. If no one approves in 30 seconds, the Workflow fails with `ApprovalTimeout` and the withdrawal isn't reversed. **Await approval** turns red, but the phone stays on "Processing transfer…". **Deny** turns the step red and removes the card from the list, but the Workflow still waits out the 30 seconds. Use beat 3 for compensation.

### 5. A bug pauses the transfer until you deploy a fix (Bug in Workflow)

This beat needs a local run, because you edit the Workflow code and restart the Worker.

1. Pick **Bug in Workflow** and send a transfer.
2. **Withdraw funds** completes, and then nothing else happens. The phone stays on "Processing transfer…".
3. Open the execution in the Temporal UI. It's **Running**, and the history shows `WorkflowTaskFailed` with "Simulated bug - fix me!", repeating as Temporal retries the Workflow Task.
4. Say: "That's a bug in our Workflow code, not an outage. Temporal doesn't fail the transfer or lose the withdrawal. It holds the Workflow where it is and keeps retrying until there's code that works."
5. In `workflows/python/src/banking_workflows/account_transfer_workflow_scenarios.py`, comment out line 107, `raise RuntimeError("Simulated bug - fix me!")`.
6. Restart the Worker with the fix:
   - With Docker: `make worker` from the repository root.
   - Without Docker: `scripts/start.sh` runs everything in one terminal, so for this beat start the services one by one as in the README's [Development](README.md#development) section, then stop the Worker with `Ctrl-C` and start it again.
7. On the next Workflow Task retry, the transfer continues from after the withdrawal: deposit, then notification. The retries back off, so it can take several seconds. The phone ends on **Transfer complete**.
8. Say: "We fixed the code and restarted the Worker. The transfer picked up after the withdrawal it had already done, and didn't withdraw twice."
9. Undo the edit afterwards: `git checkout -- workflows/python/src/banking_workflows/account_transfer_workflow_scenarios.py`.

The settings say this scenario "demonstrates versioning/patching". The walkthrough above fixes the code in place. The fix only adds steps after the point where the Workflow stopped, so the transfer's history replays cleanly on the new code.

On tmprl-demo.cloud you can show steps 1 to 4 but not the fix. Terminate the transfer afterwards; see [Reset and tear down](#reset-and-tear-down).

### 6. Find transfers by step (Advanced Visibility, optional)

1. Pick **Advanced Visibility** and send a transfer. It runs like **Happy Path**.
2. In the Temporal UI's Workflows list, filter with `Step="Deposit"` while a transfer is depositing, or `Step="Send notification"` after it finishes. Locally you can also run `temporal workflow list --query 'Step="Send notification"'`.
3. Say: "The Workflow tags itself with the step it's on, so operations can find every transfer stuck at the deposit with one search, without a separate status table."

The `Step` Search Attribute has to exist on the Namespace. If it doesn't, this transfer stalls; see [When something goes wrong](#when-something-goes-wrong).

### 7. Keep the payloads encrypted (optional, local)

1. Start with `make demo ENCRYPT=1` and send any transfer. The codec server takes a few seconds longer than the rest to answer.
2. In the Temporal UI, open the execution. The Activity inputs and results show encoding `binary/encrypted` instead of account numbers and amounts. The Workflow's own start input is still readable, because the API starts the Workflow without the codec; see [the encryption entry](#encrypt-payloads-before-they-leave-the-worker).
3. On **Workflows**, select **Configure Codec Server** in the top-right corner and set the endpoint to `http://localhost:8081`. The payloads now show in clear text.
4. Say: "The Worker encrypts everything before it leaves the process. Temporal stores and shows ciphertext. Your browser decrypts it through a codec server you run, so the plaintext never goes through Temporal."

## Show it in code

All links point at commit [`4f38b74`](https://github.com/temporal-sa/temporal-demo-banking-app-money-transfer/commit/4f38b74a1f168848761bdded762bff51cf6bf0d2). Open a file locally with `code -g <path>:<line>`.

The demo has two Workflow classes. `AccountTransferWorkflow` runs **Happy Path**. `AccountTransferWorkflowScenarios` is a dynamic Workflow that runs the other five scenarios and branches on the Workflow Type name the API started it with. Most entries below are in the second one.

### Retry a flaky bank API without writing retry code

**When to use it:** after beat 2, or when someone asks what it took to survive the outage.

**Where it is:** [`workflows/python/src/banking_workflows/activities.py` lines 103–107](https://github.com/temporal-sa/temporal-demo-banking-app-money-transfer/blob/4f38b74a1f168848761bdded762bff51cf6bf0d2/workflows/python/src/banking_workflows/activities.py#L103-L107) (`code -g workflows/python/src/banking_workflows/activities.py:103`), used in [`workflows/python/src/banking_workflows/account_transfer_workflow_scenarios.py` lines 64–70](https://github.com/temporal-sa/temporal-demo-banking-app-money-transfer/blob/4f38b74a1f168848761bdded762bff51cf6bf0d2/workflows/python/src/banking_workflows/account_transfer_workflow_scenarios.py#L64-L70) (`code -g workflows/python/src/banking_workflows/account_transfer_workflow_scenarios.py:64`)

```python
retry_policy = RetryPolicy(
    initial_interval=timedelta(seconds=1),
    backoff_coefficient=2,
    maximum_interval=timedelta(seconds=30),
)
```

```python
self.upsertStep("Withdraw")
await workflow.execute_activity(
    AccountTransferActivities.withdraw,
    args=[idempotencyKey, input.amount, self.workflow_type],
    start_to_close_timeout=self.start_to_close_timeout,
    retry_policy=self.retry_policy,
)
```

**What you need to understand:**

- The first retry waits 1 second, and each wait doubles, up to 30 seconds. In beat 2 the waits are 1, 2, 4 and 8 seconds before the fifth attempt succeeds.
- There's no `maximum_attempts`, so the Activity retries until it succeeds. The 5-second `start_to_close_timeout` limits one attempt, not the total. To cap the total time, add a `schedule_to_close_timeout`; to cap the count, set `maximum_attempts`.
- The **Happy Path** Workflow sets the same policy but uses a 5-second `schedule_to_close_timeout` instead ([`account_transfer_workflow.py` line 29](https://github.com/temporal-sa/temporal-demo-banking-app-money-transfer/blob/4f38b74a1f168848761bdded762bff51cf6bf0d2/workflows/python/src/banking_workflows/account_transfer_workflow.py#L29)). That caps all attempts of each Activity together at 5 seconds, so an outage like beat 2's would fail it.
- Temporal schedules each retry on the server. The Worker holds nothing while it waits, and a Worker restart in the middle doesn't reset the count.
- The Workflow makes an idempotency key with `workflow.uuid4()` and passes it to `withdraw` and `deposit`, so a real bank API could ignore a repeated call. `workflow.uuid4()` returns the same value when the Workflow replays. The mock Activities don't use the key.

**What the customer doesn't write:** a retry loop, a backoff timer, a queue to park failed calls on, or a job to pick them back up.

**Docs:** [Retry Policies](https://docs.temporal.io/encyclopedia/retry-policies), [Python: Activity timeouts and retries](https://docs.temporal.io/develop/python/activities/timeouts)

### Stop retrying when retrying can't help

**When to use it:** during beat 3, or when someone asks how Temporal knows not to retry forever.

**Where it is:** [`workflows/python/src/banking_workflows/activities.py` lines 177–186](https://github.com/temporal-sa/temporal-demo-banking-app-money-transfer/blob/4f38b74a1f168848761bdded762bff51cf6bf0d2/workflows/python/src/banking_workflows/activities.py#L177-L186) (`code -g workflows/python/src/banking_workflows/activities.py:177`)

```python
if self.INVALID_ACCOUNT == error:
    await _emit_event(
        transfer_id, "deposit", "failed",
        error="Account is invalid",
    )
    raise ApplicationError(
        "Deposit activity failed, account is invalid",
        type="InvalidAccount",
        non_retryable=True,
    )
```

**What you need to understand:**

- `non_retryable=True` tells Temporal to fail the Activity on this attempt, whatever the retry policy says. The deposit runs once.
- Any other exception from an Activity is retryable by default; that's why the withdrawal in beat 2 retried.
- The error `type` lets you choose in one place instead: list `"InvalidAccount"` in the retry policy's `non_retryable_error_types`, and the Activity can raise a plain retryable error.

**Docs:** [Failures: Application Failure](https://docs.temporal.io/references/failures#application-failure), [Python error handling](https://docs.temporal.io/develop/python/best-practices/error-handling)

### Put the money back when the deposit fails

**When to use it:** right after the previous entry, or when someone asks what happens to money that has already left.

**Where it is:** [`workflows/python/src/banking_workflows/account_transfer_workflow_scenarios.py` lines 109–131](https://github.com/temporal-sa/temporal-demo-banking-app-money-transfer/blob/4f38b74a1f168848761bdded762bff51cf6bf0d2/workflows/python/src/banking_workflows/account_transfer_workflow_scenarios.py#L109-L131) (`code -g workflows/python/src/banking_workflows/account_transfer_workflow_scenarios.py:109`)

```python
# Deposit
self.upsertStep("Deposit")
try:
    self.depositResponse = await workflow.execute_activity(
        AccountTransferActivities.deposit,
        args=[idempotencyKey, input.amount, self.workflow_type],
        start_to_close_timeout=self.start_to_close_timeout,
        retry_policy=self.retry_policy,
    )
    await self.updateProgress(75, 1)
except Exception as ex:
    logger.info("Deposit failed unrecoverable error, reverting withdraw")
    await workflow.execute_activity(
        AccountTransferActivities.undoWithdraw,
        args=[input.amount],
        start_to_close_timeout=self.start_to_close_timeout,
        retry_policy=self.retry_policy,
    )
    raise ApplicationError(
        f"{ex.__cause__}",
        type="DepositFailed",
        non_retryable=True,
    )
```

**What you need to understand:**

- This is the saga pattern in its plainest form: a `try` around the step that can fail, and the step that undoes the earlier one in the `except`.
- The deposit only fails into the `except` once its retries are over. A transient deposit outage would retry like beat 2 and never reach this code.
- `undoWithdraw` has the same unlimited retry policy, so the refund keeps trying until the bank accepts it. Temporal keeps the Workflow's place through Worker restarts while it does.
- Raising `ApplicationError` afterwards fails the Workflow with type `DepositFailed`, so the failed transfer is easy to find. Raising a plain Python exception here would pause the Workflow instead; see the bug entry below.
- Only the deposit is covered. A failure anywhere else after the withdrawal, such as the approval timeout in beat 4, doesn't reach this `except`. A transfer with more steps would keep a list of undo steps and run it in reverse.

**Docs:** [Saga pattern](https://docs.temporal.io/design-patterns/saga-pattern)

### Wait for a person's approval, with a deadline

**When to use it:** during beat 4, or when someone asks how the Workflow waits for the back office.

**Where it is:** [`workflows/python/src/banking_workflows/account_transfer_workflow_scenarios.py` lines 73–104](https://github.com/temporal-sa/temporal-demo-banking-app-money-transfer/blob/4f38b74a1f168848761bdded762bff51cf6bf0d2/workflows/python/src/banking_workflows/account_transfer_workflow_scenarios.py#L73-L104) (`code -g workflows/python/src/banking_workflows/account_transfer_workflow_scenarios.py:73`) and the Signal handler at [lines 145–153](https://github.com/temporal-sa/temporal-demo-banking-app-money-transfer/blob/4f38b74a1f168848761bdded762bff51cf6bf0d2/workflows/python/src/banking_workflows/account_transfer_workflow_scenarios.py#L145-L153). **Approve** sends the Signal from [`backend/src/banking_demo/api/routes.py` lines 190–208](https://github.com/temporal-sa/temporal-demo-banking-app-money-transfer/blob/4f38b74a1f168848761bdded762bff51cf6bf0d2/backend/src/banking_demo/api/routes.py#L190-L208).

```python
if self.NEEDS_APPROVAL == self.workflow_type:
    # ...
    try:
        await workflow.wait_condition(
            lambda: self.approved,
            timeout=timedelta(seconds=self.approvalTime),
        )
    except asyncio.TimeoutError:
        # ...
        raise ApplicationError(
            f"Approval not received within {self.approvalTime} seconds",
            type="ApprovalTimeout",
            non_retryable=True,
        )
```

```python
@workflow.signal(name="approveTransfer")
def approveTransferSignal(self) -> str:
    workflow.logger.info("Approve Signal Received")
    if self.transferState == "waiting":
        self.approved = True
    # ...
```

```python
client = await get_temporal_client()
handle = client.get_workflow_handle(f"transfer-{transfer_id}")
await handle.signal("approveTransfer")
```

**What you need to understand:**

- `wait_condition` blocks until `self.approved` is true or 30 seconds pass. Temporal keeps the wait and the timer durable, so a Worker restart during the wait doesn't lose either.
- The `approveTransfer` Signal sets the flag. The API sends it by Workflow ID; it doesn't need anything from the Worker.
- On timeout, `wait_condition` raises `asyncio.TimeoutError`, and the Workflow removes the pending card and fails with `ApprovalTimeout`. It doesn't reverse the withdrawal; that would need the undo step from the previous entry.
- There's no deny Signal. **Deny** in the UI only removes the card. A real approval flow would send the decision in the Signal and act on a denial right away.
- In production the deadline would be hours or days, not 30 seconds. The wait costs the same either way.

**Docs:** [Approval pattern](https://docs.temporal.io/design-patterns/approval), [Python: Signals](https://docs.temporal.io/develop/python/message-passing)

### A bug pauses the Workflow instead of failing it

**When to use it:** during beat 5, or when someone asks what happens to in-flight transfers when the code is wrong.

**Where it is:** [`workflows/python/src/banking_workflows/account_transfer_workflow_scenarios.py` lines 106–107](https://github.com/temporal-sa/temporal-demo-banking-app-money-transfer/blob/4f38b74a1f168848761bdded762bff51cf6bf0d2/workflows/python/src/banking_workflows/account_transfer_workflow_scenarios.py#L106-L107) (`code -g workflows/python/src/banking_workflows/account_transfer_workflow_scenarios.py:106`)

```python
if self.BUG == self.workflow_type:
    raise RuntimeError("Simulated bug - fix me!")
```

**What you need to understand:**

- In the Python SDK, an exception from Workflow code that isn't a Temporal failure, such as this `RuntimeError`, fails the Workflow Task, not the Workflow. The Workflow stays **Running**, and Temporal retries the task.
- On each retry, the Worker replays the history and reaches the same line. Once the Worker runs code without the bug, replay passes that point and the Workflow schedules the deposit. Completed Activities aren't run again, so the withdrawal happens once.
- `ApplicationError`, which the other scenarios raise, does fail the Workflow. That's the choice between "this transfer is finished, and failed" and "this is our bug; hold it until we fix it".
- A fix that changes steps the Workflow has already passed can fail replay with a non-determinism error. This fix only removes code after the last recorded step.

**Docs:** [Python: Raise exceptions from Workflows](https://docs.temporal.io/develop/python/best-practices/error-handling#raise-exceptions-from-workflows), [Failures: Errors in Workflows](https://docs.temporal.io/references/failures#errors-in-workflows)

### Tag each transfer with the step it's on

**When to use it:** during beat 6, or when someone asks how operations would find stuck transfers.

**Where it is:** [`workflows/python/src/banking_workflows/account_transfer_workflow_scenarios.py` line 29](https://github.com/temporal-sa/temporal-demo-banking-app-money-transfer/blob/4f38b74a1f168848761bdded762bff51cf6bf0d2/workflows/python/src/banking_workflows/account_transfer_workflow_scenarios.py#L29) and [lines 165–168](https://github.com/temporal-sa/temporal-demo-banking-app-money-transfer/blob/4f38b74a1f168848761bdded762bff51cf6bf0d2/workflows/python/src/banking_workflows/account_transfer_workflow_scenarios.py#L165-L168) (`code -g workflows/python/src/banking_workflows/account_transfer_workflow_scenarios.py:165`); the attribute is created by the `temporal` service's `--search-attribute Step=Keyword` flag in [`docker-compose.yml` line 11](https://github.com/temporal-sa/temporal-demo-banking-app-money-transfer/blob/afeabcbec6e42c56266561eaa7b7a4533b31985c/docker-compose.yml#L11), or without Docker in [`scripts/start.sh` line 123](https://github.com/temporal-sa/temporal-demo-banking-app-money-transfer/blob/4f38b74a1f168848761bdded762bff51cf6bf0d2/scripts/start.sh#L123)

```python
WORKFLOW_STEP = SearchAttributeKey.for_keyword("Step")
```

```python
def upsertStep(self, step: str) -> None:
    if self.ADVANCED_VISIBILITY == self.workflow_type:
        workflow.logger.info(f"Advanced visibility... On step: {step}")
        workflow.upsert_search_attributes([self.WORKFLOW_STEP.value_set(step)])
```

**What you need to understand:**

- `Step` is a custom Search Attribute. The Workflow updates it before each step, and the Temporal UI, the CLI and the client's list API can filter on it.
- Each update is an event in the Workflow's history.
- The attribute has to be created on the Namespace first, with `temporal operator search-attribute create` locally or in Namespace settings on Temporal Cloud.

**Docs:** [Python: Upsert Search Attributes](https://docs.temporal.io/develop/python/platform/observability#upsert-search-attributes)

### Encrypt payloads before they leave the Worker

**When to use it:** during beat 7, or when someone asks whether Temporal sees their customers' data.

**Where it is:** [`workflows/python/src/banking_workflows/worker.py` lines 37–48](https://github.com/temporal-sa/temporal-demo-banking-app-money-transfer/blob/4f38b74a1f168848761bdded762bff51cf6bf0d2/workflows/python/src/banking_workflows/worker.py#L37-L48) (`code -g workflows/python/src/banking_workflows/worker.py:37`) and [`workflows/python/src/banking_workflows/codec.py` lines 29–39](https://github.com/temporal-sa/temporal-demo-banking-app-money-transfer/blob/4f38b74a1f168848761bdded762bff51cf6bf0d2/workflows/python/src/banking_workflows/codec.py#L29-L39)

```python
def build_data_converter() -> temporalio.converter.DataConverter:
    encrypt = _env_enabled("BANKING_ENCRYPT")

    data_converter = temporalio.converter.default()
    if encrypt:
        from banking_workflows.codec import EncryptionCodec

        print("Encrypting payloads")
        data_converter = dataclasses.replace(
            data_converter, payload_codec=EncryptionCodec()
        )
    return data_converter
```

```python
async def encode(self, payloads: Iterable[Payload]) -> List[Payload]:
    return [
        Payload(
            metadata={
                "encoding": b"binary/encrypted",
                "encryption-key-id": self.key_id.encode(),
            },
            data=self._encrypt(p.SerializeToString()),
        )
        for p in payloads
    ]
```

**What you need to understand:**

- A payload codec runs on every payload the Worker sends to Temporal and every one it receives. This one encrypts with AES-GCM and marks the payload `binary/encrypted`.
- The Workflow and Activity code don't change. Encryption is one option on the client's data converter.
- The API process doesn't use the codec. It starts Workflows with the account numbers and amount as input, so those start inputs reach Temporal unencrypted. A production setup would give every client the same codec.
- The codec server (`codec_server.py`) runs the same codec over HTTP so the Temporal UI can decode in the browser.
- The key is hard-coded in the repo. Production keys come from a key management system, and the key ID in the metadata lets you rotate them.

**Docs:** [Codec Server](https://docs.temporal.io/codec-server), [Set your Codec Server endpoints with Web UI and CLI](https://docs.temporal.io/production-deployment/data-encryption#web-ui)

### What's demo-only

When someone asks what they'd change for their own system, these are the parts to leave out:

- **The bank is simulated.** [`workflows/python/src/banking_workflows/activities.py` lines 109–119](https://github.com/temporal-sa/temporal-demo-banking-app-money-transfer/blob/4f38b74a1f168848761bdded762bff51cf6bf0d2/workflows/python/src/banking_workflows/activities.py#L109-L119): each Activity sleeps and fails while the attempt number is below 5, if the Workflow Type names that failure. Real Activities call the bank's APIs, and the failures come from the bank.
- **The scenario is the Workflow Type name.** [`backend/src/banking_demo/models.py` lines 19–26](https://github.com/temporal-sa/temporal-demo-banking-app-money-transfer/blob/4f38b74a1f168848761bdded762bff51cf6bf0d2/backend/src/banking_demo/models.py#L19-L26) maps each scenario to a name, and the dynamic Workflow branches on it. A real system has one transfer Workflow.
- **The UI events.** [`workflows/python/src/banking_workflows/activities.py` lines 19–60](https://github.com/temporal-sa/temporal-demo-banking-app-money-transfer/blob/4f38b74a1f168848761bdded762bff51cf6bf0d2/workflows/python/src/banking_workflows/activities.py#L19-L60): Activities post their progress to the API so the screen can animate. The pending-approval list in **Bank operations** is kept the same way.
- **The progress sleeps.** `updateProgress` sleeps between steps so the audience can follow along. They're durable timers, and a real transfer wouldn't have them.
- **The encryption key.** [`workflows/python/src/banking_workflows/codec.py` lines 16–18](https://github.com/temporal-sa/temporal-demo-banking-app-money-transfer/blob/4f38b74a1f168848761bdded762bff51cf6bf0d2/workflows/python/src/banking_workflows/codec.py#L16-L18).

## Reset and tear down

- **Between transfers:** press **New transfer** on the phone. If a transfer never finishes on screen (beat 4 after a timeout, beat 5 before the fix), reload the page.
- **Between scenarios:** picking a scenario in **Demo settings** clears the API's in-memory transfers and pending approvals. Workflows that are still running keep running.
- **Close what's still open:** a **Bug in Workflow** transfer stays **Running** until the fix is deployed or you terminate it. Locally, `make reset` terminates every running transfer and clears the API's state, which also sets the scenario back to **Happy Path**. Otherwise terminate it from its page in the Temporal UI. On Temporal Cloud, do this before you leave; the Workflow Task keeps retrying until you do. A **Human-in-the-Loop** transfer ends on its own after 30 seconds.
- **To stop:** run `make down`. It removes the containers, including the dev server, which keeps its data in memory, so nothing carries over to the next start. With `scripts/start.sh`, press `Ctrl-C` in its terminal instead.

## When something goes wrong

| What you see | Likely cause | Fix |
|---|---|---|
| The phone stays on "Processing transfer…" and **Behind the scenes** stays empty | The Worker isn't running, or it polls a different Task Queue from the one the API starts on | Check the Worker's logs. Both read `TEMPORAL_TASK_QUEUE` and default to `MoneyTransfer` |
| An **Advanced Visibility** transfer stalls before **Validate Transfer** | The `Step` Search Attribute doesn't exist on the Namespace | Locally, `make down` and `make demo` again; the dev server registers it at start. On Cloud, add it to the Namespace |
| After **Human-in-the-Loop**, the phone stays on "Processing transfer…" with no **New transfer** button, and **Await approval** is red | Nobody approved within 30 seconds, or someone pressed **Deny**; the Workflow failed with `ApprovalTimeout` | Expected in this code. Reload the page, and approve faster next time |
| **Approve** does nothing, or the card is already gone | The 30 seconds had passed, or someone pressed **Deny** | Send a new transfer |
| The **Bug in Workflow** transfer doesn't resume after the fix | The Worker is still running the old code | With Docker, rebuild it: `make worker`. Otherwise restart the Worker process |
| The screen resets in the middle of a beat on tmprl-demo.cloud | Someone else changed the scenario on the shared deployment | Send the transfer again |
| Payloads stay `binary/encrypted` after setting the codec endpoint | The codec server isn't running, or the browser blocked it | Start with `make demo ENCRYPT=1`, which runs it on port 8081, give it a few seconds, and check the browser console |

## Keeping this runbook current

The code links point at a fixed commit. When a linked file changes, update its link, line numbers, and snippet together. Before an event, list the linked files that have changed:

```sh
grep -oE 'blob/[0-9a-f]{40}/[^#)]+' RUNBOOK.md | sort -u | while IFS=/ read -r _ sha file; do
  git diff --quiet "$sha" HEAD -- "$file" || echo "changed since ${sha:0:7}: $file"
done
```
