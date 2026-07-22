package ai

import (
	"context"
	"time"
)

// Message is a single chat turn. Role is "user", "assistant", or "system".
type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// GenerateRequest is provider-agnostic generation input.
type GenerateRequest struct {
	SystemPrompt string
	Messages     []Message
	MaxTokens    int
	Temperature  float32
}

// Usage reports token consumption when the provider supplies it.
type Usage struct {
	PromptTokens     int `json:"promptTokens"`
	CompletionTokens int `json:"completionTokens"`
	TotalTokens      int `json:"totalTokens"`
}

// GenerateResponse is the normalized provider output.
type GenerateResponse struct {
	Text      string
	Model     string
	Usage     Usage
	Latency   time.Duration
	Cached    bool
	RawFinish string
}

// StreamChunk is one incremental piece of a streamed reply.
type StreamChunk struct {
	Delta string
	Done  bool
	Model string
	Usage Usage
}

// Provider abstracts LLM backends (Gemini, OpenAI, Ollama, Mock, …).
type Provider interface {
	Name() string
	Generate(ctx context.Context, req GenerateRequest) (*GenerateResponse, error)
}

// Streamer is an optional capability for token/chunk streaming.
type Streamer interface {
	Provider
	Stream(ctx context.Context, req GenerateRequest, emit func(StreamChunk) error) error
}

// ConnectionTester verifies credentials / reachability.
type ConnectionTester interface {
	TestConnection(ctx context.Context) error
}
