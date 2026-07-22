package handlers

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/JagtapAvadhut/smartca-backend/internal/app/services"
	apperrors "github.com/JagtapAvadhut/smartca-backend/internal/domain/errors"
	"github.com/JagtapAvadhut/smartca-backend/internal/domain/models"
	"github.com/JagtapAvadhut/smartca-backend/pkg/apiresponse"
)

// InvoiceHandler handles invoice endpoints.
type InvoiceHandler struct {
	Svc *services.InvoiceService
}

func (h *InvoiceHandler) List(w http.ResponseWriter, r *http.Request) {
	writeList(w, r, h.Svc.List(parseQuery(r)))
}

func (h *InvoiceHandler) Get(w http.ResponseWriter, r *http.Request) {
	rec, err := h.Svc.Get(chi.URLParam(r, "id"))
	if err != nil {
		writeErr(w, r, err)
		return
	}
	apiresponse.OK(w, rid(r), rec)
}

func (h *InvoiceHandler) Create(w http.ResponseWriter, r *http.Request) {
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

func (h *InvoiceHandler) Update(w http.ResponseWriter, r *http.Request) {
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

func (h *InvoiceHandler) Archive(w http.ResponseWriter, r *http.Request) {
	if err := h.Svc.Archive(chi.URLParam(r, "id")); err != nil {
		writeErr(w, r, err)
		return
	}
	apiresponse.OK(w, rid(r), map[string]string{"message": "archived"})
}

func (h *InvoiceHandler) Restore(w http.ResponseWriter, r *http.Request) {
	if err := h.Svc.Restore(chi.URLParam(r, "id")); err != nil {
		writeErr(w, r, err)
		return
	}
	apiresponse.OK(w, rid(r), map[string]string{"message": "restored"})
}

func (h *InvoiceHandler) PermanentDelete(w http.ResponseWriter, r *http.Request) {
	if err := h.Svc.PermanentDelete(chi.URLParam(r, "id")); err != nil {
		writeErr(w, r, err)
		return
	}
	apiresponse.OK(w, rid(r), map[string]string{"message": "deleted"})
}

func (h *InvoiceHandler) Duplicate(w http.ResponseWriter, r *http.Request) {
	rec, err := h.Svc.Duplicate(chi.URLParam(r, "id"))
	if err != nil {
		writeErr(w, r, err)
		return
	}
	apiresponse.Created(w, rid(r), rec)
}

// PaymentHandler handles payment endpoints.
type PaymentHandler struct {
	Svc *services.PaymentService
}

func (h *PaymentHandler) List(w http.ResponseWriter, r *http.Request) {
	writeList(w, r, h.Svc.List(parseQuery(r)))
}

func (h *PaymentHandler) Get(w http.ResponseWriter, r *http.Request) {
	rec, err := h.Svc.Get(chi.URLParam(r, "id"))
	if err != nil {
		writeErr(w, r, err)
		return
	}
	apiresponse.OK(w, rid(r), rec)
}

func (h *PaymentHandler) Create(w http.ResponseWriter, r *http.Request) {
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

func (h *PaymentHandler) Update(w http.ResponseWriter, r *http.Request) {
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

func (h *PaymentHandler) Archive(w http.ResponseWriter, r *http.Request) {
	if err := h.Svc.Archive(chi.URLParam(r, "id")); err != nil {
		writeErr(w, r, err)
		return
	}
	apiresponse.OK(w, rid(r), map[string]string{"message": "archived"})
}

func (h *PaymentHandler) Restore(w http.ResponseWriter, r *http.Request) {
	if err := h.Svc.Restore(chi.URLParam(r, "id")); err != nil {
		writeErr(w, r, err)
		return
	}
	apiresponse.OK(w, rid(r), map[string]string{"message": "restored"})
}

func (h *PaymentHandler) PermanentDelete(w http.ResponseWriter, r *http.Request) {
	if err := h.Svc.PermanentDelete(chi.URLParam(r, "id")); err != nil {
		writeErr(w, r, err)
		return
	}
	apiresponse.OK(w, rid(r), map[string]string{"message": "deleted"})
}

// RepairFinancials resyncs invoice paid/remaining/status from payments and client outstanding.
func (h *InvoiceHandler) RepairFinancials(w http.ResponseWriter, r *http.Request) {
	n, err := h.Svc.RepairAllFinancials()
	if err != nil {
		writeErr(w, r, err)
		return
	}
	apiresponse.OK(w, rid(r), map[string]any{"repaired": n, "message": "financials reconciled"})
}
