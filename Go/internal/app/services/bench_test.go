package services_test

import (
	"fmt"
	"testing"

	"github.com/JagtapAvadhut/smartca-backend/internal/app/services"
	"github.com/JagtapAvadhut/smartca-backend/internal/domain/models"
	"github.com/JagtapAvadhut/smartca-backend/internal/repository"
	"github.com/JagtapAvadhut/smartca-backend/internal/repository/memory"
	"github.com/JagtapAvadhut/smartca-backend/internal/seed"
)

func seedStore(b *testing.B) repository.Store {
	b.Helper()
	data, err := seed.LoadSeed()
	if err != nil {
		b.Fatal(err)
	}
	st := memory.NewStore()
	st.Reset(data)
	return repository.AdaptMemory(st)
}

func BenchmarkDashboard(b *testing.B) {
	st := seedStore(b)
	svc := services.NewDashboardService(st)
	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = svc.Get()
	}
}

func BenchmarkClientList(b *testing.B) {
	st := seedStore(b)
	svc := services.NewCRUDService(st, services.ColClients)
	q := models.Query{Page: 1, PageSize: 20, Search: "info", SortBy: "name", SortDir: "asc"}
	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = svc.List(q)
	}
}

func BenchmarkPaymentCreate(b *testing.B) {
	store := seedStore(b)
	pay := services.NewPaymentService(store)
	invSvc := services.NewInvoiceService(store)
	clients := store.GetAll(services.ColClients, false)
	if len(clients) == 0 {
		b.Fatal("no clients")
	}
	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		b.StopTimer()
		inv, err := invSvc.Create(models.Record{
			"clientId": clients[0].ID(), "clientName": clients[0].GetString("name"),
			"subtotal": 1000.0, "status": "sent",
		})
		if err != nil {
			b.Fatal(err)
		}
		b.StartTimer()
		_, err = pay.Create(models.Record{
			"invoiceId": inv.ID(), "clientId": clients[0].ID(),
			"amount": 100.0, "reference": fmt.Sprintf("BENCH-%d", i), "status": "completed",
		})
		if err != nil {
			b.Fatal(err)
		}
	}
}
