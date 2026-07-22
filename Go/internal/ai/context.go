package ai

import (
	"encoding/json"
	"strings"

	"github.com/JagtapAvadhut/smartca-backend/internal/app/services"
	"github.com/JagtapAvadhut/smartca-backend/internal/domain/models"
	"github.com/JagtapAvadhut/smartca-backend/internal/repository"
)

// sensitiveKeys are stripped from any record before prompt injection.
var sensitiveKeys = map[string]struct{}{
	"password": {}, "passwordHash": {}, "hash": {}, "token": {}, "secret": {},
	"apiKey": {}, "refreshToken": {}, "otp": {}, "pin": {}, "bankAccount": {},
	"accountNumber": {}, "ifsc": {}, "cvv": {},
}

// ContextBuilder loads compact Smart CA snapshots for prompts.
type ContextBuilder struct {
	Store repository.Store
}

func NewContextBuilder(store repository.Store) *ContextBuilder {
	return &ContextBuilder{Store: store}
}

func (b *ContextBuilder) ClientBrief(clientID string) string {
	if clientID == "" || b.Store == nil {
		return ""
	}
	c, err := b.Store.Get(services.ColClients, clientID)
	if err != nil {
		return ""
	}
	invCount, payCount, outstanding := 0, 0, 0.0
	for _, inv := range b.Store.ListByJSONField(services.ColInvoices, "clientId", clientID, false) {
		invCount++
		outstanding += inv.GetFloat("remainingAmount")
	}
	payCount = len(b.Store.ListByJSONField(services.ColPayments, "clientId", clientID, false))
	payload := map[string]any{
		"id": c.ID(), "name": c.GetString("name"), "type": c.GetString("type"),
		"status": c.GetString("status"), "city": c.GetString("city"), "state": c.GetString("state"),
		"gstin": maskTail(c.GetString("gstin"), 4), "pan": maskTail(c.GetString("pan"), 4),
		"email": c.GetString("email"), "phone": c.GetString("phone"),
		"invoiceCount": invCount, "paymentCount": payCount, "outstanding": outstanding,
	}
	return mustJSON(payload)
}

func (b *ContextBuilder) InvoiceBrief(invoiceID string) string {
	if invoiceID == "" || b.Store == nil {
		return ""
	}
	inv, err := b.Store.Get(services.ColInvoices, invoiceID)
	if err != nil {
		return ""
	}
	safe := sanitizeRecord(inv, []string{
		"id", "invoiceNumber", "clientId", "clientName", "status", "issueDate", "dueDate",
		"subtotal", "cgst", "sgst", "igst", "total", "paidAmount", "remainingAmount", "items", "notes",
	})
	return mustJSON(safe)
}

func (b *ContextBuilder) DocumentBrief(documentID string) string {
	if documentID == "" || b.Store == nil {
		return ""
	}
	doc, err := b.Store.Get(services.ColDocuments, documentID)
	if err != nil {
		return ""
	}
	safe := sanitizeRecord(doc, []string{
		"id", "name", "fileName", "category", "clientId", "clientName", "status", "uploadedAt", "size", "mimeType", "notes",
	})
	return mustJSON(safe)
}

func (b *ContextBuilder) DashboardBrief() string {
	if b.Store == nil {
		return ""
	}
	clients := b.Store.Count(services.ColClients, false)
	invoices := b.Store.Count(services.ColInvoices, false)
	payments := b.Store.Count(services.ColPayments, false)
	tasks := b.Store.Count(services.ColTasks, false)
	var outstanding, revenue float64
	overdue := 0
	for _, inv := range b.Store.GetAll(services.ColInvoices, false) {
		outstanding += inv.GetFloat("remainingAmount")
		revenue += inv.GetFloat("paidAmount")
		st := strings.ToLower(inv.GetString("status"))
		if st == "overdue" || (inv.GetFloat("remainingAmount") > 0 && st != "draft" && st != "cancelled") {
			if st == "overdue" {
				overdue++
			}
		}
	}
	gstOpen := countStatus(b.Store, services.ColGST, "pending", "in_progress", "filed")
	itrOpen := countOpen(b.Store, services.ColITR)
	tdsOpen := countOpen(b.Store, services.ColTDS)
	rocOpen := countOpen(b.Store, services.ColROC)
	payload := map[string]any{
		"clients": clients, "invoices": invoices, "payments": payments, "tasks": tasks,
		"outstandingINR": outstanding, "collectedINR": revenue, "overdueInvoices": overdue,
		"gstReturnsTracked": gstOpen, "itrTracked": itrOpen, "tdsTracked": tdsOpen, "rocTracked": rocOpen,
	}
	return mustJSON(payload)
}

func (b *ContextBuilder) PracticeSnippet() string {
	if b.Store == nil {
		return ""
	}
	payload := map[string]any{
		"clients":    b.Store.Count(services.ColClients, false),
		"companies":  b.Store.Count(services.ColCompanies, false),
		"invoices":   b.Store.Count(services.ColInvoices, false),
		"payments":   b.Store.Count(services.ColPayments, false),
		"employees":  b.Store.Count(services.ColEmployees, false),
		"documents":  b.Store.Count(services.ColDocuments, false),
		"tasks":      b.Store.Count(services.ColTasks, false),
		"gst":        b.Store.Count(services.ColGST, false),
		"tds":        b.Store.Count(services.ColTDS, false),
		"roc":        b.Store.Count(services.ColROC, false),
		"itr":        b.Store.Count(services.ColITR, false),
		"journals":   b.Store.Count(services.ColJournals, false),
		"compliance": b.Store.Count(services.ColCompliance, false),
		"dashboard":  jsonRaw(b.DashboardBrief()),
	}
	return mustJSON(payload)
}

func jsonRaw(s string) any {
	s = strings.TrimSpace(s)
	if s == "" {
		return map[string]any{}
	}
	var v any
	if err := json.Unmarshal([]byte(s), &v); err != nil {
		return s
	}
	return v
}

func sanitizeRecord(rec models.Record, allow []string) map[string]any {
	out := map[string]any{}
	if len(allow) == 0 {
		for k, v := range rec {
			if _, sens := sensitiveKeys[k]; sens {
				continue
			}
			out[k] = v
		}
		return out
	}
	for _, k := range allow {
		if _, sens := sensitiveKeys[k]; sens {
			continue
		}
		if v, ok := rec[k]; ok {
			out[k] = v
		}
	}
	return out
}

func mustJSON(v any) string {
	b, err := json.Marshal(v)
	if err != nil {
		return "{}"
	}
	return string(b)
}

func maskTail(s string, keep int) string {
	s = strings.TrimSpace(s)
	if s == "" {
		return ""
	}
	if len(s) <= keep {
		return strings.Repeat("*", len(s))
	}
	return strings.Repeat("*", len(s)-keep) + s[len(s)-keep:]
}

func countOpen(store repository.Store, col string) int {
	n := 0
	for _, r := range store.GetAll(col, false) {
		st := strings.ToLower(r.GetString("status"))
		if st != "completed" && st != "filed" && st != "closed" && st != "cancelled" {
			n++
		}
	}
	return n
}

func countStatus(store repository.Store, col string, _ ...string) int {
	return store.Count(col, false)
}
