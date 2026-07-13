package services_test

import (
	"fmt"
	"sync"
	"sync/atomic"
	"testing"

	"github.com/JagtapAvadhut/smartca-backend/internal/app/services"
	"github.com/JagtapAvadhut/smartca-backend/internal/domain/models"
	"github.com/JagtapAvadhut/smartca-backend/internal/domain/money"
	"github.com/JagtapAvadhut/smartca-backend/internal/repository/memory"
)

func setupFinancialStore(t *testing.T) (*memory.Store, string, string) {
	t.Helper()
	store := memory.NewStore()
	client, err := store.Create(services.ColClients, models.Record{
		"id": "CLT-TEST", "name": "Test Client", "status": "active",
		"revenue": 0.0, "outstanding": 0.0,
	})
	if err != nil {
		t.Fatal(err)
	}
	tax := money.ComputeInvoiceTax(100000, 0, 0, false)
	inv, err := store.Create(services.ColInvoices, models.Record{
		"id": "INV-TEST", "invoiceNumber": "SCA/TEST/0001",
		"clientId": client.ID(), "clientName": "Test Client",
		"status": "sent", "subtotal": 100000.0,
		"discount": 0.0, "roundOff": 0.0,
		"cgst": tax.CGST, "sgst": tax.SGST, "igst": tax.IGST,
		"total": tax.Total, "paidAmount": 0.0, "remainingAmount": tax.Total,
		"dueDate": "2099-12-31", "issueDate": "2025-01-01",
	})
	if err != nil {
		t.Fatal(err)
	}
	return store, client.ID(), inv.ID()
}

func TestPaymentFinancialChain(t *testing.T) {
	store, clientID, invID := setupFinancialStore(t)
	paySvc := services.NewPaymentService(store)

	tax := money.ComputeInvoiceTax(100000, 0, 0, false)
	if tax.Total != 118000 {
		t.Fatalf("expected invoice total 118000, got %v (tax=%v cgst=%v sgst=%v)", tax.Total, tax.Tax, tax.CGST, tax.SGST)
	}

	p1, err := paySvc.Create(models.Record{
		"invoiceId": invID, "clientId": clientID, "amount": 30000.0,
		"reference": "TXN-P1", "status": "completed",
	})
	if err != nil {
		t.Fatalf("payment 30000: %v", err)
	}

	inv, _ := store.Get(services.ColInvoices, invID)
	if money.RoundMoney(inv.GetFloat("paidAmount")) != 30000 {
		t.Fatalf("after p1 paidAmount=%v want 30000", inv.GetFloat("paidAmount"))
	}
	if inv.GetString("status") != "partially_paid" {
		t.Fatalf("after p1 status=%s want partially_paid", inv.GetString("status"))
	}
	if money.RoundMoney(inv.GetFloat("remainingAmount")) != 88000 {
		t.Fatalf("after p1 remaining=%v want 88000", inv.GetFloat("remainingAmount"))
	}

	p2, err := paySvc.Create(models.Record{
		"invoiceId": invID, "clientId": clientID, "amount": 70000.0,
		"reference": "TXN-P2", "status": "completed",
	})
	if err != nil {
		t.Fatalf("payment 70000: %v", err)
	}

	inv, _ = store.Get(services.ColInvoices, invID)
	if money.RoundMoney(inv.GetFloat("paidAmount")) != 100000 {
		t.Fatalf("after p2 paidAmount=%v want 100000", inv.GetFloat("paidAmount"))
	}
	// 100000 paid of 118000 total → still partially_paid
	if inv.GetString("status") != "partially_paid" {
		t.Fatalf("after p2 status=%s want partially_paid", inv.GetString("status"))
	}

	// Final 18000 to fully pay
	_, err = paySvc.Create(models.Record{
		"invoiceId": invID, "clientId": clientID, "amount": 18000.0,
		"reference": "TXN-P3", "status": "completed",
	})
	if err != nil {
		t.Fatalf("payment 18000: %v", err)
	}
	inv, _ = store.Get(services.ColInvoices, invID)
	if inv.GetString("status") != "paid" {
		t.Fatalf("after full pay status=%s want paid", inv.GetString("status"))
	}
	if money.RoundMoney(inv.GetFloat("remainingAmount")) != 0 {
		t.Fatalf("remaining=%v want 0", inv.GetFloat("remainingAmount"))
	}

	client, _ := store.Get(services.ColClients, clientID)
	if money.RoundMoney(client.GetFloat("revenue")) != 118000 {
		t.Fatalf("client revenue=%v want 118000", client.GetFloat("revenue"))
	}
	if money.RoundMoney(client.GetFloat("outstanding")) != 0 {
		t.Fatalf("client outstanding=%v want 0", client.GetFloat("outstanding"))
	}

	// Delete p2 (70000) → rollback invoice financials
	if err := paySvc.Delete(p2.ID()); err != nil {
		t.Fatalf("delete p2: %v", err)
	}
	inv, _ = store.Get(services.ColInvoices, invID)
	wantPaid := money.RoundMoney(30000 + 18000)
	if money.RoundMoney(inv.GetFloat("paidAmount")) != wantPaid {
		t.Fatalf("after delete paidAmount=%v want %v", inv.GetFloat("paidAmount"), wantPaid)
	}
	if inv.GetString("status") == "paid" {
		t.Fatal("status should not remain paid after deleting 70000 payment")
	}

	client, _ = store.Get(services.ColClients, clientID)
	if money.RoundMoney(client.GetFloat("revenue")) != 0 {
		t.Fatalf("after delete client revenue=%v want 0 (invoice not paid)", client.GetFloat("revenue"))
	}

	_ = p1
}

func TestPaymentOverpayRejected(t *testing.T) {
	store, clientID, invID := setupFinancialStore(t)
	paySvc := services.NewPaymentService(store)
	_, err := paySvc.Create(models.Record{
		"invoiceId": invID, "clientId": clientID, "amount": 200000.0, "reference": "TXN-OVER",
	})
	if err == nil {
		t.Fatal("expected overpayment to fail")
	}
}

func TestConcurrentPaymentsRaceSafe(t *testing.T) {
	store, clientID, invID := setupFinancialStore(t)
	paySvc := services.NewPaymentService(store)

	const n = 20
	var okCount atomic.Int32
	var wg sync.WaitGroup
	wg.Add(n)
	for i := 0; i < n; i++ {
		i := i
		go func() {
			defer wg.Done()
			_, err := paySvc.Create(models.Record{
				"invoiceId": invID,
				"clientId":  clientID,
				"amount":    10000.0,
				"reference": fmt.Sprintf("TXN-RACE-%d", i),
				"status":    "completed",
			})
			if err == nil {
				okCount.Add(1)
			}
		}()
	}
	wg.Wait()

	// Invoice total 118000 → max 11 payments of 10000 (110000), 12th would leave 8000
	// So at most 11 full 10000 payments succeed; 12th of 10000 should fail overpay.
	// Actually remaining starts 118000, so floor(118000/10000)=11 succeed, and maybe one more fails.
	if okCount.Load() > 11 {
		t.Fatalf("too many concurrent payments succeeded: %d (max 11 of ₹10000 into ₹118000)", okCount.Load())
	}
	if okCount.Load() < 11 {
		t.Fatalf("expected 11 successful payments, got %d", okCount.Load())
	}

	inv, _ := store.Get(services.ColInvoices, invID)
	paid := money.RoundMoney(inv.GetFloat("paidAmount"))
	if paid != 110000 {
		t.Fatalf("paidAmount=%v want 110000", paid)
	}
	if paid > money.RoundMoney(inv.GetFloat("total")) {
		t.Fatalf("overpaid: paid %v > total %v", paid, inv.GetFloat("total"))
	}
}
