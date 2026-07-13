package handlers

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/JagtapAvadhut/smartca-backend/internal/app/services"
	apperrors "github.com/JagtapAvadhut/smartca-backend/internal/domain/errors"
	"github.com/JagtapAvadhut/smartca-backend/internal/domain/models"
	"github.com/JagtapAvadhut/smartca-backend/pkg/apiresponse"
)

// CRUDHandler is a thin generic collection handler.
type CRUDHandler struct {
	Svc            *services.CRUDService
	AllowDuplicate bool
}

func (h *CRUDHandler) List(w http.ResponseWriter, r *http.Request) {
	writeList(w, r, h.Svc.List(parseQuery(r)))
}

func (h *CRUDHandler) Get(w http.ResponseWriter, r *http.Request) {
	rec, err := h.Svc.Get(chi.URLParam(r, "id"))
	if err != nil {
		writeErr(w, r, err)
		return
	}
	apiresponse.OK(w, rid(r), rec)
}

func (h *CRUDHandler) Create(w http.ResponseWriter, r *http.Request) {
	var body models.Record
	if err := decodeJSON(r, &body); err != nil {
		writeErr(w, r, apperrors.BadRequest("invalid JSON body"))
		return
	}
	rec, err := h.Svc.Create(body)
	if err != nil {
		writeErr(w, r, err)
		return
	}
	apiresponse.Created(w, rid(r), rec)
}

func (h *CRUDHandler) Update(w http.ResponseWriter, r *http.Request) {
	var body models.Record
	if err := decodeJSON(r, &body); err != nil {
		writeErr(w, r, apperrors.BadRequest("invalid JSON body"))
		return
	}
	rec, err := h.Svc.Update(chi.URLParam(r, "id"), body)
	if err != nil {
		writeErr(w, r, err)
		return
	}
	apiresponse.OK(w, rid(r), rec)
}

func (h *CRUDHandler) Archive(w http.ResponseWriter, r *http.Request) {
	if err := h.Svc.Archive(chi.URLParam(r, "id")); err != nil {
		writeErr(w, r, err)
		return
	}
	apiresponse.OK(w, rid(r), map[string]string{"message": "archived"})
}

func (h *CRUDHandler) Restore(w http.ResponseWriter, r *http.Request) {
	if err := h.Svc.Restore(chi.URLParam(r, "id")); err != nil {
		writeErr(w, r, err)
		return
	}
	apiresponse.OK(w, rid(r), map[string]string{"message": "restored"})
}

func (h *CRUDHandler) PermanentDelete(w http.ResponseWriter, r *http.Request) {
	if err := h.Svc.PermanentDelete(chi.URLParam(r, "id")); err != nil {
		writeErr(w, r, err)
		return
	}
	apiresponse.OK(w, rid(r), map[string]string{"message": "deleted"})
}

func (h *CRUDHandler) Duplicate(w http.ResponseWriter, r *http.Request) {
	if !h.AllowDuplicate {
		writeErr(w, r, apperrors.BadRequest("duplicate not supported"))
		return
	}
	rec, err := h.Svc.Duplicate(chi.URLParam(r, "id"), nil)
	if err != nil {
		writeErr(w, r, err)
		return
	}
	apiresponse.Created(w, rid(r), rec)
}
