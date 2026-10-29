export interface CodeLine {
  text: string;
  indent: number;
  step?: string;
  isComment?: boolean;
  isDecorator?: boolean;
  isBlank?: boolean;
}

export const pythonCode: CodeLine[] = [
  { text: "@workflow.defn", indent: 0, isDecorator: true },
  { text: "class AccountTransferWorkflow:", indent: 0 },
  { text: "", indent: 0, isBlank: true },
  { text: "  @workflow.run", indent: 1, isDecorator: true },
  { text: "  async def run(self, transfer):", indent: 1 },
  { text: "    compensations = []", indent: 2 },
  { text: "    try:", indent: 2 },
  { text: "", indent: 0, isBlank: true },
  { text: "      # Validate the transfer", indent: 3, isComment: true },
  {
    text: "      await workflow.execute_activity(",
    indent: 3,
    step: "validate",
  },
  { text: "        validate, transfer,", indent: 4, step: "validate" },
  { text: "        retry=RetryPolicy(max=3))", indent: 4, step: "validate" },
  { text: "", indent: 0, isBlank: true },
  {
    text: "      # Withdraw — register compensation first",
    indent: 3,
    isComment: true,
  },
  {
    text: "      compensations.append(undo_withdraw)",
    indent: 3,
    step: "withdraw",
  },
  {
    text: "      await workflow.execute_activity(",
    indent: 3,
    step: "withdraw",
  },
  { text: "        withdraw, transfer,", indent: 4, step: "withdraw" },
  { text: "        retry=RetryPolicy(max=10,", indent: 4, step: "withdraw" },
  { text: "          backoff=1.5))", indent: 4, step: "withdraw" },
  { text: "", indent: 0, isBlank: true },
  {
    text: "      # Wait for approval (human in the loop)",
    indent: 3,
    isComment: true,
  },
  {
    text: "      await workflow.wait_condition(",
    indent: 3,
    step: "approval_wait",
  },
  { text: "        lambda: self.approved,", indent: 4, step: "approval_wait" },
  {
    text: "        timeout=timedelta(seconds=30))",
    indent: 4,
    step: "approval_wait",
  },
  { text: "", indent: 0, isBlank: true },
  {
    text: "      # Deposit — retries automatically",
    indent: 3,
    isComment: true,
  },
  {
    text: "      await workflow.execute_activity(",
    indent: 3,
    step: "deposit",
  },
  { text: "        deposit, transfer,", indent: 4, step: "deposit" },
  { text: "        retry=RetryPolicy(max=10,", indent: 4, step: "deposit" },
  { text: "          backoff=1.5))", indent: 4, step: "deposit" },
  { text: "", indent: 0, isBlank: true },
  { text: "      # Notify customer of success", indent: 3, isComment: true },
  {
    text: "      await workflow.execute_activity(",
    indent: 3,
    step: "send_notification_success",
  },
  {
    text: "        send_notification, transfer)",
    indent: 4,
    step: "send_notification_success",
  },
];

export const pythonCompensation: CodeLine[] = [
  { text: "", indent: 0, isBlank: true },
  {
    text: "    # Saga: run compensations in reverse",
    indent: 2,
    isComment: true,
  },
  { text: "    except Exception:", indent: 2 },
  {
    text: "      for comp in reversed(compensations):",
    indent: 3,
    step: "undo_withdraw",
  },
  { text: "        await comp(transfer)", indent: 4, step: "undo_withdraw" },
  {
    text: "      await send_notification(fail=True)",
    indent: 3,
    step: "send_notification_failure",
  },
];

export const goCode: CodeLine[] = [
  { text: "func AccountTransferWorkflow(", indent: 0 },
  { text: "  ctx workflow.Context, transfer Transfer,", indent: 1 },
  { text: ") (err error) {", indent: 0 },
  { text: "  var compensations []any", indent: 1 },
  { text: "  defer func() {", indent: 1 },
  { text: "    if err != nil {", indent: 2 },
  { text: "      compensate(ctx, compensations, transfer)", indent: 3 },
  { text: "    }", indent: 2 },
  { text: "  }()", indent: 1 },
  { text: "", indent: 0, isBlank: true },
  { text: "  // Validate the transfer", indent: 1, isComment: true },
  { text: "  err = workflow.ExecuteActivity(", indent: 1, step: "validate" },
  { text: "    workflow.WithRetryPolicy(ctx,", indent: 2, step: "validate" },
  {
    text: "      temporal.RetryPolicy{MaximumAttempts: 3}),",
    indent: 3,
    step: "validate",
  },
  { text: "    Validate, transfer).Get(ctx, nil)", indent: 2, step: "validate" },
  { text: "  if err != nil {", indent: 1, step: "validate" },
  { text: "    return err", indent: 2, step: "validate" },
  { text: "  }", indent: 1, step: "validate" },
  { text: "", indent: 0, isBlank: true },
  {
    text: "  // Withdraw — register compensation first",
    indent: 1,
    isComment: true,
  },
  {
    text: "  compensations = append(compensations, UndoWithdraw)",
    indent: 1,
    step: "withdraw",
  },
  { text: "  err = workflow.ExecuteActivity(", indent: 1, step: "withdraw" },
  {
    text: "    workflow.WithRetryPolicy(ctx, temporal.RetryPolicy{",
    indent: 2,
    step: "withdraw",
  },
  {
    text: "      MaximumAttempts: 10, BackoffCoefficient: 1.5}),",
    indent: 3,
    step: "withdraw",
  },
  { text: "    Withdraw, transfer).Get(ctx, nil)", indent: 2, step: "withdraw" },
  { text: "  if err != nil {", indent: 1, step: "withdraw" },
  { text: "    return err", indent: 2, step: "withdraw" },
  { text: "  }", indent: 1, step: "withdraw" },
  { text: "", indent: 0, isBlank: true },
  {
    text: "  // Wait for approval (human in the loop)",
    indent: 1,
    isComment: true,
  },
  {
    text: "  _, err = workflow.AwaitWithTimeout(ctx,",
    indent: 1,
    step: "approval_wait",
  },
  { text: "    30*time.Second,", indent: 2, step: "approval_wait" },
  {
    text: "    func() bool { return approved })",
    indent: 2,
    step: "approval_wait",
  },
  { text: "", indent: 0, isBlank: true },
  {
    text: "  // Deposit — retries automatically",
    indent: 1,
    isComment: true,
  },
  { text: "  err = workflow.ExecuteActivity(", indent: 1, step: "deposit" },
  {
    text: "    workflow.WithRetryPolicy(ctx, temporal.RetryPolicy{",
    indent: 2,
    step: "deposit",
  },
  {
    text: "      MaximumAttempts: 10, BackoffCoefficient: 1.5}),",
    indent: 3,
    step: "deposit",
  },
  { text: "    Deposit, transfer).Get(ctx, nil)", indent: 2, step: "deposit" },
  { text: "  if err != nil {", indent: 1, step: "deposit" },
  { text: "    return err", indent: 2, step: "deposit" },
  { text: "  }", indent: 1, step: "deposit" },
  { text: "", indent: 0, isBlank: true },
  { text: "  // Notify customer of success", indent: 1, isComment: true },
  {
    text: "  return workflow.ExecuteActivity(ctx,",
    indent: 1,
    step: "send_notification_success",
  },
  {
    text: "    SendNotification, transfer).Get(ctx, nil)",
    indent: 2,
    step: "send_notification_success",
  },
  { text: "}", indent: 0 },
];

export const goCompensation: CodeLine[] = [
  { text: "", indent: 0, isBlank: true },
  {
    text: "// Saga: run compensations in reverse",
    indent: 0,
    isComment: true,
  },
  { text: "func compensate(ctx workflow.Context,", indent: 0 },
  { text: "  comps []any, transfer Transfer) {", indent: 1 },
  {
    text: "  for i := len(comps) - 1; i >= 0; i-- {",
    indent: 1,
    step: "undo_withdraw",
  },
  {
    text: "    _ = workflow.ExecuteActivity(ctx,",
    indent: 2,
    step: "undo_withdraw",
  },
  {
    text: "      comps[i], transfer).Get(ctx, nil)",
    indent: 3,
    step: "undo_withdraw",
  },
  { text: "  }", indent: 1, step: "undo_withdraw" },
  {
    text: "  _ = workflow.ExecuteActivity(ctx,",
    indent: 1,
    step: "send_notification_failure",
  },
  {
    text: "    SendNotification, transfer, Failed).Get(ctx, nil)",
    indent: 2,
    step: "send_notification_failure",
  },
  { text: "}", indent: 0 },
];
