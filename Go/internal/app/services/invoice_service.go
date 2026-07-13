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

// InvoiceService wraps invoice CRUD with tax totals and client sync.
type InvoiceService struct {
	store *memory.Store
	base  *CRUDService
}

func NewInvoiceService(store *memory.Store) *InvoiceService {
	return &InvoiceService{store: store, base: NewCRUDService(store, ColInvoices)}
}

func (s *InvoiceService) List(q models.Query) models.PageResult { return s.base.List(q) }
func (s *InvoiceService) Get(id string) (models.Record, error)  { return s.base.Get(id) }

func buildInvoiceTotals(data models.Record) models.Record {
	subtotal := money.RoundMoney(data.GetFloat("subtotal"))
	paid := money.RoundMoney(data.GetFloat("paidAmount"))

	// Allow exact totals when caller supplies a complete tax breakdown.
	if data["total"] != nil && (data["cgst"] != nil || data["sgst"] != nil || data["igst"] != nil) && data.GetFloat("total") > 0 {
		total := money.RoundMoney(data.GetFloat("total"))
		return models.Record{
			"subtotal":        subtotal,
			"discount":        money.RoundMoney(data.GetFloat("discount")),
			"roundOff":        money.RoundMoney(data.GetFloat("roundOff")),
			"cgst":            money.RoundMoney(data.GetFloat("cgst")),
			"sgst":            money.RoundMoney(data.GetFloat("sgst")),
			"igst":            money.RoundMoney(data.GetFloat("igst")),
			"total":           total,
			"remainingAmount": money.InvoiceRemaining(total, paid),
		}
	}
	useIGST := data.GetFloat("igst") > 0 && data.GetFloat("cgst") == 0 && data.GetFloat("sgst") == 0
	computed := money.ComputeInvoiceTax(subtotal, data.GetFloat("discount"), data.GetFloat("roundOff"), useIGST)
	return models.Record{
		"subtotal":        subtotal,
		"discount":        computed.Discount,
		"roundOff":        computed.RoundOff,
		"cgst":            computed.CGST,
		"sgst":            computed.SGST,
		"igst":            computed.IGST,
		"total":           computed.Total,
		"remainingAmount": money.InvoiceRemaining(computed.Total, paid),
	}
}

func (s *InvoiceService) Create(data models.Record) (models.Record, error) {
	var created models.Record
	err := s.store.WithTx(func(st *memory.Store) error {
		if data == nil {
			data = models.Record{}
		}
		subtotal := data.GetFloat("subtotal")
		totals := buildInvoiceTotals(data)
		paid := money.RoundMoney(data.GetFloat("paidAmount"))
		now := time.Now().UTC()
		rec := data.Clone()
		if rec.GetString("invoiceNumber") == "" {
			rec.Set("invoiceNumber", fmt.Sprintf("SCA/2025-26/%s", now.Format("150405")))
		}
		if rec.GetString("issueDate") == "" {
			rec.Set("issueDate", now.Format("2006-01-02"))
		}
		if rec.GetString("dueDate") == "" {
			rec.Set("dueDate", now.Add(30*24*time.Hour).Format("2006-01-02"))
		}
		if rec.GetString("status") == "" {
			rec.Set("status", "draft")
		}
		if rec["items"] == nil {
			rec.Set("items", []any{
				map[string]any{"description": "Professional fees", "quantity": 1, "rate": subtotal, "amount": subtotal},
			})
		}
		if rec.GetString("notes") == "" {
			rec.Set("notes", "Professional fees for CA services rendered.")
		}
		for k, v := range totals {
			rec[k] = v
		}
		rec.Set("paidAmount", paid)
		rec.Set("remainingAmount", money.InvoiceRemaining(totals.GetFloat("total"), paid))

		inv, err := st.Create(ColInvoices, rec)
		if err != nil {
			return err
		}
		if cid := inv.GetString("clientId"); cid != "" {
			if err := recalcClientFinancials(st, cid); err != nil {
				return err
			}
		}
		_, _ = st.Create(ColActivities, models.Record{
			"type":       "invoice_created",
			"message":    fmt.Sprintf("Invoice %s created for %s", inv.GetString("invoiceNumber"), inv.GetString("clientName")),
			"clientId":   inv.GetString("clientId"),
			"clientName": inv.GetString("clientName"),
			"userId":     "",
			"userName":   "System",
			"timestamp":  now.Format(time.RFC3339),
		})
		created = inv
		return nil
	})
	return created, err
}

func (s *InvoiceService) Update(id string, patch models.Record) (models.Record, error) {
	var out models.Record
	err := s.store.WithTx(func(st *memory.Store) error {
		before, err := st.Get(ColInvoices, id)
		if err != nil {
			return err
		}
		merged := before.Clone()
		for k, v := range patch {
			if k == "id" {
				continue
			}
			merged[k] = v
		}
		needTotals := patch["subtotal"] != nil || patch["discount"] != nil || patch["roundOff"] != nil || patch["igst"] != nil
		upd := patch.Clone()
		if needTotals {
			for k, v := range buildInvoiceTotals(merged) {
				upd[k] = v
			}
		}
		inv, err := st.Update(ColInvoices, id, upd)
		if err != nil {
			return err
		}
		if _, err := syncInvoiceFromPayments(st, inv.ID()); err != nil {
			return err
		}
		if before.GetString("clientId") != "" && before.GetString("clientId") != inv.GetString("clientId") {
			_ = recalcClientFinancials(st, before.GetString("clientId"))
		}
		if inv.GetString("clientId") != "" {
			_ = recalcClientFinancials(st, inv.GetString("clientId"))
		}
		out, err = st.Get(ColInvoices, id)
		return err
	})
	return out, err
}

func (s *InvoiceService) Delete(id string) error {
	return s.store.WithTx(func(st *memory.Store) error {
		before, err := st.Get(ColInvoices, id)
		if err != nil {
			return err
		}
		allPay := st.GetAll(ColPayments, true)
		for _, p := range allPay {
			if p.GetString("invoiceId") == id {
				if err := st.PermanentDelete(ColPayments, p.ID()); err != nil {
					return err
				}
			}
		}
		if err := st.PermanentDelete(ColInvoices, id); err != nil {
			return err
		}
		if cid := before.GetString("clientId"); cid != "" {
			return recalcClientFinancials(st, cid)
		}
		return nil
	})
}

func (s *InvoiceService) Archive(id string) error { return s.base.Archive(id) }
func (s *InvoiceService) Restore(id string) error { return s.base.Restore(id) }
func (s *InvoiceService) PermanentDelete(id string) error {
	return s.Delete(id)
}

func (s *InvoiceService) Duplicate(id string) (models.Record, error) {
	var copyRec models.Record
	err := s.store.WithTx(func(st *memory.Store) error {
		src, err := st.Get(ColInvoices, id)
		if err != nil {
			return err
		}
		dup := src.Clone()
		delete(dup, "id")
		delete(dup, "archived")
		delete(dup, "archivedAt")
		now := time.Now().UTC()
		dup.Set("invoiceNumber", fmt.Sprintf("SCA/2025-26/%s", now.Format("150405")))
		dup.Set("status", "draft")
		dup.Set("paidAmount", 0.0)
		dup.Set("remainingAmount", money.RoundMoney(src.GetFloat("total")))
		dup.Set("createdAt", now.Format(time.RFC3339))
		dup.Set("updatedAt", now.Format(time.RFC3339))
		created, err := st.Create(ColInvoices, dup)
		if err != nil {
			return err
		}
		if cid := created.GetString("clientId"); cid != "" {
			_ = recalcClientFinancials(st, cid)
		}
		copyRec = created
		return nil
	})
	return copyRec, err
}

// --- shared financial sync (paise-safe via money.RoundMoney) ---

func syncInvoiceFromPayments(st *memory.Store, invoiceID string) (models.Record, error) {
	if invoiceID == "" {
		return nil, nil
	}
	inv, err := st.Get(ColInvoices, invoiceID)
	if err != nil {
		return nil, err
	}
	var paid money.Paise
	for _, p := range st.GetAll(ColPayments, true) {
		if p.GetBool("archived") {
			continue
		}
		if p.GetString("invoiceId") != invoiceID {
			continue
		}
		if !strings.EqualFold(p.GetString("status"), "completed") {
			continue
		}
		paid += money.FromRupees(p.GetFloat("amount"))
	}
	paidAmt := paid.Rupees()
	status := money.DeriveInvoiceStatus(inv.GetString("status"), inv.GetString("dueDate"), inv.GetFloat("total"), paidAmt, time.Now())
	remaining := money.InvoiceRemaining(inv.GetFloat("total"), paidAmt)
	return st.Update(ColInvoices, invoiceID, models.Record{
		"paidAmount":      money.RoundMoney(paidAmt),
		"status":          status,
		"remainingAmount": remaining,
	})
}

func recalcClientFinancials(st *memory.Store, clientID string) error {
	if clientID == "" {
		return nil
	}
	if _, err := st.Get(ColClients, clientID); err != nil {
		return err
	}
	var revenue, outstanding money.Paise
	for _, inv := range st.GetAll(ColInvoices, false) {
		if inv.GetString("clientId") != clientID {
			continue
		}
		status := inv.GetString("status")
		total := money.FromRupees(inv.GetFloat("total"))
		paid := money.FromRupees(inv.GetFloat("paidAmount"))
		if status == "paid" {
			revenue += total
		}
		if money.IsOutstandingStatus(status) {
			rem := money.FromRupees(money.InvoiceRemaining(total.Rupees(), paid.Rupees()))
			outstanding += rem
		}
	}
	_, err := st.Update(ColClients, clientID, models.Record{
		"revenue":     money.RoundMoney(revenue.Rupees()),
		"outstanding": money.RoundMoney(outstanding.Rupees()),
	})
	return err
}

func getInvoiceRemainingBalance(st *memory.Store, invoiceID, excludePaymentID string) float64 {
	inv, err := st.Get(ColInvoices, invoiceID)
	if err != nil {
		return 0
	}
	var paid money.Paise
	for _, p := range st.GetAll(ColPayments, true) {
		if p.GetBool("archived") {
			continue
		}
		if p.GetString("invoiceId") != invoiceID {
			continue
		}
		if !strings.EqualFold(p.GetString("status"), "completed") {
			continue
		}
		if excludePaymentID != "" && p.ID() == excludePaymentID {
			continue
		}
		paid += money.FromRupees(p.GetFloat("amount"))
	}
	return money.InvoiceRemaining(inv.GetFloat("total"), paid.Rupees())
}

func validatePaymentAmount(st *memory.Store, amount float64, invoiceID, excludePaymentID string) error {
	amt := money.FromRupees(amount)
	if amt <= 0 {
		return apperrors.Validation("Payment amount must be greater than zero")
	}
	remaining := money.FromRupees(getInvoiceRemainingBalance(st, invoiceID, excludePaymentID))
	if amt > remaining {
		return apperrors.Validation(fmt.Sprintf(
			"Payment ₹%g exceeds remaining invoice balance ₹%g",
			amt.Rupees(), remaining.Rupees(),
		))
	}
	return nil
}

func syncPaymentSideEffects(st *memory.Store, payment models.Record) error {
	touched := map[string]struct{}{}
	if iid := payment.GetString("invoiceId"); iid != "" {
		inv, err := syncInvoiceFromPayments(st, iid)
		if err != nil {
			return err
		}
		cid := payment.GetString("clientId")
		if cid == "" && inv != nil {
			cid = inv.GetString("clientId")
		}
		if cid != "" {
			touched[cid] = struct{}{}
		}
	} else if cid := payment.GetString("clientId"); cid != "" {
		touched[cid] = struct{}{}
	}
	for cid := range touched {
		if err := recalcClientFinancials(st, cid); err != nil {
			return err
		}
	}
	return nil
}
