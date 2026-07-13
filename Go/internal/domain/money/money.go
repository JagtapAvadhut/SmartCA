// Package money provides decimal-safe INR calculations.
// Authoritative unit is integer paise; JSON APIs expose rupees for frontend compatibility.
package money

import (
	"math"
	"time"
)

type Paise int64

func FromRupees(r float64) Paise {
	return Paise(math.Round(r * 100))
}

func (p Paise) Rupees() float64 {
	return float64(p) / 100
}

// RoundMoney mirrors frontend Math.round(n * 100) / 100.
func RoundMoney(n float64) float64 {
	return math.Round(n*100) / 100
}

type InvoiceTax struct {
	Taxable  float64
	CGST     float64
	SGST     float64
	IGST     float64
	Tax      float64
	Total    float64
	Discount float64
	RoundOff float64
}

// ComputeInvoiceTax matches src/utils/money.ts computeInvoiceTax.
func ComputeInvoiceTax(subtotal, discount, roundOff float64, useIGST bool) InvoiceTax {
	d := RoundMoney(discount)
	taxable := math.Max(0, RoundMoney(subtotal)-d)
	tax := math.Round(taxable * 0.18) // integer rupees, matching frontend
	var cgst, sgst, igst float64
	if useIGST {
		igst = tax
	} else {
		cgst = tax / 2
		sgst = tax / 2
	}
	ro := RoundMoney(roundOff)
	total := RoundMoney(taxable + tax + ro)
	return InvoiceTax{
		Taxable: taxable, CGST: cgst, SGST: sgst, IGST: igst,
		Tax: tax, Total: total, Discount: d, RoundOff: ro,
	}
}

func InvoiceRemaining(total, paid float64) float64 {
	return math.Max(0, RoundMoney(total)-RoundMoney(paid))
}

func IsOutstandingStatus(status string) bool {
	switch status {
	case "sent", "partially_paid", "overdue":
		return true
	default:
		return false
	}
}

func DeriveInvoiceStatus(current, dueDate string, total, paid float64, now time.Time) string {
	if current == "cancelled" || current == "draft" {
		return current
	}
	t := RoundMoney(total)
	p := RoundMoney(paid)
	if p <= 0 {
		if dueDate != "" {
			if due, err := time.Parse("2006-01-02", dueDate[:min(10, len(dueDate))]); err == nil {
				if due.Before(now.Truncate(24 * time.Hour)) {
					return "overdue"
				}
			}
		}
		return "sent"
	}
	if p >= t && t > 0 {
		return "paid"
	}
	return "partially_paid"
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
