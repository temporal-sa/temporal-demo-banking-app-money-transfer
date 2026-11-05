using System.Net.Http.Json;

namespace Banking;

/// <summary>A step update for the browser.</summary>
public record StepEvent(string Step, string Status)
{
    public int Attempt { get; init; } = 1;

    public int MaxAttempts { get; init; } = 1;

    public string? Error { get; init; }

    public string Detail { get; init; } = string.Empty;
}

/// <summary>
/// Pushes step updates and approvals to the API. Every call is best effort: a
/// missed UI update shouldn't fail the Activity.
/// </summary>
public class BackendClient
{
    private readonly string baseUrl;
    private readonly HttpClient http = new() { Timeout = TimeSpan.FromSeconds(5) };

    public BackendClient(string? baseUrl) => this.baseUrl = (baseUrl ?? string.Empty).TrimEnd('/');

    public Task EmitAsync(string workflowId, StepEvent update) => SendAsync(HttpMethod.Post, "/api/internal/events", new
    {
        workflow_id = workflowId,
        step = update.Step,
        status = update.Status,
        attempt = update.Attempt,
        max_attempts = update.MaxAttempts,
        error = update.Error,
        detail = update.Detail,
        timestamp = DateTimeOffset.Now.ToString("O"),
    });

    public Task RegisterApprovalAsync(string workflowId, TransferInput input) =>
        SendAsync(HttpMethod.Post, $"/api/internal/pending-approvals/{workflowId}", new
        {
            from_account = input.FromAccount,
            to_account = input.ToAccount,
            amount = input.Amount,
            created_at = DateTimeOffset.Now.ToString("O"),
        });

    public Task RemoveApprovalAsync(string workflowId) =>
        SendAsync(HttpMethod.Delete, $"/api/internal/pending-approvals/{workflowId}", null);

    private async Task SendAsync(HttpMethod method, string path, object? body)
    {
        if (baseUrl.Length == 0)
        {
            return;
        }
        try
        {
            using var request = new HttpRequestMessage(method, baseUrl + path);
            if (body != null)
            {
                request.Content = JsonContent.Create(body, body.GetType());
            }
            using var response = await http.SendAsync(request);
        }
        catch (Exception e) when (e is HttpRequestException or TaskCanceledException)
        {
            // Best effort, see the class comment.
        }
    }
}
