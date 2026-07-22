package ollama_test

import (
	"testing"

	"github.com/JagtapAvadhut/smartca-backend/internal/ai/ollama"
)

func TestNewClientDefaults(t *testing.T) {
	c, err := ollama.NewClient(ollama.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if c.Name() != "ollama" {
		t.Fatal(c.Name())
	}
}
