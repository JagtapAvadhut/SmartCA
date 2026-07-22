package handlers

import (
	"context"
	"net/http"
	"time"

	"github.com/JagtapAvadhut/smartca-backend/internal/ai"
	apperrors "github.com/JagtapAvadhut/smartca-backend/internal/domain/errors"
	"github.com/JagtapAvadhut/smartca-backend/pkg/apiresponse"
)

// AIHandler exposes Gemini-backed AI endpoints (keys never leave the server).
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
