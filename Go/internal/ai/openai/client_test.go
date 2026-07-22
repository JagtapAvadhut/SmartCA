package openai_test

import (
	"errors"
	"testing"

	"github.com/JagtapAvadhut/smartca-backend/internal/ai/openai"
)

func TestNewClientRequiresKey(t *testing.T) {
	_, err := openai.NewClient(openai.Config{})
	if !errors.Is(err, openai.ErrNotConfigured) {
		t.Fatalf("got %v", err)
	}
}

func TestNewClientDefaults(t *testing.T) {
	c, err := openai.NewClient(openai.Config{APIKey: "sk-test"})
	if err != nil {
		t.Fatal(err)
	}
	if c.Name() != "openai" {
		t.Fatal(c.Name())
	}
}
