package gemini

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"strings"
	"time"
)

// Request is the Gemini-facing generation input (no dependency on parent ai package).
type Request struct {
	SystemPrompt string
	Messages     []Message
	MaxTokens    int
	Temperature  float32
}

// Message is a chat turn for Gemini.
type Message struct {
	Role    string
	Content string
}

// Usage token counts from Gemini.
type Usage struct {
	PromptTokens     int
	CompletionTokens int
	TotalTokens      int
}

// Response is normalized Gemini output.
type Response struct {
	Text      string
	Model     string
	Usage     Usage
	Latency   time.Duration
	Cached    bool
	RawFinish string
}

const defaultBaseURL = "https://generativelanguage.googleapis.com/v1beta"

// Client talks to Google Gemini generateContent / streamGenerateContent.
type Client struct {
	apiKey     string
	model      string
	baseURL    string
	httpClient *http.Client
	cache      *ResponseCache
	maxRetries int
}

// Config for constructing a Gemini client.
type Config struct {
	APIKey  string
	Model   string
	Timeout time.Duration
	BaseURL string
}

func NewClient(cfg Config) (*Client, error) {
	if strings.TrimSpace(cfg.APIKey) == "" {
		return nil, ErrNotConfigured
	}
	model := strings.TrimSpace(cfg.Model)
	if model == "" {
		model = "gemini-flash-latest"
	}
	timeout := cfg.Timeout
	if timeout <= 0 {
		timeout = 45 * time.Second
	}
	base := strings.TrimRight(cfg.BaseURL, "/")
	if base == "" {
		base = defaultBaseURL
	}
	return &Client{
		apiKey:  cfg.APIKey,
		model:   model,
		baseURL: base,
		httpClient: &http.Client{
			Timeout: timeout,
			Transport: &http.Transport{
				Proxy:                 http.ProxyFromEnvironment,
				DialContext:           (&net.Dialer{Timeout: 10 * time.Second}).DialContext,
				TLSHandshakeTimeout:   10 * time.Second,
				ResponseHeaderTimeout: timeout,
				IdleConnTimeout:       90 * time.Second,
				MaxIdleConns:          20,
			},
		},
		cache:      NewResponseCache(2 * time.Minute),
		maxRetries: 2,
	}, nil
}

func (c *Client) Name() string  { return "gemini" }
func (c *Client) Model() string { return c.model }

func (c *Client) Generate(ctx context.Context, req Request) (*Response, error) {
	start := time.Now()
	maxTok := req.MaxTokens
	if maxTok <= 0 {
		maxTok = 2048
	}
	temp := req.Temperature
	if temp <= 0 {
		temp = 0.4
	}

	msgKeys := make([]string, 0, len(req.Messages))
	for _, m := range req.Messages {
		msgKeys = append(msgKeys, m.Role+":"+m.Content)
	}
	key := cacheKey(c.model, req.SystemPrompt, msgKeys)
	if e, ok := c.cache.Get(key); ok {
		return &Response{
			Text: e.text, Model: e.model, Cached: true, Latency: time.Since(start),
			Usage: Usage{PromptTokens: e.promptTok, CompletionTokens: e.compTok, TotalTokens: e.promptTok + e.compTok},
		}, nil
	}

	body, err := c.buildRequest(req, maxTok, temp)
	if err != nil {
		return nil, err
	}

	var lastErr error
	for attempt := 0; attempt <= c.maxRetries; attempt++ {
		if attempt > 0 {
			backoff := time.Duration(1<<uint(attempt-1)) * 400 * time.Millisecond
			select {
			case <-ctx.Done():
				return nil, fmt.Errorf("%w: %v", ErrTimeout, ctx.Err())
			case <-time.After(backoff):
			}
		}
		resp, err := c.doGenerate(ctx, body)
		if err != nil {
			lastErr = err
			if !IsRetryable(err) {
				return nil, err
			}
			continue
		}
		c.cache.Set(key, resp.Text, resp.Model, resp.Usage.PromptTokens, resp.Usage.CompletionTokens)
		resp.Latency = time.Since(start)
		return resp, nil
	}
	return nil, lastErr
}

// Stream emits incremental deltas via official streamGenerateContent (SSE / alt=sse).
func (c *Client) Stream(ctx context.Context, req Request, emit func(delta, model string, done bool, usage Usage) error) error {
	maxTok := req.MaxTokens
	if maxTok <= 0 {
		maxTok = 2048
	}
	temp := req.Temperature
	if temp <= 0 {
		temp = 0.4
	}
	body, err := c.buildRequest(req, maxTok, temp)
	if err != nil {
		return err
	}

	url := fmt.Sprintf("%s/models/%s:streamGenerateContent?alt=sse", c.baseURL, c.model)
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("%w: %v", ErrNetwork, err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "text/event-stream")
	httpReq.Header.Set("X-goog-api-key", c.apiKey)

	// Streaming responses can exceed the client Timeout; use a transport-only client.
	streamClient := &http.Client{
		Timeout:   0,
		Transport: c.httpClient.Transport,
	}
	httpResp, err := streamClient.Do(httpReq)
	if err != nil {
		if ctx.Err() != nil || strings.Contains(strings.ToLower(err.Error()), "timeout") {
			return fmt.Errorf("%w: %v", ErrTimeout, err)
		}
		return fmt.Errorf("%w: %v", ErrNetwork, err)
	}
	defer httpResp.Body.Close()

	if httpResp.StatusCode >= 400 {
		raw, _ := io.ReadAll(io.LimitReader(httpResp.Body, 2<<20))
		var parsed generateContentResponse
		_ = json.Unmarshal(raw, &parsed)
		msg := truncate(string(raw), 200)
		if parsed.Error != nil && parsed.Error.DisplayMessage() != "" {
			msg = parsed.Error.DisplayMessage()
		}
		return classifyHTTP(httpResp.StatusCode, msg)
	}

	scanner := bufio.NewScanner(httpResp.Body)
	scanner.Buffer(make([]byte, 0, 64*1024), 2<<20)
	var usage Usage
	model := c.model
	gotDelta := false

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}
		if !strings.HasPrefix(line, "data:") {
			continue
		}
		payload := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
		if payload == "" || payload == "[DONE]" {
			continue
		}
		var parsed generateContentResponse
		if err := json.Unmarshal([]byte(payload), &parsed); err != nil {
			continue
		}
		if parsed.Error != nil {
			return classifyHTTP(httpResp.StatusCode, parsed.Error.DisplayMessage())
		}
		if parsed.UsageMetadata != nil {
			usage = Usage{
				PromptTokens:     parsed.UsageMetadata.PromptTokenCount,
				CompletionTokens: parsed.UsageMetadata.CandidatesTokenCount,
				TotalTokens:      parsed.UsageMetadata.TotalTokenCount,
			}
		}
		if len(parsed.Candidates) == 0 {
			continue
		}
		var b strings.Builder
		for _, p := range parsed.Candidates[0].Content.Parts {
			b.WriteString(p.Text)
		}
		delta := b.String()
		if delta == "" {
			continue
		}
		gotDelta = true
		if err := emit(delta, model, false, usage); err != nil {
			return err
		}
	}
	if err := scanner.Err(); err != nil && ctx.Err() == nil {
		if gotDelta {
			// Partial stream — still finalize what we have.
			return emit("", model, true, usage)
		}
		return fmt.Errorf("%w: %v", ErrNetwork, err)
	}
	if ctx.Err() != nil {
		return fmt.Errorf("%w: %v", ErrTimeout, ctx.Err())
	}
	if !gotDelta {
		return ErrEmptyResponse
	}
	return emit("", model, true, usage)
}

// TestConnection verifies the API key via models.list (lightweight) and optionally
// confirms the configured model exists. Falls back to a tiny generateContent call.
func (c *Client) TestConnection(ctx context.Context) error {
	models, err := c.ListGenerateModels(ctx)
	if err != nil {
		return err
	}
	if c.model != "" {
		found := false
		for _, m := range models {
			if m == c.model {
				found = true
				break
			}
		}
		if !found {
			// Model may still work if Google accepts aliases not fully listed — probe once.
			_, genErr := c.Generate(ctx, Request{
				Messages:  []Message{{Role: "user", Content: "Reply with OK"}},
				MaxTokens: 8,
			})
			if genErr != nil {
				return fmt.Errorf("%w: model %q not available (%v)", ErrInvalidModel, c.model, genErr)
			}
			return nil
		}
	}
	return nil
}

func (c *Client) buildRequest(req Request, maxTok int, temp float32) ([]byte, error) {
	contents := make([]content, 0, len(req.Messages))
	for _, m := range req.Messages {
		role := "user"
		switch strings.ToLower(m.Role) {
		case "assistant", "model":
			role = "model"
		case "user", "system":
			role = "user"
		}
		text := strings.TrimSpace(m.Content)
		if text == "" {
			continue
		}
		contents = append(contents, content{Role: role, Parts: []part{{Text: text}}})
	}
	if len(contents) == 0 {
		return nil, fmt.Errorf("%w: no user content", ErrEmptyResponse)
	}

	payload := generateContentRequest{
		Contents: contents,
		GenerationConfig: &generationConfig{
			Temperature:     temp,
			MaxOutputTokens: maxTok,
			TopP:            0.95,
		},
	}
	if sys := strings.TrimSpace(req.SystemPrompt); sys != "" {
		payload.SystemInstruction = &content{Parts: []part{{Text: sys}}}
	}
	return json.Marshal(payload)
}

func (c *Client) doGenerate(ctx context.Context, body []byte) (*Response, error) {
	url := fmt.Sprintf("%s/models/%s:generateContent", c.baseURL, c.model)
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrNetwork, err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("X-goog-api-key", c.apiKey)

	httpResp, err := c.httpClient.Do(httpReq)
	if err != nil {
		if ctx.Err() != nil || strings.Contains(strings.ToLower(err.Error()), "timeout") {
			return nil, fmt.Errorf("%w: %v", ErrTimeout, err)
		}
		return nil, fmt.Errorf("%w: %v", ErrNetwork, err)
	}
	defer httpResp.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(httpResp.Body, 2<<20))

	var parsed generateContentResponse
	if err := json.Unmarshal(raw, &parsed); err != nil {
		if httpResp.StatusCode >= 400 {
			return nil, classifyHTTP(httpResp.StatusCode, truncate(string(raw), 200))
		}
		return nil, fmt.Errorf("%w: %v", ErrMalformed, err)
	}
	if parsed.Error != nil {
		return nil, classifyHTTP(httpResp.StatusCode, parsed.Error.DisplayMessage())
	}
	if httpResp.StatusCode >= 400 {
		msg := truncate(string(raw), 200)
		if parsed.Error != nil {
			msg = parsed.Error.DisplayMessage()
		}
		return nil, classifyHTTP(httpResp.StatusCode, msg)
	}
	if len(parsed.Candidates) == 0 || len(parsed.Candidates[0].Content.Parts) == 0 {
		if len(parsed.Candidates) > 0 && parsed.Candidates[0].FinishReason != "" {
			return nil, fmt.Errorf("%w: finishReason=%s", ErrEmptyResponse, parsed.Candidates[0].FinishReason)
		}
		return nil, ErrEmptyResponse
	}
	var b strings.Builder
	for _, p := range parsed.Candidates[0].Content.Parts {
		b.WriteString(p.Text)
	}
	text := strings.TrimSpace(b.String())
	if text == "" {
		return nil, ErrEmptyResponse
	}
	usage := Usage{}
	if parsed.UsageMetadata != nil {
		usage.PromptTokens = parsed.UsageMetadata.PromptTokenCount
		usage.CompletionTokens = parsed.UsageMetadata.CandidatesTokenCount
		usage.TotalTokens = parsed.UsageMetadata.TotalTokenCount
	}
	return &Response{
		Text:      text,
		Model:     c.model,
		Usage:     usage,
		RawFinish: parsed.Candidates[0].FinishReason,
	}, nil
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}
