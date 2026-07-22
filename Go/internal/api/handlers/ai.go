package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/JagtapAvadhut/smartca-backend/internal/ai"
	apperrors "github.com/JagtapAvadhut/smartca-backend/internal/domain/errors"
	"github.com/JagtapAvadhut/smartca-backend/pkg/apiresponse"
)

// AIHandler exposes multi-provider AI endpoints (keys never leave the server).
type AIHandler struct {
	Svc *ai.Service
}

func (h *AIHandler) withTimeout(r *http.Request) (context.Context, context.CancelFunc) {
	timeout := 50 * time.Second
	if h.Svc != nil && h.Svc.Cfg.GeminiTimeout > 0 {
		timeout = h.Svc.Cfg.GeminiTimeout + 5*time.Second
	}
	return context.WithTimeout(r.Context(), timeout)
}

func (h *AIHandler) Chat(w http.ResponseWriter, r *http.Request) {
	var in ai.ChatInput
	if err := decodeJSON(r, &in); err != nil {
		apiresponse.Fail(w, rid(r), apperrors.Validation("invalid JSON body"))
		return
	}
	ctx, cancel := h.withTimeout(r)
	defer cancel()
	out, err := h.Svc.Chat(ctx, rid(r), in)
	if err != nil {
		apiresponse.Fail(w, rid(r), err)
		return
	}
	apiresponse.OK(w, rid(r), out)
}

// ChatStream streams SSE events: data: {"delta":"..."} then data: {"done":true,...}.
func (h *AIHandler) ChatStream(w http.ResponseWriter, r *http.Request) {
	var in ai.ChatInput
	if err := decodeJSON(r, &in); err != nil {
		apiresponse.Fail(w, rid(r), apperrors.Validation("invalid JSON body"))
		return
	}
	flusher, ok := w.(http.Flusher)
	if !ok {
		apiresponse.Fail(w, rid(r), apperrors.Internal("streaming not supported", nil))
		return
	}
	ctx, cancel := h.withTimeout(r)
	defer cancel()

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")
	w.WriteHeader(http.StatusOK)
	flusher.Flush()

	_, err := h.Svc.ChatStream(ctx, rid(r), in, func(ch ai.StreamChunk) error {
		payload := map[string]any{
			"delta": ch.Delta,
			"done":  ch.Done,
			"model": ch.Model,
		}
		if ch.Done {
			payload["usage"] = ch.Usage
		}
		b, _ := json.Marshal(payload)
		if _, err := fmt.Fprintf(w, "data: %s\n\n", b); err != nil {
			return err
		}
		flusher.Flush()
		return nil
	})
	if err != nil {
		msg := "AI stream failed"
		var ae *apperrors.AppError
		if errors.As(err, &ae) && ae.Message != "" {
			msg = ae.Message
		} else if err != nil {
			msg = err.Error()
		}
		lower := strings.ToLower(msg)
		if strings.Contains(lower, "aiza") || strings.Contains(msg, "AQ.") || strings.Contains(msg, "sk-") {
			msg = "AI stream failed"
		}
		b, _ := json.Marshal(map[string]any{"error": msg, "done": true})
		_, _ = fmt.Fprintf(w, "data: %s\n\n", b)
		flusher.Flush()
	}
}

func (h *AIHandler) GetSettings(w http.ResponseWriter, r *http.Request) {
	if h.Svc == nil || h.Svc.Runtime == nil {
		apiresponse.OK(w, rid(r), ai.PublicSettings{
			Provider:  "mock",
			Model:     "mock",
			Available: ai.AvailableProviders(),
			Models:    ai.SuggestedModels(),
		})
		return
	}
	apiresponse.OK(w, rid(r), h.Svc.Runtime.GetSettings())
}

func (h *AIHandler) SaveSettings(w http.ResponseWriter, r *http.Request) {
	if h.Svc == nil || h.Svc.Runtime == nil {
		apiresponse.Fail(w, rid(r), apperrors.Internal("AI runtime unavailable", nil))
		return
	}
	var in ai.SaveSettingsInput
	if err := decodeJSON(r, &in); err != nil {
		apiresponse.Fail(w, rid(r), apperrors.Validation("invalid JSON body"))
		return
	}
	out, err := h.Svc.Runtime.SaveSettings(in)
	if err != nil {
		apiresponse.Fail(w, rid(r), err)
		return
	}
	apiresponse.OK(w, rid(r), out)
}

func (h *AIHandler) RemoveSettings(w http.ResponseWriter, r *http.Request) {
	if h.Svc == nil || h.Svc.Runtime == nil {
		apiresponse.Fail(w, rid(r), apperrors.Internal("AI runtime unavailable", nil))
		return
	}
	out, err := h.Svc.Runtime.RemoveSettings()
	if err != nil {
		apiresponse.Fail(w, rid(r), err)
		return
	}
	apiresponse.OK(w, rid(r), out)
}

func (h *AIHandler) TestSettings(w http.ResponseWriter, r *http.Request) {
	if h.Svc == nil || h.Svc.Runtime == nil {
		apiresponse.Fail(w, rid(r), apperrors.Internal("AI runtime unavailable", nil))
		return
	}
	var in ai.TestSettingsInput
	if err := decodeJSON(r, &in); err != nil {
		apiresponse.Fail(w, rid(r), apperrors.Validation("invalid JSON body"))
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 25*time.Second)
	defer cancel()
	out, err := h.Svc.Runtime.TestConnection(ctx, in)
	if out == nil {
		apiresponse.Fail(w, rid(r), err)
		return
	}
	// Always return the structured TestResult so the UI can show Connected / detailed failure.
	apiresponse.OK(w, rid(r), out)
}

func (h *AIHandler) Summarize(w http.ResponseWriter, r *http.Request) {
	var in ai.SummarizeInput
	if err := decodeJSON(r, &in); err != nil {
		apiresponse.Fail(w, rid(r), apperrors.Validation("invalid JSON body"))
		return
	}
	ctx, cancel := h.withTimeout(r)
	defer cancel()
	out, err := h.Svc.Summarize(ctx, rid(r), in)
	if err != nil {
		apiresponse.Fail(w, rid(r), err)
		return
	}
	apiresponse.OK(w, rid(r), out)
}

func (h *AIHandler) Email(w http.ResponseWriter, r *http.Request) {
	var in ai.EmailInput
	if err := decodeJSON(r, &in); err != nil {
		apiresponse.Fail(w, rid(r), apperrors.Validation("invalid JSON body"))
		return
	}
	ctx, cancel := h.withTimeout(r)
	defer cancel()
	out, err := h.Svc.Email(ctx, rid(r), in)
	if err != nil {
		apiresponse.Fail(w, rid(r), err)
		return
	}
	apiresponse.OK(w, rid(r), out)
}

func (h *AIHandler) ClientSummary(w http.ResponseWriter, r *http.Request) {
	var in ai.ClientSummaryInput
	if err := decodeJSON(r, &in); err != nil {
		apiresponse.Fail(w, rid(r), apperrors.Validation("invalid JSON body"))
		return
	}
	ctx, cancel := h.withTimeout(r)
	defer cancel()
	out, err := h.Svc.ClientSummary(ctx, rid(r), in)
	if err != nil {
		apiresponse.Fail(w, rid(r), err)
		return
	}
	apiresponse.OK(w, rid(r), out)
}

func (h *AIHandler) DocumentAnalysis(w http.ResponseWriter, r *http.Request) {
	var in ai.DocumentAnalysisInput
	if err := decodeJSON(r, &in); err != nil {
		apiresponse.Fail(w, rid(r), apperrors.Validation("invalid JSON body"))
		return
	}
	ctx, cancel := h.withTimeout(r)
	defer cancel()
	out, err := h.Svc.DocumentAnalysis(ctx, rid(r), in)
	if err != nil {
		apiresponse.Fail(w, rid(r), err)
		return
	}
	apiresponse.OK(w, rid(r), out)
}

func (h *AIHandler) DashboardInsights(w http.ResponseWriter, r *http.Request) {
	var in ai.DashboardInsightsInput
	if err := decodeJSON(r, &in); err != nil {
		apiresponse.Fail(w, rid(r), apperrors.Validation("invalid JSON body"))
		return
	}
	ctx, cancel := h.withTimeout(r)
	defer cancel()
	out, err := h.Svc.DashboardInsights(ctx, rid(r), in)
	if err != nil {
		apiresponse.Fail(w, rid(r), err)
		return
	}
	apiresponse.OK(w, rid(r), out)
}
