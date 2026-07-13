package handlers

import (
	"net/http"

	"github.com/JagtapAvadhut/smartca-backend/internal/app/services"
	"github.com/JagtapAvadhut/smartca-backend/internal/domain/models"
	"github.com/JagtapAvadhut/smartca-backend/internal/repository/memory"
	"github.com/JagtapAvadhut/smartca-backend/pkg/apiresponse"
)

// LoginHistoryHandler lists seeded + recorded login history rows.
type LoginHistoryHandler struct {
	Store *memory.Store
}

func (h *LoginHistoryHandler) List(w http.ResponseWriter, r *http.Request) {
	svc := services.NewCRUDService(h.Store, services.ColLoginHistory)
	writeList(w, r, svc.List(parseQuery(r)))
}

// NotificationExtraHandler provides bulk notification operations.
type NotificationExtraHandler struct {
	Store *memory.Store
}

func (h *NotificationExtraHandler) MarkAllRead(w http.ResponseWriter, r *http.Request) {
	var updated int
	err := h.Store.WithTx(func(st *memory.Store) error {
		for _, n := range st.GetAll(services.ColNotifications, false) {
			if n.GetBool("read") {
				continue
			}
			if _, err := st.Update(services.ColNotifications, n.ID(), models.Record{"read": true}); err != nil {
				return err
			}
			updated++
		}
		return nil
	})
	if err != nil {
		writeErr(w, r, err)
		return
	}
	apiresponse.OK(w, rid(r), map[string]any{"updated": updated})
}
