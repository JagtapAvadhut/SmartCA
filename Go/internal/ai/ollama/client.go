package ollama

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

const defaultBaseURL = "http://host.docker.internal:11434"

type Message struct {
	Role    string
	Content string
}

type Request struct {
	SystemPrompt string
	Messages     []Message
	MaxTokens    int
	Temperature  float32
}

type Usage struct {
	PromptTokens     int
	CompletionTokens int
	TotalTokens      int
}

type Response struct {
	Text    string
	Model   string
	Usage   Usage
	Latency time.Duration
}

type Config struct {
	BaseURL string
	Model   string
	Timeout time.Duration
}

type Client struct {
	model      string
	baseURL    string
	httpClient *http.Client
}

func NewClient(cfg Config) (*Client, error) {
	base := strings.TrimRight(strings.TrimSpace(cfg.BaseURL), "/")
	if base == "" {
		base = defaultBaseURL
	}
	model := strings.TrimSpace(cfg.Model)
	if model == "" {
		model = "llama3.2"
	}
	timeout := cfg.Timeout
	if timeout <= 0 {
		timeout = 90 * time.Second
	}
	return &Client{
		model:   model,
		baseURL: base,
		httpClient: &http.Client{
			Timeout: timeout,
			Transport: &http.Transport{
				Proxy:               http.ProxyFromEnvironment,
				DialContext:         (&net.Dialer{Timeout: 10 * time.Second}).DialContext,
				TLSHandshakeTimeout: 10 * time.Second,
				IdleConnTimeout:     90 * time.Second,
				MaxIdleConns:        10,
			},
		},
	}, nil
}

func (c *Client) Name() string { return "ollama" }

func (c *Client) Generate(ctx context.Context, req Request) (*Response, error) {
	start := time.Now()
	body, err := c.buildBody(req, false)
	if err != nil {
		return nil, err
	}
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/api/chat", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrNetwork, err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		if ctx.Err() != nil {
			return nil, ErrTimeout
		}
		return nil, fmt.Errorf("%w: %v", ErrUnavailable, err)
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 8<<20))
	if resp.StatusCode >= 400 {
		return nil, classifyHTTP(resp.StatusCode, string(raw))
	}
	var parsed chatResponse
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return nil, fmt.Errorf("%w: %v", ErrMalformed, err)
	}
	text := strings.TrimSpace(parsed.Message.Content)
	if text == "" {
		return nil, ErrEmptyResponse
	}
	model := parsed.Model
	if model == "" {
		model = c.model
	}
	return &Response{
		Text:  text,
		Model: model,
		Usage: Usage{
			PromptTokens:     parsed.PromptEvalCount,
			CompletionTokens: parsed.EvalCount,
			TotalTokens:      parsed.PromptEvalCount + parsed.EvalCount,
		},
		Latency: time.Since(start),
	}, nil
}

type StreamEmit func(delta, model string, done bool, usage Usage) error

func (c *Client) Stream(ctx context.Context, req Request, emit StreamEmit) error {
	body, err := c.buildBody(req, true)
	if err != nil {
		return err
	}
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/api/chat", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("%w: %v", ErrNetwork, err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		if ctx.Err() != nil {
			return ErrTimeout
		}
		return fmt.Errorf("%w: %v", ErrUnavailable, err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		raw, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
		return classifyHTTP(resp.StatusCode, string(raw))
	}
	scanner := bufio.NewScanner(resp.Body)
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)
	model := c.model
	var usage Usage
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}
		var chunk chatResponse
		if err := json.Unmarshal([]byte(line), &chunk); err != nil {
			continue
		}
		if chunk.Model != "" {
			model = chunk.Model
		}
		delta := chunk.Message.Content
		if chunk.Done {
			usage = Usage{
				PromptTokens:     chunk.PromptEvalCount,
				CompletionTokens: chunk.EvalCount,
				TotalTokens:      chunk.PromptEvalCount + chunk.EvalCount,
			}
			if delta != "" {
				_ = emit(delta, model, false, usage)
			}
			return emit("", model, true, usage)
		}
		if delta != "" {
			if err := emit(delta, model, false, usage); err != nil {
				return err
			}
		}
	}
	if err := scanner.Err(); err != nil && ctx.Err() == nil {
		return fmt.Errorf("%w: %v", ErrNetwork, err)
	}
	return emit("", model, true, usage)
}

func (c *Client) TestConnection(ctx context.Context) error {
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+"/api/tags", nil)
	if err != nil {
		return fmt.Errorf("%w: %v", ErrNetwork, err)
	}
	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return fmt.Errorf("%w: %v", ErrUnavailable, err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		raw, _ := io.ReadAll(io.LimitReader(resp.Body, 64*1024))
		return classifyHTTP(resp.StatusCode, string(raw))
	}
	return nil
}

func (c *Client) buildBody(req Request, stream bool) ([]byte, error) {
	msgs := make([]map[string]string, 0, len(req.Messages)+1)
	if strings.TrimSpace(req.SystemPrompt) != "" {
		msgs = append(msgs, map[string]string{"role": "system", "content": req.SystemPrompt})
	}
	for _, m := range req.Messages {
		role := m.Role
		if role != "assistant" && role != "system" {
			role = "user"
		}
		msgs = append(msgs, map[string]string{"role": role, "content": m.Content})
	}
	temp := req.Temperature
	if temp <= 0 {
		temp = 0.4
	}
	opts := map[string]any{"temperature": temp}
	if req.MaxTokens > 0 {
		opts["num_predict"] = req.MaxTokens
	}
	payload := map[string]any{
		"model":    c.model,
		"messages": msgs,
		"stream":   stream,
		"options":  opts,
	}
	return json.Marshal(payload)
}

type chatResponse struct {
	Model   string `json:"model"`
	Message struct {
		Content string `json:"content"`
	} `json:"message"`
	Done            bool `json:"done"`
	PromptEvalCount int  `json:"prompt_eval_count"`
	EvalCount       int  `json:"eval_count"`
}
