package ai

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strings"

	"github.com/JagtapAvadhut/smartca-backend/internal/ai/gemini"
	"github.com/JagtapAvadhut/smartca-backend/internal/ai/mockprovider"
	"github.com/JagtapAvadhut/smartca-backend/internal/ai/ollama"
	"github.com/JagtapAvadhut/smartca-backend/internal/ai/openai"
	"github.com/JagtapAvadhut/smartca-backend/internal/config"
)

func init() {
	newMock = func() Provider { return &mockAdapter{p: mockprovider.New()} }
}

// NewProviderFromConfig selects provider from environment (boot fallback).
// When GEMINI_API_KEY is set and AI_PROVIDER is empty/mock, Gemini is preferred
// so Docker/.env misconfiguration does not silently force Mock.
func NewProviderFromConfig(cfg config.Config) (Provider, error) {
	switch EffectiveEnvProvider(cfg) {
	case "mock":
		return &mockAdapter{p: mockprovider.New()}, nil
	case "openai":
		key := strings.TrimSpace(os.Getenv("OPENAI_API_KEY"))
		c, err := openai.NewClient(openai.Config{
			APIKey:  key,
			Model:   defaultStr(os.Getenv("OPENAI_MODEL"), "gpt-4o-mini"),
			Timeout: cfg.GeminiTimeout,
		})
		if err != nil {
			return nil, err
		}
		return &openaiAdapter{c: c}, nil
	case "ollama":
		c, err := ollama.NewClient(ollama.Config{
			BaseURL: defaultStr(os.Getenv("OLLAMA_BASE_URL"), "http://host.docker.internal:11434"),
			Model:   defaultStr(os.Getenv("OLLAMA_MODEL"), "llama3.2"),
			Timeout: cfg.GeminiTimeout,
		})
		if err != nil {
			return nil, err
		}
		return &ollamaAdapter{c: c}, nil
	case "gemini":
		model := strings.TrimSpace(cfg.GeminiModel)
		if model == "" {
			model = "gemini-flash-latest"
		}
		c, err := gemini.NewClient(gemini.Config{
			APIKey:  cfg.GeminiAPIKey,
			Model:   model,
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

// EffectiveEnvProvider resolves the boot provider from environment.
// A configured GEMINI_API_KEY upgrades empty/mock to gemini.
func EffectiveEnvProvider(cfg config.Config) string {
	p := strings.ToLower(strings.TrimSpace(cfg.AIProvider))
	if p == "" || p == "mock" {
		if strings.TrimSpace(cfg.GeminiAPIKey) != "" {
			return "gemini"
		}
		return "mock"
	}
	switch p {
	case "gemini", "openai", "ollama", "mock":
		return p
	default:
		return p
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

func (a *geminiAdapter) Stream(ctx context.Context, req GenerateRequest, emit func(StreamChunk) error) error {
	msgs := make([]gemini.Message, 0, len(req.Messages))
	for _, m := range req.Messages {
		msgs = append(msgs, gemini.Message{Role: m.Role, Content: m.Content})
	}
	err := a.c.Stream(ctx, gemini.Request{
		SystemPrompt: req.SystemPrompt,
		Messages:     msgs,
		MaxTokens:    req.MaxTokens,
		Temperature:  req.Temperature,
	}, func(delta, model string, done bool, usage gemini.Usage) error {
		return emit(StreamChunk{
			Delta: delta,
			Done:  done,
			Model: model,
			Usage: Usage{PromptTokens: usage.PromptTokens, CompletionTokens: usage.CompletionTokens, TotalTokens: usage.TotalTokens},
		})
	})
	if err != nil {
		// Graceful fallback if streaming endpoint is unavailable for a model.
		if errors.Is(err, gemini.ErrInvalidModel) || errors.Is(err, gemini.ErrEmptyResponse) {
			resp, gerr := a.Generate(ctx, req)
			if gerr != nil {
				return err
			}
			return chunkEmit(resp.Text, resp.Model, resp.Usage, emit)
		}
		return err
	}
	return nil
}

func (a *geminiAdapter) TestConnection(ctx context.Context) error {
	return a.c.TestConnection(ctx)
}

type openaiAdapter struct{ c *openai.Client }

func (a *openaiAdapter) Name() string { return a.c.Name() }

func (a *openaiAdapter) Generate(ctx context.Context, req GenerateRequest) (*GenerateResponse, error) {
	msgs := make([]openai.Message, 0, len(req.Messages))
	for _, m := range req.Messages {
		msgs = append(msgs, openai.Message{Role: m.Role, Content: m.Content})
	}
	resp, err := a.c.Generate(ctx, openai.Request{
		SystemPrompt: req.SystemPrompt,
		Messages:     msgs,
		MaxTokens:    req.MaxTokens,
		Temperature:  req.Temperature,
	})
	if err != nil {
		return nil, err
	}
	return &GenerateResponse{
		Text: resp.Text, Model: resp.Model, Latency: resp.Latency,
		Usage: Usage{PromptTokens: resp.Usage.PromptTokens, CompletionTokens: resp.Usage.CompletionTokens, TotalTokens: resp.Usage.TotalTokens},
	}, nil
}

func (a *openaiAdapter) Stream(ctx context.Context, req GenerateRequest, emit func(StreamChunk) error) error {
	msgs := make([]openai.Message, 0, len(req.Messages))
	for _, m := range req.Messages {
		msgs = append(msgs, openai.Message{Role: m.Role, Content: m.Content})
	}
	return a.c.Stream(ctx, openai.Request{
		SystemPrompt: req.SystemPrompt,
		Messages:     msgs,
		MaxTokens:    req.MaxTokens,
		Temperature:  req.Temperature,
	}, func(delta, model string, done bool, usage openai.Usage) error {
		return emit(StreamChunk{
			Delta: delta,
			Done:  done,
			Model: model,
			Usage: Usage{PromptTokens: usage.PromptTokens, CompletionTokens: usage.CompletionTokens, TotalTokens: usage.TotalTokens},
		})
	})
}

func (a *openaiAdapter) TestConnection(ctx context.Context) error {
	return a.c.TestConnection(ctx)
}

type ollamaAdapter struct{ c *ollama.Client }

func (a *ollamaAdapter) Name() string { return a.c.Name() }

func (a *ollamaAdapter) Generate(ctx context.Context, req GenerateRequest) (*GenerateResponse, error) {
	msgs := make([]ollama.Message, 0, len(req.Messages))
	for _, m := range req.Messages {
		msgs = append(msgs, ollama.Message{Role: m.Role, Content: m.Content})
	}
	resp, err := a.c.Generate(ctx, ollama.Request{
		SystemPrompt: req.SystemPrompt,
		Messages:     msgs,
		MaxTokens:    req.MaxTokens,
		Temperature:  req.Temperature,
	})
	if err != nil {
		return nil, err
	}
	return &GenerateResponse{
		Text: resp.Text, Model: resp.Model, Latency: resp.Latency,
		Usage: Usage{PromptTokens: resp.Usage.PromptTokens, CompletionTokens: resp.Usage.CompletionTokens, TotalTokens: resp.Usage.TotalTokens},
	}, nil
}

func (a *ollamaAdapter) Stream(ctx context.Context, req GenerateRequest, emit func(StreamChunk) error) error {
	msgs := make([]ollama.Message, 0, len(req.Messages))
	for _, m := range req.Messages {
		msgs = append(msgs, ollama.Message{Role: m.Role, Content: m.Content})
	}
	return a.c.Stream(ctx, ollama.Request{
		SystemPrompt: req.SystemPrompt,
		Messages:     msgs,
		MaxTokens:    req.MaxTokens,
		Temperature:  req.Temperature,
	}, func(delta, model string, done bool, usage ollama.Usage) error {
		return emit(StreamChunk{
			Delta: delta,
			Done:  done,
			Model: model,
			Usage: Usage{PromptTokens: usage.PromptTokens, CompletionTokens: usage.CompletionTokens, TotalTokens: usage.TotalTokens},
		})
	})
}

func (a *ollamaAdapter) TestConnection(ctx context.Context) error {
	return a.c.TestConnection(ctx)
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

func (a *mockAdapter) Stream(ctx context.Context, req GenerateRequest, emit func(StreamChunk) error) error {
	resp, err := a.Generate(ctx, req)
	if err != nil {
		return err
	}
	return chunkEmit(resp.Text, resp.Model, resp.Usage, emit)
}

func (a *mockAdapter) TestConnection(ctx context.Context) error {
	_, err := a.Generate(ctx, GenerateRequest{
		Messages:  []Message{{Role: "user", Content: "ping"}},
		MaxTokens: 8,
	})
	return err
}

func chunkEmit(text, model string, usage Usage, emit func(StreamChunk) error) error {
	runes := []rune(text)
	step := 12
	if len(runes) < 40 {
		step = 4
	}
	for i := 0; i < len(runes); i += step {
		end := i + step
		if end > len(runes) {
			end = len(runes)
		}
		if err := emit(StreamChunk{Delta: string(runes[i:end]), Model: model}); err != nil {
			return err
		}
	}
	return emit(StreamChunk{Done: true, Model: model, Usage: usage})
}
