package handlers

import (
	"net/http"
	"runtime"

	apperrors "github.com/JagtapAvadhut/smartca-backend/internal/domain/errors"
	"github.com/JagtapAvadhut/smartca-backend/internal/repository"
	"github.com/JagtapAvadhut/smartca-backend/pkg/apiresponse"
)

const Version = "1.0.0"

// HealthHandler serves liveness/readiness/version.
type HealthHandler struct {
	Store repository.Store
}

func (h *HealthHandler) Live(w http.ResponseWriter, r *http.Request) {
	apiresponse.OK(w, rid(r), map[string]string{"status": "live"})
}

func (h *HealthHandler) Ready(w http.ResponseWriter, r *http.Request) {
	if h.Store == nil {
		apiresponse.Fail(w, rid(r), apperrors.Internal("store not initialized", nil))
		return
	}
	_ = h.Store.Count("users", true)
	apiresponse.OK(w, rid(r), map[string]string{"status": "ready"})
}

func (h *HealthHandler) Version(w http.ResponseWriter, r *http.Request) {
	apiresponse.OK(w, rid(r), map[string]any{
		"version": Version,
		"go":      runtime.Version(),
	})
}
