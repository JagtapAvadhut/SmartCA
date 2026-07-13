package services

import (
	"fmt"
	"regexp"
	"strings"
	"time"

	apperrors "github.com/JagtapAvadhut/smartca-backend/internal/domain/errors"
	"github.com/JagtapAvadhut/smartca-backend/internal/domain/models"
	"github.com/JagtapAvadhut/smartca-backend/internal/domain/money"
	"github.com/JagtapAvadhut/smartca-backend/internal/repository/memory"
)

var (
	reRevenue   = regexp.MustCompile(`(?i)fee|income|revenue|professional`)
	reExpense   = regexp.MustCompile(`(?i)expense|salary|rent|utility`)
	reAsset     = regexp.MustCompile(`(?i)bank|receivable|cash|asset`)
	reLiability = regexp.MustCompile(`(?i)payable|liability|loan`)
)

// AccountingService provides demo journals and statements.
type AccountingService struct {
	store *memory.Store
}

func NewAccountingService(store *memory.Store) *AccountingService {
	return &AccountingService{store: store}
}

// JournalLine is a single debit/credit line in a journal entry.
type JournalLine struct {
	Account string  `json:"account"`
	Debit   float64 `json:"debit"`
	Credit  float64 `json:"credit"`
}

func (s *AccountingService) ListJournals() []models.Record {
	return append(s.buildSystemJournals(), s.manualJournals()...)
}

func (s *AccountingService) manualJournals() []models.Record {
	out := make([]models.Record, 0)
	for _, j := range s.store.GetAll(ColJournals, false) {
		src := j.GetString("source")
		if src == "invoice" || src == "payment" {
			continue
		}
		out = append(out, j)
	}
	return out
}

func (s *AccountingService) buildSystemJournals() []models.Record {
	out := make([]models.Record, 0)
	for _, inv := range s.store.GetAll(ColInvoices, false) {
		st := inv.GetString("status")
		if st == "draft" || st == "cancelled" {
			continue
		}
		total := money.RoundMoney(inv.GetFloat("total"))
		out = append(out, models.Record{
			"id":        "SYS-INV-" + inv.ID(),
			"date":      inv.GetString("issueDate"),
			"narration": fmt.Sprintf("Invoice %s — %s", inv.GetString("invoiceNumber"), inv.GetString("clientName")),
			"source":    "invoice",
			"sourceId":  inv.ID(),
			"createdAt": firstNonEmpty(inv.GetString("createdAt"), inv.GetString("issueDate")),
			"lines": []any{
				map[string]any{"account": "Accounts Receivable", "debit": total, "credit": 0.0},
				map[string]any{"account": "Professional Fees", "debit": 0.0, "credit": total},
			},
		})
	}
	for _, p := range s.store.GetAll(ColPayments, false) {
		if p.GetString("status") != "completed" {
			continue
		}
		amt := money.RoundMoney(p.GetFloat("amount"))
		out = append(out, models.Record{
			"id":        "SYS-PAY-" + p.ID(),
			"date":      p.GetString("paymentDate"),
			"narration": fmt.Sprintf("Payment %s — %s", p.GetString("reference"), p.GetString("clientName")),
			"source":    "payment",
			"sourceId":  p.ID(),
			"createdAt": p.GetString("paymentDate"),
			"lines": []any{
				map[string]any{"account": "Bank", "debit": amt, "credit": 0.0},
				map[string]any{"account": "Accounts Receivable", "debit": 0.0, "credit": amt},
			},
		})
	}
	return out
}

func assertBalanced(lines []JournalLine) error {
	var debit, credit money.Paise
	for _, l := range lines {
		debit += money.FromRupees(l.Debit)
		credit += money.FromRupees(l.Credit)
	}
	if debit != credit {
		return apperrors.Validation(fmt.Sprintf(
			"Unbalanced journal: Debit ₹%g ≠ Credit ₹%g", debit.Rupees(), credit.Rupees(),
		))
	}
	if debit <= 0 {
		return apperrors.Validation("Journal must have non-zero amounts")
	}
	return nil
}

// PostJournal posts a balanced manual journal entry.
func (s *AccountingService) PostJournal(date, narration string, lines []JournalLine) (models.Record, error) {
	if err := assertBalanced(lines); err != nil {
		return nil, err
	}
	if date == "" {
		date = time.Now().UTC().Format("2006-01-02")
	}
	lineAny := make([]any, 0, len(lines))
	for _, l := range lines {
		lineAny = append(lineAny, map[string]any{
			"account": strings.TrimSpace(l.Account),
			"debit":   money.RoundMoney(l.Debit),
			"credit":  money.RoundMoney(l.Credit),
		})
	}
	return s.store.Create(ColJournals, models.Record{
		"date":      date,
		"narration": narration,
		"lines":     lineAny,
		"source":    "manual",
		"createdAt": time.Now().UTC().Format(time.RFC3339),
	})
}

func (s *AccountingService) buildLedger(journals []models.Record) []map[string]any {
	type agg struct{ debit, credit money.Paise }
	m := map[string]*agg{}
	for _, j := range journals {
		raw, _ := j["lines"].([]any)
		for _, item := range raw {
			lm, _ := item.(map[string]any)
			if lm == nil {
				continue
			}
			acct := fmt.Sprint(lm["account"])
			a := m[acct]
			if a == nil {
				a = &agg{}
				m[acct] = a
			}
			a.debit += money.FromRupees(asFloat64(lm["debit"]))
			a.credit += money.FromRupees(asFloat64(lm["credit"]))
		}
	}
	out := make([]map[string]any, 0, len(m))
	for acct, a := range m {
		out = append(out, map[string]any{
			"account": acct,
			"debit":   a.debit.Rupees(),
			"credit":  a.credit.Rupees(),
			"balance": money.RoundMoney(a.debit.Rupees() - a.credit.Rupees()),
		})
	}
	return out
}

func (s *AccountingService) Statements() map[string]any {
	journals := s.ListJournals()
	ledger := s.buildLedger(journals)
	var totalDebit, totalCredit money.Paise
	for _, r := range ledger {
		totalDebit += money.FromRupees(asFloat64(r["debit"]))
		totalCredit += money.FromRupees(asFloat64(r["credit"]))
	}
	trial := map[string]any{
		"rows":        ledger,
		"totalDebit":  totalDebit.Rupees(),
		"totalCredit": totalCredit.Rupees(),
		"balanced":    totalDebit == totalCredit,
	}

	var revenue, expenses money.Paise
	for _, r := range ledger {
		acct := fmt.Sprint(r["account"])
		deb := money.FromRupees(asFloat64(r["debit"]))
		cred := money.FromRupees(asFloat64(r["credit"]))
		if reRevenue.MatchString(acct) {
			if cred > deb {
				revenue += cred - deb
			}
		}
		if reExpense.MatchString(acct) {
			if deb > cred {
				expenses += deb - cred
			}
		}
	}
	pnl := map[string]any{
		"revenue":  revenue.Rupees(),
		"expenses": expenses.Rupees(),
		"profit":   money.RoundMoney(revenue.Rupees() - expenses.Rupees()),
	}

	var assets, liabilities money.Paise
	for _, r := range ledger {
		acct := fmt.Sprint(r["account"])
		bal := money.FromRupees(asFloat64(r["balance"]))
		if reAsset.MatchString(acct) && bal > 0 {
			assets += bal
		}
		if reLiability.MatchString(acct) && bal < 0 {
			liabilities += -bal
		}
	}
	equity := assets - liabilities
	balance := map[string]any{
		"assets":           assets.Rupees(),
		"liabilities":      liabilities.Rupees(),
		"equity":           equity.Rupees(),
		"retainedEarnings": pnl["profit"],
		"balanced":         assets == liabilities+equity,
	}

	return map[string]any{
		"journals": journals,
		"ledger":   ledger,
		"trial":    trial,
		"pnl":      pnl,
		"balance":  balance,
	}
}

func asFloat64(v any) float64 {
	switch t := v.(type) {
	case float64:
		return t
	case float32:
		return float64(t)
	case int:
		return float64(t)
	case int64:
		return float64(t)
	default:
		return 0
	}
}
