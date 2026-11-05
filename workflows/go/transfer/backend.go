package transfer

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

// BackendClient pushes step updates and approvals to the API. Every call is
// best effort: a missed UI update shouldn't fail the Activity.
type BackendClient struct {
	baseURL string
	http    *http.Client
}

// NewBackendClient returns a client for the API. With no URL, calls do nothing.
func NewBackendClient(baseURL string) *BackendClient {
	return &BackendClient{
		baseURL: strings.TrimRight(baseURL, "/"),
		http:    &http.Client{Timeout: 5 * time.Second},
	}
}

// Event is a step update for the browser.
type Event struct {
	WorkflowID  string `json:"workflow_id"`
	Step        string `json:"step"`
	Status      string `json:"status"`
	Attempt     int    `json:"attempt"`
	MaxAttempts int    `json:"max_attempts"`
	Error       string `json:"error,omitempty"`
	Detail      string `json:"detail"`
	Timestamp   string `json:"timestamp"`
}

// Emit sends a step update.
func (b *BackendClient) Emit(workflowID string, event Event) {
	event.WorkflowID = workflowID
	event.Timestamp = time.Now().Format(time.RFC3339)
	if event.Attempt == 0 {
		event.Attempt = 1
	}
	if event.MaxAttempts == 0 {
		event.MaxAttempts = 1
	}
	b.send(http.MethodPost, "/api/internal/events", event)
}

// RegisterApproval adds a pending approval.
func (b *BackendClient) RegisterApproval(workflowID string, input Input) {
	b.send(http.MethodPost, "/api/internal/pending-approvals/"+workflowID, map[string]any{
		"from_account": input.FromAccount,
		"to_account":   input.ToAccount,
		"amount":       input.Amount,
		"created_at":   time.Now().Format(time.RFC3339),
	})
}

// RemoveApproval drops a pending approval.
func (b *BackendClient) RemoveApproval(workflowID string) {
	b.send(http.MethodDelete, "/api/internal/pending-approvals/"+workflowID, nil)
}

func (b *BackendClient) send(method, path string, body any) {
	if b.baseURL == "" {
		return
	}
	payload, err := json.Marshal(body)
	if err != nil {
		fmt.Println("Unable to encode a backend request:", err)
		return
	}
	request, err := http.NewRequest(method, b.baseURL+path, bytes.NewReader(payload))
	if err != nil {
		return
	}
	request.Header.Set("Content-Type", "application/json")
	response, err := b.http.Do(request)
	if err != nil {
		return
	}
	response.Body.Close()
}
