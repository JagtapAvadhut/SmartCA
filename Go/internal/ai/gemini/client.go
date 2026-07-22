package gemini

import (
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

// Client talks to Google Gemini generateContent.
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
		model = "gemini-2.5-flash"
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

func (c *Client) Name() string { return "gemini" }

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
		return nil, classifyHTTP(httpResp.StatusCode, parsed.Error.Message)
	}
	if httpResp.StatusCode >= 400 {
		msg := truncate(string(raw), 200)
		if parsed.Error != nil {
			msg = parsed.Error.Message
		}
		return nil, classifyHTTP(httpResp.StatusCode, msg)
	}
	if len(parsed.Candidates) == 0 || len(parsed.Candidates[0].Content.Parts) == 0 {
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
