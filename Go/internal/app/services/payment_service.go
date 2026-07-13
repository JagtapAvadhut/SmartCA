package services

import (
	"fmt"
	"strings"
	"time"

	apperrors "github.com/JagtapAvadhut/smartca-backend/internal/domain/errors"
	"github.com/JagtapAvadhut/smartca-backend/internal/domain/models"
	"github.com/JagtapAvadhut/smartca-backend/internal/domain/money"
	"github.com/JagtapAvadhut/smartca-backend/internal/repository/memory"
)

// PaymentService handles payments with atomic invoice/client sync.
type PaymentService struct {
	store *memory.Store
	base  *CRUDService
}

func NewPaymentService(store *memory.Store) *PaymentService {
	return &PaymentService{store: store, base: NewCRUDService(store, ColPayments)}
}

func (s *PaymentService) List(q models.Query) models.PageResult { return s.base.List(q) }
func (s *PaymentService) Get(id string) (models.Record, error)  { return s.base.Get(id) }

func (s *PaymentService) assertValid(st *memory.Store, data models.Record, excludeID string) error {
	invoiceID := data.GetString("invoiceId")
	if invoiceID == "" {
		return apperrors.Validation("Invoice is required", apperrors.Detail{Field: "invoiceId", Message: "required"})
	}
	if err := validatePaymentAmount(st, data.GetFloat("amount"), invoiceID, excludeID); err != nil {
		return err
	}
	ref := strings.TrimSpace(data.GetString("reference"))
	if ref == "" {
		return nil
	}
	for _, p := range st.GetAll(ColPayments, true) {
		if excludeID != "" && p.ID() == excludeID {
			continue
		}
		if p.GetString("invoiceId") != invoiceID {
			continue
		}
		if !strings.EqualFold(p.GetString("status"), "completed") {
			continue
		}
		if strings.EqualFold(strings.TrimSpace(p.GetString("reference")), ref) {
			return apperrors.Conflict(fmt.Sprintf("Duplicate payment reference %q for this invoice", ref))
		}
	}
	return nil
}

func (s *PaymentService) Create(data models.Record) (models.Record, error) {
	var created models.Record
	err := s.store.WithTx(func(st *memory.Store) error {
		if data == nil {
			data = models.Record{}
		}
		rec := data.Clone()
		now := time.Now().UTC()
		if rec.GetString("paymentDate") == "" {
			rec.Set("paymentDate", now.Format("2006-01-02"))
		}
		if rec.GetString("method") == "" {
			rec.Set("method", "bank_transfer")
		}
		if rec.GetString("status") == "" {
			rec.Set("status", "completed")
		}
		if rec.GetString("reference") == "" {
			rec.Set("reference", fmt.Sprintf("TXN%d", now.UnixMilli()))
		}
		rec.Set("amount", money.RoundMoney(rec.GetFloat("amount")))

		// Enrich from invoice when missing
		if invID := rec.GetString("invoiceId"); invID != "" {
			if inv, err := st.Get(ColInvoices, invID); err == nil {
				if rec.GetString("clientId") == "" {
					rec.Set("clientId", inv.GetString("clientId"))
				}
				if rec.GetString("clientName") == "" {
					rec.Set("clientName", inv.GetString("clientName"))
				}
				if rec.GetString("invoiceNumber") == "" {
					rec.Set("invoiceNumber", inv.GetString("invoiceNumber"))
				}
			}
		}

		if err := s.assertValid(st, rec, ""); err != nil {
			return err
		}
		pay, err := st.Create(ColPayments, rec)
		if err != nil {
			return err
		}
		if err := syncPaymentSideEffects(st, pay); err != nil {
			return err
		}
		_, _ = st.Create(ColActivities, models.Record{
			"type":       "payment_received",
			"message":    fmt.Sprintf("Payment %s recorded for %s", pay.GetString("reference"), pay.GetString("clientName")),
			"clientId":   pay.GetString("clientId"),
			"clientName": pay.GetString("clientName"),
			"userId":     "",
			"userName":   "System",
			"timestamp":  now.Format(time.RFC3339),
		})
		created = pay
		return nil
	})
	return created, err
}

func (s *PaymentService) Update(id string, patch models.Record) (models.Record, error) {
	var out models.Record
	err := s.store.WithTx(func(st *memory.Store) error {
		before, err := st.Get(ColPayments, id)
		if err != nil {
			return err
		}
		next := before.Clone()
		for k, v := range patch {
			if k == "id" {
				continue
			}
			next[k] = v
		}
		if patch["amount"] != nil {
			next.Set("amount", money.RoundMoney(next.GetFloat("amount")))
		}
		if err := s.assertValid(st, next, id); err != nil {
			return err
		}
		upd := patch.Clone()
		if patch["amount"] != nil {
			upd.Set("amount", money.RoundMoney(patch.GetFloat("amount")))
		}
		pay, err := st.Update(ColPayments, id, upd)
		if err != nil {
			return err
		}
		if before.GetString("invoiceId") != "" && before.GetString("invoiceId") != pay.GetString("invoiceId") {
			if _, err := syncInvoiceFromPayments(st, before.GetString("invoiceId")); err != nil {
				return err
			}
			if before.GetString("clientId") != "" {
				_ = recalcClientFinancials(st, before.GetString("clientId"))
			}
		}
		if err := syncPaymentSideEffects(st, pay); err != nil {
			return err
		}
		out = pay
		return nil
	})
	return out, err
}

func (s *PaymentService) Delete(id string) error {
	return s.store.WithTx(func(st *memory.Store) error {
		before, err := st.Get(ColPayments, id)
		if err != nil {
			return err
		}
		if err := st.PermanentDelete(ColPayments, id); err != nil {
			return err
		}
		return syncPaymentSideEffects(st, before)
	})
}

func (s *PaymentService) Archive(id string) error {
	return s.store.WithTx(func(st *memory.Store) error {
		before, err := st.Get(ColPayments, id)
		if err != nil {
			return err
		}
		if err := st.Archive(ColPayments, id); err != nil {
			return err
		}
		return syncPaymentSideEffects(st, before)
	})
}

func (s *PaymentService) Restore(id string) error {
	return s.store.WithTx(func(st *memory.Store) error {
		if err := st.Restore(ColPayments, id); err != nil {
			return err
		}
		pay, err := st.Get(ColPayments, id)
		if err != nil {
			return err
		}
		return syncPaymentSideEffects(st, pay)
	})
}

func (s *PaymentService) PermanentDelete(id string) error {
	return s.Delete(id)
}
