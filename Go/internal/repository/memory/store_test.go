package memory

import (
	"errors"
	"fmt"
	"sync"
	"testing"

	"github.com/JagtapAvadhut/smartca-backend/internal/domain/models"
)

func TestConcurrentReads(t *testing.T) {
	s := NewStore()
	for i := 0; i < 50; i++ {
		_, err := s.Create("clients", models.Record{
			"id":   fmt.Sprintf("CLT-%04d", i+1),
			"name": fmt.Sprintf("Client %d", i+1),
		})
		if err != nil {
			t.Fatal(err)
		}
	}

	var wg sync.WaitGroup
	errCh := make(chan error, 100)
	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			page := s.List("clients", models.Query{Page: 1, PageSize: 20})
			if page.Total != 50 {
				errCh <- fmt.Errorf("total=%d", page.Total)
				return
			}
			r, err := s.Get("clients", "CLT-0001")
			if err != nil || r.GetString("name") == "" {
				errCh <- fmt.Errorf("get failed: %v", err)
			}
			_ = s.Count("clients", false)
		}()
	}
	wg.Wait()
	close(errCh)
	for err := range errCh {
		t.Error(err)
	}
}

func TestCreateUpdateArchiveRestore(t *testing.T) {
	s := NewStore()
	created, err := s.Create("clients", models.Record{"name": "Acme"})
	if err != nil {
		t.Fatal(err)
	}
	id := created.ID()
	if id == "" {
		t.Fatal("expected generated id")
	}

	updated, err := s.Update("clients", id, models.Record{"name": "Acme Pvt Ltd", "city": "Pune"})
	if err != nil {
		t.Fatal(err)
	}
	if updated.GetString("name") != "Acme Pvt Ltd" {
		t.Fatalf("name=%q", updated.GetString("name"))
	}

	// Mutating returned clone must not affect store.
	updated.Set("name", "Hacked")
	got, _ := s.Get("clients", id)
	if got.GetString("name") != "Acme Pvt Ltd" {
		t.Fatal("store mutated via returned clone")
	}

	if err := s.Archive("clients", id); err != nil {
		t.Fatal(err)
	}
	page := s.List("clients", models.Query{})
	if page.Total != 0 {
		t.Fatalf("archived should be hidden, total=%d", page.Total)
	}
	page = s.List("clients", models.Query{IncludeArchived: true})
	if page.Total != 1 {
		t.Fatalf("include archived total=%d", page.Total)
	}

	if err := s.Restore("clients", id); err != nil {
		t.Fatal(err)
	}
	page = s.List("clients", models.Query{})
	if page.Total != 1 {
		t.Fatalf("after restore total=%d", page.Total)
	}
}

func TestWithTxRollback(t *testing.T) {
	s := NewStore()
	_, err := s.Create("clients", models.Record{"id": "CLT-0001", "name": "Keep"})
	if err != nil {
		t.Fatal(err)
	}

	boom := errors.New("boom")
	err = s.WithTx(func(tx *Store) error {
		if _, err := tx.Create("clients", models.Record{"id": "CLT-0002", "name": "Temp"}); err != nil {
			return err
		}
		if _, err := tx.Update("clients", "CLT-0001", models.Record{"name": "Changed"}); err != nil {
			return err
		}
		return boom
	})
	if !errors.Is(err, boom) {
		t.Fatalf("expected boom, got %v", err)
	}

	if s.Exists("clients", "CLT-0002") {
		t.Fatal("CLT-0002 should have been rolled back")
	}
	got, err := s.Get("clients", "CLT-0001")
	if err != nil {
		t.Fatal(err)
	}
	if got.GetString("name") != "Keep" {
		t.Fatalf("name rolled back incorrectly: %q", got.GetString("name"))
	}
}

func TestWithTxCommit(t *testing.T) {
	s := NewStore()
	err := s.WithTx(func(tx *Store) error {
		if _, err := tx.Create("invoices", models.Record{"id": "INV-00001", "clientId": "CLT-1", "total": 100.0}); err != nil {
			return err
		}
		if _, err := tx.Create("payments", models.Record{"id": "PAY-00001", "invoiceId": "INV-00001", "amount": 100.0}); err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	if !s.Exists("invoices", "INV-00001") || !s.Exists("payments", "PAY-00001") {
		t.Fatal("expected committed records")
	}
}

func TestListPaginationAndSearch(t *testing.T) {
	s := NewStore()
	for i := 1; i <= 60; i++ {
		name := fmt.Sprintf("Client %02d", i)
		if i%10 == 0 {
			name = fmt.Sprintf("Special %02d", i)
		}
		_, err := s.Create("clients", models.Record{
			"id":   fmt.Sprintf("CLT-%04d", i),
			"name": name,
			"city": "Mumbai",
		})
		if err != nil {
			t.Fatal(err)
		}
	}

	page := s.List("clients", models.Query{Page: 1, PageSize: 10})
	if page.Total != 60 || len(page.Data) != 10 || page.TotalPages != 6 {
		t.Fatalf("page1: %+v len=%d", page, len(page.Data))
	}

	page = s.List("clients", models.Query{Page: 6, PageSize: 10})
	if len(page.Data) != 10 {
		t.Fatalf("page6 len=%d", len(page.Data))
	}

	page = s.List("clients", models.Query{
		Search:       "Special",
		SearchFields: []string{"name"},
		Page:         1,
		PageSize:     50,
	})
	if page.Total != 6 {
		t.Fatalf("search total=%d", page.Total)
	}

	page = s.List("clients", models.Query{
		Filters:  map[string]any{"city": "Mumbai"},
		SortBy:   "name",
		SortDir:  "asc",
		Page:     1,
		PageSize: 5,
	})
	if page.Total != 60 || len(page.Data) != 5 {
		t.Fatalf("filter/sort: total=%d len=%d", page.Total, len(page.Data))
	}
	if page.Data[0].GetString("name") > page.Data[1].GetString("name") {
		t.Fatal("expected ascending name sort")
	}

	// pageSize capped at 200
	page = s.List("clients", models.Query{Page: 1, PageSize: 500})
	if page.PageSize != 200 {
		t.Fatalf("pageSize cap: %d", page.PageSize)
	}
}

func TestResetAndSnapshot(t *testing.T) {
	s := NewStore()
	s.Reset(map[string][]models.Record{
		"clients": {
			{"id": "CLT-0001", "name": "A"},
			{"id": "CLT-0002", "name": "B"},
		},
	})
	snap := s.Snapshot()
	if len(snap["clients"]) != 2 {
		t.Fatalf("snap len=%d", len(snap["clients"]))
	}
	s.CreateSession(Session{ID: "S1", UserID: "U1", Active: true})
	s.Reset(snap)
	if _, ok := s.GetSession("S1"); ok {
		t.Fatal("sessions should clear on Reset")
	}
	if s.Count("clients", true) != 2 {
		t.Fatal("reset from snapshot failed")
	}
}
