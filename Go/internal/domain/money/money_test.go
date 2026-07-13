package money_test

import (
	"testing"

	"github.com/JagtapAvadhut/smartca-backend/internal/domain/money"
)

func TestComputeInvoiceTax_MatchesFrontend(t *testing.T) {
	tax := money.ComputeInvoiceTax(100000, 0, 0, false)
	if tax.Taxable != 100000 {
		t.Fatalf("taxable: got %v want 100000", tax.Taxable)
	}
	if tax.Tax != 18000 {
		t.Fatalf("tax: got %v want 18000", tax.Tax)
	}
	if tax.CGST != 9000 {
		t.Fatalf("cgst: got %v want 9000", tax.CGST)
	}
	if tax.SGST != 9000 {
		t.Fatalf("sgst: got %v want 9000", tax.SGST)
	}
	if tax.IGST != 0 {
		t.Fatalf("igst: got %v want 0", tax.IGST)
	}
	if tax.Total != 118000 {
		t.Fatalf("total: got %v want 118000", tax.Total)
	}
}
