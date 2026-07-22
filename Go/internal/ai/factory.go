package ai

import (
	"context"
	"fmt"
	"strings"

	"github.com/JagtapAvadhut/smartca-backend/internal/ai/gemini"
	"github.com/JagtapAvadhut/smartca-backend/internal/ai/mockprovider"
	"github.com/JagtapAvadhut/smartca-backend/internal/config"
)

func init() {
	newMock = func() Provider { return &mockAdapter{p: mockprovider.New()} }
}

// NewProviderFromConfig selects gemini | mock (extensible for openai/claude/azure/ollama).
func NewProviderFromConfig(cfg config.Config) (Provider, error) {
	switch strings.ToLower(cfg.AIProvider) {
	case "mock":
		return &mockAdapter{p: mockprovider.New()}, nil
	case "openai", "claude", "azure", "azure_openai", "ollama":
		return nil, fmt.Errorf("AI provider %q is not implemented yet; use gemini or mock", cfg.AIProvider)
	case "gemini", "":
		c, err := gemini.NewClient(gemini.Config{
			APIKey:  cfg.GeminiAPIKey,
			Model:   cfg.GeminiModel,
			Timeout: cfg.GeminiTimeout,
		})
		if err != nil {
			return nil, err
		}
		return &geminiAdapter{c: c}, nil
	default:
		return nil, fmt.Errorf("unknown AI_PROVIDER %q", cfg.AIProvider)
	}
}

type geminiAdapter struct{ c *gemini.Client }

func (a *geminiAdapter) Name() string { return a.c.Name() }

func (a *geminiAdapter) Generate(ctx context.Context, req GenerateRequest) (*GenerateResponse, error) {
	msgs := make([]gemini.Message, 0, len(req.Messages))
	for _, m := range req.Messages {
		msgs = append(msgs, gemini.Message{Role: m.Role, Content: m.Content})
	}
	resp, err := a.c.Generate(ctx, gemini.Request{
		SystemPrompt: req.SystemPrompt,
		Messages:     msgs,
		MaxTokens:    req.MaxTokens,
		Temperature:  req.Temperature,
	})
	if err != nil {
		return nil, err
	}
	return &GenerateResponse{
		Text: resp.Text, Model: resp.Model, Cached: resp.Cached, Latency: resp.Latency, RawFinish: resp.RawFinish,
		Usage: Usage{PromptTokens: resp.Usage.PromptTokens, CompletionTokens: resp.Usage.CompletionTokens, TotalTokens: resp.Usage.TotalTokens},
	}, nil
}

type mockAdapter struct{ p *mockprovider.Provider }

func (a *mockAdapter) Name() string { return a.p.Name() }

func (a *mockAdapter) Generate(ctx context.Context, req GenerateRequest) (*GenerateResponse, error) {
	msgs := make([]mockprovider.Message, 0, len(req.Messages))
	for _, m := range req.Messages {
		msgs = append(msgs, mockprovider.Message{Role: m.Role, Content: m.Content})
	}
	resp, err := a.p.Generate(ctx, mockprovider.Request{
		SystemPrompt: req.SystemPrompt,
		Messages:     msgs,
		MaxTokens:    req.MaxTokens,
		Temperature:  req.Temperature,
	})
	if err != nil {
		return nil, err
	}
	return &GenerateResponse{
		Text: resp.Text, Model: resp.Model, Cached: resp.Cached, Latency: resp.Latency,
		Usage: Usage{PromptTokens: resp.Usage.PromptTokens, CompletionTokens: resp.Usage.CompletionTokens, TotalTokens: resp.Usage.TotalTokens},
	}, nil
}
