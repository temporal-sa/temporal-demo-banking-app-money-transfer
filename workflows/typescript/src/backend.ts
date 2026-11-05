import type { TransferInput } from './types';

export interface StepUpdate {
  step: string;
  status: string;
  attempt?: number;
  maxAttempts?: number;
  error?: string;
  detail?: string;
}

/**
 * Pushes step updates and approvals to the API. Every call is best effort: a
 * missed UI update shouldn't fail the Activity.
 */
export class BackendClient {
  constructor(private readonly baseUrl: string) {}

  emit(workflowId: string, update: StepUpdate): Promise<void> {
    return this.send('POST', '/api/internal/events', {
      workflow_id: workflowId,
      step: update.step,
      status: update.status,
      attempt: update.attempt ?? 1,
      max_attempts: update.maxAttempts ?? 1,
      error: update.error ?? null,
      detail: update.detail ?? '',
      timestamp: new Date().toISOString(),
    });
  }

  registerApproval(workflowId: string, input: TransferInput): Promise<void> {
    return this.send('POST', `/api/internal/pending-approvals/${workflowId}`, {
      from_account: input.fromAccount,
      to_account: input.toAccount,
      amount: input.amount,
      created_at: new Date().toISOString(),
    });
  }

  removeApproval(workflowId: string): Promise<void> {
    return this.send('DELETE', `/api/internal/pending-approvals/${workflowId}`);
  }

  private async send(method: string, path: string, body?: unknown): Promise<void> {
    if (!this.baseUrl) return;
    try {
      await fetch(this.baseUrl + path, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      // Best effort, see the class comment.
    }
  }
}
