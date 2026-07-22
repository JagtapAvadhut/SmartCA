package mockprovider

import (
	"context"
	"fmt"
	"strings"
	"time"
)

// Request mirrors the provider-agnostic generation input without importing ai.
type Request struct {
	SystemPrompt string
	Messages     []Message
	MaxTokens    int
	Temperature  float32
}

type Message struct {
	Role    string
	Content string
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
	Cached  bool
}

// Provider is a deterministic offline stub.
type Provider struct{}

func New() *Provider { return &Provider{} }

func (p *Provider) Name() string { return "mock" }

func (p *Provider) Generate(_ context.Context, req Request) (*Response, error) {
	start := time.Now()
	var last string
	for i := len(req.Messages) - 1; i >= 0; i-- {
		if strings.TrimSpace(req.Messages[i].Content) != "" {
			last = strings.TrimSpace(req.Messages[i].Content)
			break
		}
	}
	if last == "" {
		return nil, fmt.Errorf("mock: empty prompt")
	}
	reply := fmt.Sprintf("**(Mock AI)** Smart CA received your request.\n\n> %s\n\nConfigure `GEMINI_API_KEY` in `Go/.env` for live Gemini responses.", truncate(last, 280))
	return &Response{
		Text:  reply,
		Model: "mock",
		Usage: Usage{PromptTokens: len(last) / 4, CompletionTokens: len(reply) / 4, TotalTokens: (len(last) + len(reply)) / 4},
		Latency: time.Since(start),
	}, nil
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}
