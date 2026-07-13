package handlers

import (
	"net/http"
	"strconv"

	"github.com/JagtapAvadhut/smartca-backend/internal/app/services"
	apperrors "github.com/JagtapAvadhut/smartca-backend/internal/domain/errors"
	"github.com/JagtapAvadhut/smartca-backend/pkg/apiresponse"
)

type DashboardHandler struct{ Svc *services.DashboardService }
type ReportHandler struct{ Svc *services.ReportService }
type SearchHandler struct{ Svc *services.SearchService }
type AccountingHandler struct{ Svc *services.AccountingService }
type ArchiveHandler struct{ Svc *services.ArchiveService }
type SettingsHandler struct{ Svc *services.SettingsService }

func (h *DashboardHandler) Get(w http.ResponseWriter, r *http.Request) {
	apiresponse.OK(w, rid(r), h.Svc.Get())
}

func (h *ReportHandler) Summary(w http.ResponseWriter, r *http.Request) {
	apiresponse.OK(w, rid(r), h.Svc.Summary())
}

func (h *SearchHandler) Search(w http.ResponseWriter, r *http.Request) {
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	apiresponse.OK(w, rid(r), h.Svc.Search(r.URL.Query().Get("q"), limit))
}

func (h *AccountingHandler) Journals(w http.ResponseWriter, r *http.Request) {
	apiresponse.OK(w, rid(r), h.Svc.ListJournals())
}

func (h *AccountingHandler) PostJournal(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Date      string `json:"date"`
		Narration string `json:"narration"`
		Lines     []struct {
			Account string  `json:"account"`
			Debit   float64 `json:"debit"`
			Credit  float64 `json:"credit"`
		} `json:"lines"`
	}
	if err := decodeJSON(r, &body); err != nil {
		writeErr(w, r, apperrors.BadRequest("invalid JSON body"))
		return
	}
	converted := make([]services.JournalLine, len(body.Lines))
	for i, l := range body.Lines {
		converted[i] = services.JournalLine{Account: l.Account, Debit: l.Debit, Credit: l.Credit}
	}
	rec, err := h.Svc.PostJournal(body.Date, body.Narration, converted)
	if err != nil {
		writeErr(w, r, err)
		return
	}
	apiresponse.Created(w, rid(r), rec)
}

func (h *AccountingHandler) Statements(w http.ResponseWriter, r *http.Request) {
	apiresponse.OK(w, rid(r), h.Svc.Statements())
}

func (h *ArchiveHandler) List(w http.ResponseWriter, r *http.Request) {
	coll := r.URL.Query().Get("collection")
	if coll != "" {
		apiresponse.OK(w, rid(r), h.Svc.List(coll))
		return
	}
	apiresponse.OK(w, rid(r), h.Svc.ListAll())
}

func (h *ArchiveHandler) Restore(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Collection string `json:"collection"`
		ID         string `json:"id"`
	}
	if err := decodeJSON(r, &body); err != nil {
		writeErr(w, r, apperrors.BadRequest("invalid JSON body"))
		return
	}
	if err := h.Svc.Restore(body.Collection, body.ID); err != nil {
		writeErr(w, r, err)
		return
	}
	apiresponse.OK(w, rid(r), map[string]string{"message": "restored"})
}

func (h *ArchiveHandler) Permanent(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Collection string `json:"collection"`
		ID         string `json:"id"`
	}
	if err := decodeJSON(r, &body); err != nil {
		writeErr(w, r, apperrors.BadRequest("invalid JSON body"))
		return
	}
	if err := h.Svc.PermanentDelete(body.Collection, body.ID); err != nil {
		writeErr(w, r, err)
		return
	}
	apiresponse.OK(w, rid(r), map[string]string{"message": "deleted"})
}

func (h *ArchiveHandler) BulkRestore(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Items []struct {
			Collection string `json:"collection"`
			ID         string `json:"id"`
		} `json:"items"`
	}
	if err := decodeJSON(r, &body); err != nil {
		writeErr(w, r, apperrors.BadRequest("invalid JSON body"))
		return
	}
	items := make([]struct{ Collection, ID string }, len(body.Items))
	for i, it := range body.Items {
		items[i] = struct{ Collection, ID string }{it.Collection, it.ID}
	}
	n, err := h.Svc.BulkRestore(items)
	if err != nil {
		writeErr(w, r, err)
		return
	}
	apiresponse.OK(w, rid(r), map[string]any{"restored": n})
}

func (h *ArchiveHandler) BulkPermanent(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Items []struct {
			Collection string `json:"collection"`
			ID         string `json:"id"`
		} `json:"items"`
	}
	if err := decodeJSON(r, &body); err != nil {
		writeErr(w, r, apperrors.BadRequest("invalid JSON body"))
		return
	}
	items := make([]struct{ Collection, ID string }, len(body.Items))
	for i, it := range body.Items {
		items[i] = struct{ Collection, ID string }{it.Collection, it.ID}
	}
	n, err := h.Svc.BulkPermanentDelete(items)
	if err != nil {
		writeErr(w, r, err)
		return
	}
	apiresponse.OK(w, rid(r), map[string]any{"deleted": n})
}

func (h *SettingsHandler) Get(w http.ResponseWriter, r *http.Request) {
	rec, err := h.Svc.Get()
	if err != nil {
		writeErr(w, r, err)
		return
	}
	apiresponse.OK(w, rid(r), rec)
}

func (h *SettingsHandler) Update(w http.ResponseWriter, r *http.Request) {
	var body map[string]any
	if err := decodeJSON(r, &body); err != nil {
		writeErr(w, r, apperrors.BadRequest("invalid JSON body"))
		return
	}
	rec, err := h.Svc.Update(body)
	if err != nil {
		writeErr(w, r, err)
		return
	}
	apiresponse.OK(w, rid(r), rec)
}

func (h *SettingsHandler) GetOrganization(w http.ResponseWriter, r *http.Request) {
	rec, err := h.Svc.GetOrganization()
	if err != nil {
		writeErr(w, r, err)
		return
	}
	apiresponse.OK(w, rid(r), rec)
}

func (h *SettingsHandler) UpdateOrganization(w http.ResponseWriter, r *http.Request) {
	var body map[string]any
	if err := decodeJSON(r, &body); err != nil {
		writeErr(w, r, apperrors.BadRequest("invalid JSON body"))
		return
	}
	rec, err := h.Svc.UpdateOrganization(body)
	if err != nil {
		writeErr(w, r, err)
		return
	}
	apiresponse.OK(w, rid(r), rec)
}
