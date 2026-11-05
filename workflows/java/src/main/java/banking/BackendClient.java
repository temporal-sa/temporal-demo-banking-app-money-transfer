package banking;

import banking.Transfers.TransferInput;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.Map;

/** Pushes step updates and approvals to the API. Every call is best effort: a missed UI update shouldn't fail the Activity. */
public class BackendClient {
    private static final ObjectMapper JSON = new ObjectMapper();

    private final String baseUrl;
    // HTTP/1.1 because the default tries an HTTP/2 upgrade, and the API's server doesn't accept one.
    private final HttpClient http = HttpClient.newBuilder()
            .version(HttpClient.Version.HTTP_1_1)
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    public BackendClient(String baseUrl) {
        this.baseUrl = baseUrl == null ? "" : baseUrl.replaceAll("/$", "");
    }

    /** A step update for the browser. */
    public record Event(String step, String status, int attempt, int maxAttempts, String error, String detail) {
        static Event of(String step, String status) {
            return new Event(step, status, 1, 1, null, "");
        }

        Event attempt(int attempt, int maxAttempts) {
            return new Event(step, status, attempt, maxAttempts, error, detail);
        }

        Event error(String error) {
            return new Event(step, status, attempt, maxAttempts, error, detail);
        }

        Event detail(String detail) {
            return new Event(step, status, attempt, maxAttempts, error, detail);
        }
    }

    public void emit(String workflowId, Event event) {
        Map<String, Object> body = new HashMap<>();
        body.put("workflow_id", workflowId);
        body.put("step", event.step());
        body.put("status", event.status());
        body.put("attempt", event.attempt());
        body.put("max_attempts", event.maxAttempts());
        body.put("error", event.error());
        body.put("detail", event.detail());
        body.put("timestamp", OffsetDateTime.now().toString());
        send("POST", "/api/internal/events", body);
    }

    public void registerApproval(String workflowId, TransferInput input) {
        send("POST", "/api/internal/pending-approvals/" + workflowId, Map.of(
                "from_account", input.fromAccount(),
                "to_account", input.toAccount(),
                "amount", input.amount(),
                "created_at", OffsetDateTime.now().toString()));
    }

    public void removeApproval(String workflowId) {
        send("DELETE", "/api/internal/pending-approvals/" + workflowId, null);
    }

    private void send(String method, String path, Map<String, Object> body) {
        if (baseUrl.isEmpty()) {
            return;
        }
        try {
            HttpRequest.BodyPublisher publisher = body == null
                    ? HttpRequest.BodyPublishers.noBody()
                    : HttpRequest.BodyPublishers.ofString(JSON.writeValueAsString(body));
            HttpRequest request = HttpRequest.newBuilder(URI.create(baseUrl + path))
                    .timeout(Duration.ofSeconds(5))
                    .header("Content-Type", "application/json")
                    .method(method, publisher)
                    .build();
            http.send(request, HttpResponse.BodyHandlers.discarding());
        } catch (IOException e) {
            // Best effort, see the class comment.
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
