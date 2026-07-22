package ai

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/JagtapAvadhut/smartca-backend/internal/ai/gemini"
	"github.com/JagtapAvadhut/smartca-backend/internal/config"
	apperrors "github.com/JagtapAvadhut/smartca-backend/internal/domain/errors"
	"github.com/JagtapAvadhut/smartca-backend/internal/repository"
)

// Result is the API-facing AI response envelope.
type Result struct {
	Reply       string         `json:"reply"`
	Markdown    string         `json:"markdown"`
	JSON        map[string]any `json:"json,omitempty"`
	Model       string         `json:"model"`
	Provider    string         `json:"provider"`
	Usage       Usage          `json:"usage"`
	LatencyMs   int64          `json:"latencyMs"`
	Cached      bool           `json:"cached"`
	Template    string         `json:"template"`
	Suggestions []string       `json:"suggestions,omitempty"`
}

// ChatInput is the chat endpoint body.
type ChatInput struct {
	Message   string    `json:"message"`
	History   []Message `json:"history"`
	ClientID  string    `json:"clientId"`
	MaxTokens int       `json:"maxTokens"`
}

// SummarizeInput summarizes free text.
type SummarizeInput struct {
	Text      string `json:"text"`
	MaxTokens int    `json:"maxTokens"`
}

// EmailInput drafts a professional email.
type EmailInput struct {
	Purpose   string `json:"purpose"`
	ClientID  string `json:"clientId"`
	Tone      string `json:"tone"`
	Details   string `json:"details"`
	MaxTokens int    `json:"maxTokens"`
}

// ClientSummaryInput summarizes a client dossier.
type ClientSummaryInput struct {
	ClientID  string `json:"clientId"`
	Question  string `json:"question"`
	MaxTokens int    `json:"maxTokens"`
}

// DocumentAnalysisInput analyzes a document record.
type DocumentAnalysisInput struct {
	DocumentID string `json:"documentId"`
	Excerpt    string `json:"excerpt"`
	Question   string `json:"question"`
	MaxTokens  int    `json:"maxTokens"`
}

// DashboardInsightsInput generates KPI narrative.
type DashboardInsightsInput struct {
	Focus     string `json:"focus"`
	MaxTokens int    `json:"maxTokens"`
}

// Service orchestrates prompts, context, and providers.
type Service struct {
	Provider Provider
	Ctx      *ContextBuilder
	Log      *slog.Logger
	Cfg      config.Config
}

func NewService(cfg config.Config, store repository.Store, log *slog.Logger, provider Provider) *Service {
	if log == nil {
		log = slog.Default()
	}
	return &Service{
		Provider: provider,
		Ctx:      NewContextBuilder(store),
		Log:      log,
		Cfg:      cfg,
	}
}

func (s *Service) defaultMaxTokens(n int) int {
	if n > 0 {
		if n > 8192 {
			return 8192
		}
		return n
	}
	if s.Cfg.GeminiMaxTokens > 0 {
		return s.Cfg.GeminiMaxTokens
	}
	return 2048
}

func (s *Service) Chat(ctx context.Context, requestID string, in ChatInput) (*Result, error) {
	msg := strings.TrimSpace(in.Message)
	if msg == "" {
		return nil, apperrors.Validation("message is required")
	}
	hist := LimitHistory(in.History, 8)
	var messages []Message
	for _, h := range hist {
		role := strings.ToLower(h.Role)
		if role == "assistant" {
			role = "assistant"
		} else {
			role = "user"
		}
		content := strings.TrimSpace(h.Content)
		if content == "" {
			continue
		}
		messages = append(messages, Message{Role: role, Content: trimRunes(content, 1500)})
	}
	ctxBlock := s.Ctx.PracticeSnippet()
	if in.ClientID != "" {
		if brief := s.Ctx.ClientBrief(in.ClientID); brief != "" {
			ctxBlock = brief
		}
	}
	user := CompactUserPrompt("Answer as Smart CA AI.", ctxBlock, msg)
	messages = append(messages, Message{Role: "user", Content: user})
	return s.run(ctx, requestID, TplChat, BuildSystemPrompt(TplChat), messages, in.MaxTokens, true)
}

func (s *Service) Summarize(ctx context.Context, requestID string, in SummarizeInput) (*Result, error) {
	text := strings.TrimSpace(in.Text)
	if text == "" {
		return nil, apperrors.Validation("text is required")
	}
	user := CompactUserPrompt("Summarize for CA staff. Return JSON only.", "", text)
	return s.run(ctx, requestID, TplSummarize, BuildSystemPrompt(TplSummarize), []Message{{Role: "user", Content: user}}, in.MaxTokens, false)
}

func (s *Service) Email(ctx context.Context, requestID string, in EmailInput) (*Result, error) {
	purpose := strings.TrimSpace(in.Purpose)
	if purpose == "" {
		purpose = strings.TrimSpace(in.Details)
	}
	if purpose == "" {
		return nil, apperrors.Validation("purpose or details is required")
	}
	ctxBlock := ""
	if in.ClientID != "" {
		ctxBlock = s.Ctx.ClientBrief(in.ClientID)
	}
	req := fmt.Sprintf("Purpose: %s\nTone: %s\nDetails: %s", purpose, defaultStr(in.Tone, "professional"), in.Details)
	user := CompactUserPrompt("Draft professional email. Return JSON only.", ctxBlock, req)
	return s.run(ctx, requestID, TplEmail, BuildSystemPrompt(TplEmail), []Message{{Role: "user", Content: user}}, in.MaxTokens, false)
}

func (s *Service) ClientSummary(ctx context.Context, requestID string, in ClientSummaryInput) (*Result, error) {
	if strings.TrimSpace(in.ClientID) == "" {
		return nil, apperrors.Validation("clientId is required")
	}
	brief := s.Ctx.ClientBrief(in.ClientID)
	if brief == "" {
		return nil, apperrors.NotFound("client not found")
	}
	q := defaultStr(in.Question, "Summarize this client for the engagement partner.")
	user := CompactUserPrompt("Produce client summary JSON.", brief, q)
	return s.run(ctx, requestID, TplClientSummary, BuildSystemPrompt(TplClientSummary), []Message{{Role: "user", Content: user}}, in.MaxTokens, false)
}

func (s *Service) DocumentAnalysis(ctx context.Context, requestID string, in DocumentAnalysisInput) (*Result, error) {
	ctxBlock := ""
	if in.DocumentID != "" {
		ctxBlock = s.Ctx.DocumentBrief(in.DocumentID)
		if ctxBlock == "" {
			return nil, apperrors.NotFound("document not found")
		}
	}
	excerpt := strings.TrimSpace(in.Excerpt)
	q := strings.TrimSpace(in.Question)
	if ctxBlock == "" && excerpt == "" {
		return nil, apperrors.Validation("documentId or excerpt is required")
	}
	req := q
	if excerpt != "" {
		req = "Excerpt:\n" + trimRunes(excerpt, 3500) + "\n\nQuestion: " + defaultStr(q, "Analyze this document.")
	}
	user := CompactUserPrompt("Analyze document. Return JSON only.", ctxBlock, req)
	return s.run(ctx, requestID, TplDocumentAnalysis, BuildSystemPrompt(TplDocumentAnalysis), []Message{{Role: "user", Content: user}}, in.MaxTokens, false)
}

func (s *Service) DashboardInsights(ctx context.Context, requestID string, in DashboardInsightsInput) (*Result, error) {
	brief := s.Ctx.DashboardBrief()
	focus := defaultStr(in.Focus, "Highlight risks, cash collection, and compliance priorities.")
	user := CompactUserPrompt("Generate dashboard insights JSON.", brief, focus)
	return s.run(ctx, requestID, TplDashboardInsights, BuildSystemPrompt(TplDashboardInsights), []Message{{Role: "user", Content: user}}, in.MaxTokens, false)
}

func (s *Service) run(ctx context.Context, requestID, template, system string, messages []Message, maxTokens int, markdown bool) (*Result, error) {
	if s.Provider == nil {
		return nil, apperrors.Internal("AI provider not configured", gemini.ErrNotConfigured)
	}
	start := time.Now()
	resp, err := s.Provider.Generate(ctx, GenerateRequest{
		SystemPrompt: system,
		Messages:     messages,
		MaxTokens:    s.defaultMaxTokens(maxTokens),
		Temperature:  0.4,
	})
	latency := time.Since(start)
	if err != nil {
		s.Log.Warn("ai.generate.failed",
			"requestId", requestID,
			"template", template,
			"provider", s.Provider.Name(),
			"latencyMs", latency.Milliseconds(),
			"err", sanitizeErr(err),
		)
		return nil, mapProviderError(err)
	}
	s.Log.Info("ai.generate.ok",
		"requestId", requestID,
		"template", template,
		"provider", s.Provider.Name(),
		"model", resp.Model,
		"latencyMs", resp.Latency.Milliseconds(),
		"cached", resp.Cached,
		"promptTokens", resp.Usage.PromptTokens,
		"completionTokens", resp.Usage.CompletionTokens,
		"totalTokens", resp.Usage.TotalTokens,
	)

	text := strings.TrimSpace(resp.Text)
	out := &Result{
		Reply:     text,
		Markdown:  text,
		Model:     resp.Model,
		Provider:  s.Provider.Name(),
		Usage:     resp.Usage,
		LatencyMs: resp.Latency.Milliseconds(),
		Cached:    resp.Cached,
		Template:  template,
	}
	if !markdown {
		if obj := tryParseJSONObject(text); obj != nil {
			out.JSON = obj
			// Prefer human-readable reply from common fields
			if n, ok := obj["narrative"].(string); ok && n != "" {
				out.Reply = n
				out.Markdown = n
			} else if s, ok := obj["summary"].(string); ok && s != "" {
				out.Reply = s
				out.Markdown = s
			} else if body, ok := obj["body"].(string); ok && body != "" {
				subj, _ := obj["subject"].(string)
				out.Reply = strings.TrimSpace(subj + "\n\n" + body)
				out.Markdown = out.Reply
			}
		}
	}
	if template == TplChat {
		out.Suggestions = []string{
			"Explain GST in simple English",
			"Summarize overdue invoices",
			"Draft a payment reminder email",
		}
	}
	return out, nil
}

func mapProviderError(err error) error {
	switch {
	case errors.Is(err, gemini.ErrNotConfigured):
		return apperrors.New(apperrors.CodeInternal, 503, "Gemini API key not configured on server")
	case errors.Is(err, gemini.ErrInvalidAPIKey):
		return apperrors.New(apperrors.CodeUnauthorized, 401, "Gemini API key is invalid")
	case errors.Is(err, gemini.ErrRateLimited):
		return apperrors.New(apperrors.CodeBadRequest, 429, "Gemini rate limit exceeded; retry shortly")
	case errors.Is(err, gemini.ErrTimeout):
		return apperrors.New(apperrors.CodeInternal, 504, "Gemini request timed out")
	case errors.Is(err, gemini.ErrEmptyResponse):
		return apperrors.Internal("Gemini returned an empty response", err)
	case errors.Is(err, gemini.ErrNetwork):
		return apperrors.Internal("Unable to reach Gemini API", err)
	case errors.Is(err, gemini.ErrMalformed):
		return apperrors.Internal("Malformed Gemini response", err)
	default:
		var apiErr *gemini.APIError
		if errors.As(err, &apiErr) {
			msg := apiErr.Message
			if msg == "" {
				msg = "Gemini API error"
			}
			if apiErr.Status == 429 || strings.Contains(strings.ToLower(msg), "quota") {
				return apperrors.New(apperrors.CodeBadRequest, 429, "Gemini rate limit exceeded; retry shortly")
			}
			return apperrors.Internal(trimRunes(msg, 180), err)
		}
		return apperrors.Internal("AI generation failed", err)
	}
}

func sanitizeErr(err error) string {
	if err == nil {
		return ""
	}
	msg := err.Error()
	// Never echo key material if somehow present
	if strings.Contains(strings.ToLower(msg), "api key") || strings.Contains(msg, "AIza") || strings.Contains(msg, "AQ.") {
		return "provider_error"
	}
	return trimRunes(msg, 200)
}

func tryParseJSONObject(text string) map[string]any {
	text = strings.TrimSpace(text)
	if text == "" {
		return nil
	}
	// Strip markdown fences
	if strings.HasPrefix(text, "```") {
		text = strings.TrimPrefix(text, "```json")
		text = strings.TrimPrefix(text, "```JSON")
		text = strings.TrimPrefix(text, "```")
		if i := strings.LastIndex(text, "```"); i >= 0 {
			text = text[:i]
		}
		text = strings.TrimSpace(text)
	}
	start := strings.Index(text, "{")
	end := strings.LastIndex(text, "}")
	if start < 0 || end <= start {
		return nil
	}
	var m map[string]any
	if err := json.Unmarshal([]byte(text[start:end+1]), &m); err != nil {
		return nil
	}
	return m
}

func defaultStr(v, d string) string {
	if strings.TrimSpace(v) == "" {
		return d
	}
	return strings.TrimSpace(v)
}

// newMock is set by factory.go init to avoid circular imports in tests.
var newMock = func() Provider {
	return &stubMock{}
}

type stubMock struct{}

func (stubMock) Name() string { return "mock" }
func (stubMock) Generate(_ context.Context, req GenerateRequest) (*GenerateResponse, error) {
	var last string
	for i := len(req.Messages) - 1; i >= 0; i-- {
		if strings.TrimSpace(req.Messages[i].Content) != "" {
			last = strings.TrimSpace(req.Messages[i].Content)
			break
		}
	}
	return &GenerateResponse{
		Text:  "**(Mock AI)** Configure GEMINI_API_KEY for live answers.\n\n" + trimRunes(last, 200),
		Model: "mock",
		Usage: Usage{TotalTokens: 10},
	}, nil
}
