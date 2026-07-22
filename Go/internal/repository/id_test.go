package repository_test

import (
	"testing"

	"github.com/JagtapAvadhut/smartca-backend/internal/repository"
	"github.com/google/uuid"
)

func TestNewUniqueIDIsUUID(t *testing.T) {
	seen := map[string]struct{}{}
	for i := 0; i < 200; i++ {
		id := repository.NewUniqueID()
		if _, err := uuid.Parse(id); err != nil {
			t.Fatalf("%q: %v", id, err)
		}
		if _, ok := seen[id]; ok {
			t.Fatalf("duplicate %s", id)
		}
		seen[id] = struct{}{}
	}
}

func TestUsesServerUniqueIDsChatOnly(t *testing.T) {
	if !repository.UsesServerUniqueIDs("chat") {
		t.Fatal("chat should use unique ids")
	}
	if repository.UsesServerUniqueIDs("clients") {
		t.Fatal("clients should keep sequential ids")
	}
}
