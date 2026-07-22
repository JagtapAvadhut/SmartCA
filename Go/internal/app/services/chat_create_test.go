package services_test

import (
	"fmt"
	"sync"
	"testing"

	"github.com/JagtapAvadhut/smartca-backend/internal/app/services"
	"github.com/JagtapAvadhut/smartca-backend/internal/domain/models"
	"github.com/JagtapAvadhut/smartca-backend/internal/repository"
	"github.com/JagtapAvadhut/smartca-backend/internal/repository/memory"
	"github.com/google/uuid"
)

func TestChatServiceCreateIgnoresClientID(t *testing.T) {
	store := repository.AdaptMemory(memory.NewStore())
	svc := services.NewCRUDService(store, services.ColChat)
	rec, err := svc.Create(models.Record{
		"id":       "CHAT-0011",
		"title":    "New conversation",
		"messages": []any{},
	})
	if err != nil {
		t.Fatal(err)
	}
	if rec.ID() == "CHAT-0011" {
		t.Fatal("client id was accepted")
	}
	if _, err := uuid.Parse(rec.ID()); err != nil {
		t.Fatalf("expected uuid got %s", rec.ID())
	}
}

func TestChatServiceConcurrentCreate(t *testing.T) {
	store := repository.AdaptMemory(memory.NewStore())
	svc := services.NewCRUDService(store, services.ColChat)
	const n = 100
	ids := make(chan string, n)
	errCh := make(chan error, n)
	var wg sync.WaitGroup
	for i := 0; i < n; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			rec, err := svc.Create(models.Record{
				"title":    fmt.Sprintf("chat-%d", i),
				"messages": []any{},
			})
			if err != nil {
				errCh <- err
				return
			}
			ids <- rec.ID()
		}(i)
	}
	wg.Wait()
	close(ids)
	close(errCh)
	for err := range errCh {
		t.Fatal(err)
	}
	seen := map[string]struct{}{}
	for id := range ids {
		if _, ok := seen[id]; ok {
			t.Fatalf("duplicate %s", id)
		}
		seen[id] = struct{}{}
	}
	if len(seen) != n {
		t.Fatalf("got %d unique", len(seen))
	}
}
