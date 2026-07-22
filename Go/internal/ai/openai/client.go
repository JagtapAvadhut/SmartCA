package openai

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

const defaultBaseURL = "https://api.openai.com/v1"

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
	APIKey  string
	Model   string
	BaseURL string
	Timeout time.Duration
}

type Client struct {
	apiKey     string
	model      string
	baseURL    string
	httpClient *http.Client
}

func NewClient(cfg Config) (*Client, error) {
	if strings.TrimSpace(cfg.APIKey) == "" {
		return nil, ErrNotConfigured
	}
	model := strings.TrimSpace(cfg.Model)
	if model == "" {
		model = "gpt-4o-mini"
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
				Proxy:               http.ProxyFromEnvironment,
				DialContext:         (&net.Dialer{Timeout: 10 * time.Second}).DialContext,
				TLSHandshakeTimeout: 10 * time.Second,
				IdleConnTimeout:     90 * time.Second,
				MaxIdleConns:        20,
			},
		},
	}, nil
}

func (c *Client) Name() string { return "openai" }

func (c *Client) Generate(ctx context.Context, req Request) (*Response, error) {
	start := time.Now()
	body, err := c.buildBody(req, false)
	if err != nil {
		return nil, err
	}
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrNetwork, err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+c.apiKey)

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		if ctx.Err() != nil {
			return nil, ErrTimeout
		}
		return nil, fmt.Errorf("%w: %v", ErrNetwork, err)
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
	if resp.StatusCode >= 400 {
		return nil, classifyHTTP(resp.StatusCode, string(raw))
	}
	var parsed chatCompletionResponse
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return nil, fmt.Errorf("%w: %v", ErrMalformed, err)
	}
	text := ""
	if len(parsed.Choices) > 0 {
		text = parsed.Choices[0].Message.Content
	}
	if strings.TrimSpace(text) == "" {
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
			PromptTokens:     parsed.Usage.PromptTokens,
			CompletionTokens: parsed.Usage.CompletionTokens,
			TotalTokens:      parsed.Usage.TotalTokens,
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
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("%w: %v", ErrNetwork, err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+c.apiKey)
	httpReq.Header.Set("Accept", "text/event-stream")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		if ctx.Err() != nil {
			return ErrTimeout
		}
		return fmt.Errorf("%w: %v", ErrNetwork, err)
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
		line := scanner.Text()
		if !strings.HasPrefix(line, "data:") {
			continue
		}
		payload := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
		if payload == "[DONE]" {
			return emit("", model, true, usage)
		}
		var chunk streamChunk
		if err := json.Unmarshal([]byte(payload), &chunk); err != nil {
			continue
		}
		if chunk.Model != "" {
			model = chunk.Model
		}
		if chunk.Usage != nil {
			usage = Usage{
				PromptTokens:     chunk.Usage.PromptTokens,
				CompletionTokens: chunk.Usage.CompletionTokens,
				TotalTokens:      chunk.Usage.TotalTokens,
			}
		}
		delta := ""
		if len(chunk.Choices) > 0 {
			delta = chunk.Choices[0].Delta.Content
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
	_, err := c.Generate(ctx, Request{
		Messages:  []Message{{Role: "user", Content: "Reply with OK"}},
		MaxTokens: 8,
	})
	return err
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
	maxTok := req.MaxTokens
	if maxTok <= 0 {
		maxTok = 2048
	}
	temp := req.Temperature
	if temp <= 0 {
		temp = 0.4
	}
	payload := map[string]any{
		"model":       c.model,
		"messages":    msgs,
		"max_tokens":  maxTok,
		"temperature": temp,
		"stream":      stream,
	}
	if stream {
		payload["stream_options"] = map[string]any{"include_usage": true}
	}
	return json.Marshal(payload)
}

type chatCompletionResponse struct {
	Model   string `json:"model"`
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
	Usage struct {
		PromptTokens     int `json:"prompt_tokens"`
		CompletionTokens int `json:"completion_tokens"`
		TotalTokens      int `json:"total_tokens"`
	} `json:"usage"`
}

type streamChunk struct {
	Model   string `json:"model"`
	Choices []struct {
		Delta struct {
			Content string `json:"content"`
		} `json:"delta"`
	} `json:"choices"`
	Usage *struct {
		PromptTokens     int `json:"prompt_tokens"`
		CompletionTokens int `json:"completion_tokens"`
		TotalTokens      int `json:"total_tokens"`
	} `json:"usage"`
}
