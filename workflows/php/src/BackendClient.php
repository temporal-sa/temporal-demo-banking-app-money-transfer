<?php

declare(strict_types=1);

use Symfony\Component\HttpClient\HttpClient;
use Symfony\Contracts\HttpClient\HttpClientInterface;

/**
 * Pushes step updates and approvals to the API. Every call is best effort: a
 * missed UI update shouldn't fail the Activity.
 */
final class BackendClient
{
    private readonly HttpClientInterface $http;

    public function __construct(private readonly string $baseUrl)
    {
        $this->http = HttpClient::create(['timeout' => 5]);
    }

    public function emit(
        string $workflowId,
        string $step,
        string $status,
        int $attempt = 1,
        int $maxAttempts = 1,
        ?string $error = null,
        string $detail = '',
    ): void {
        $this->send('POST', '/api/internal/events', [
            'workflow_id' => $workflowId,
            'step' => $step,
            'status' => $status,
            'attempt' => $attempt,
            'max_attempts' => $maxAttempts,
            'error' => $error,
            'detail' => $detail,
            'timestamp' => date(DATE_ATOM),
        ]);
    }

    public function registerApproval(string $workflowId, array $input): void
    {
        $this->send('POST', "/api/internal/pending-approvals/{$workflowId}", [
            'from_account' => $input['fromAccount'],
            'to_account' => $input['toAccount'],
            'amount' => $input['amount'],
            'created_at' => date(DATE_ATOM),
        ]);
    }

    public function removeApproval(string $workflowId): void
    {
        $this->send('DELETE', "/api/internal/pending-approvals/{$workflowId}");
    }

    private function send(string $method, string $path, ?array $body = null): void
    {
        if ($this->baseUrl === '') {
            return;
        }
        try {
            $options = $body === null ? [] : ['json' => $body];
            $this->http->request($method, $this->baseUrl . $path, $options)->getStatusCode();
        } catch (\Throwable) {
            // Best effort, see the class comment.
        }
    }
}
