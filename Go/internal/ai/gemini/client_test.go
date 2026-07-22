package gemini_test

import (
	"errors"
	"testing"

	"github.com/JagtapAvadhut/smartca-backend/internal/ai/gemini"
)

func TestFallbackModelsPreferLatestAliases(t *testing.T) {
	m := gemini.FallbackModels()
	if len(m) < 2 {
		t.Fatalf("expected flash+pro aliases, got %v", m)
	}
	if m[0] != "gemini-flash-latest" {
		t.Fatalf("expected gemini-flash-latest first, got %s", m[0])
	}
	if gemini.ResolveDefaultModel(m) != "gemini-flash-latest" {
		t.Fatal(gemini.ResolveDefaultModel(m))
	}
}

func TestResolveDefaultModelPrefersFlashLatest(t *testing.T) {
	got := gemini.ResolveDefaultModel([]string{"gemini-pro-latest", "gemini-flash-latest"})
	if got != "gemini-flash-latest" {
		t.Fatalf("got %s", got)
	}
}

func TestNewClientRequiresAPIKey(t *testing.T) {
	_, err := gemini.NewClient(gemini.Config{})
	if !errors.Is(err, gemini.ErrNotConfigured) {
		t.Fatalf("got %v", err)
	}
	c, err := gemini.NewClient(gemini.Config{APIKey: "test-key"})
	if err != nil {
		t.Fatal(err)
	}
	if c.Model() != "gemini-flash-latest" {
		t.Fatalf("default model %s", c.Model())
	}
}
