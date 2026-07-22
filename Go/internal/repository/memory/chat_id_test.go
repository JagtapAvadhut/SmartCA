package memory_test

import (
	"fmt"
	"sync"
	"testing"

	"github.com/JagtapAvadhut/smartca-backend/internal/domain/models"
	"github.com/JagtapAvadhut/smartca-backend/internal/repository/memory"
	"github.com/google/uuid"
)

func TestChatCreateUsesUUIDNotSequential(t *testing.T) {
	s := memory.NewStore()
	// Seed legacy sequential IDs (same shape as production seed).
	for i := 1; i <= 10; i++ {
		_, err := s.Create("chat", models.Record{
			"id":       fmt.Sprintf("CHAT-%03d", i),
			"title":    fmt.Sprintf("Seed %d", i),
			"messages": []any{},
		})
		if err != nil {
			t.Fatal(err)
		}
	}

	created, err := s.Create("chat", models.Record{
		"title":    "New conversation",
		"messages": []any{},
	})
	if err != nil {
		t.Fatal(err)
	}
	id := created.ID()
	if id == "" || id == "CHAT-0011" || len(id) < 30 {
		t.Fatalf("expected UUID, got %q", id)
	}
	if _, err := uuid.Parse(id); err != nil {
		t.Fatalf("not a UUID: %q (%v)", id, err)
	}

	// Creating again must never collide with sequential scheme.
	seen := map[string]struct{}{id: {}}
	for i := 0; i < 50; i++ {
		rec, err := s.Create("chat", models.Record{"title": "n", "messages": []any{}})
		if err != nil {
			t.Fatalf("create %d: %v", i, err)
		}
		if _, dup := seen[rec.ID()]; dup {
			t.Fatalf("duplicate id %s", rec.ID())
		}
		if _, err := uuid.Parse(rec.ID()); err != nil {
			t.Fatalf("expected uuid got %s", rec.ID())
		}
		seen[rec.ID()] = struct{}{}
	}
}

func TestChatConcurrentCreatesUnique(t *testing.T) {
	s := memory.NewStore()
	const n = 100
	ids := make([]string, n)
	errCh := make(chan error, n)
	var wg sync.WaitGroup
	for i := 0; i < n; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			rec, err := s.Create("chat", models.Record{
				"title":    fmt.Sprintf("concurrent-%d", i),
				"messages": []any{},
			})
			if err != nil {
				errCh <- err
				return
			}
			ids[i] = rec.ID()
		}(i)
	}
	wg.Wait()
	close(errCh)
	for err := range errCh {
		t.Fatal(err)
	}
	seen := map[string]struct{}{}
	for _, id := range ids {
		if id == "" {
			t.Fatal("empty id")
		}
		if _, ok := seen[id]; ok {
			t.Fatalf("duplicate concurrent id %s", id)
		}
		seen[id] = struct{}{}
		if _, err := uuid.Parse(id); err != nil {
			t.Fatalf("invalid uuid %s", id)
		}
	}
	if s.Count("chat", false) != n {
		t.Fatalf("count=%d", s.Count("chat", false))
	}
}

func TestChatDeleteDoesNotAffectOthers(t *testing.T) {
	s := memory.NewStore()
	a, _ := s.Create("chat", models.Record{"title": "A", "messages": []any{}})
	b, _ := s.Create("chat", models.Record{"title": "B", "messages": []any{}})
	if err := s.PermanentDelete("chat", a.ID()); err != nil {
		t.Fatal(err)
	}
	got, err := s.Get("chat", b.ID())
	if err != nil || got.GetString("title") != "B" {
		t.Fatalf("other chat affected: %v %+v", err, got)
	}
	if _, err := s.Get("chat", a.ID()); err == nil {
		t.Fatal("deleted chat still present")
	}
}
