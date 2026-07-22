package ai_test

import (
	"testing"

	"github.com/JagtapAvadhut/smartca-backend/internal/ai"
	"github.com/JagtapAvadhut/smartca-backend/internal/config"
	"github.com/JagtapAvadhut/smartca-backend/internal/repository"
	"github.com/JagtapAvadhut/smartca-backend/internal/repository/memory"
)

func TestEffectiveEnvProviderPromotesMockWhenGeminiKeyPresent(t *testing.T) {
	cfg := config.Config{AIProvider: "mock", GeminiAPIKey: "test-key", GeminiModel: "gemini-flash-latest"}
	if got := ai.EffectiveEnvProvider(cfg); got != "gemini" {
		t.Fatalf("got %s", got)
	}
	cfg2 := config.Config{AIProvider: "mock", GeminiAPIKey: ""}
	if got := ai.EffectiveEnvProvider(cfg2); got != "mock" {
		t.Fatalf("got %s", got)
	}
}

func TestRuntimeUsesEnvGeminiWhenDBEmpty(t *testing.T) {
	store := repository.AdaptMemory(memory.NewStore())
	cfg := config.Config{
		AIProvider:   "mock",
		GeminiAPIKey: "unit-test-key-not-called",
		GeminiModel:  "gemini-flash-latest",
		DBPassword:   "unit",
	}
	rt, err := ai.NewRuntime(cfg, store)
	if err != nil {
		t.Fatal(err)
	}
	if rt.Provider().Name() != "gemini" {
		t.Fatalf("provider=%s", rt.Provider().Name())
	}
	pub := rt.GetSettings()
	if pub.Provider != "gemini" || !pub.HasAPIKey {
		t.Fatalf("%+v", pub)
	}
}

func TestRuntimeExplicitMockBlocksEnvGemini(t *testing.T) {
	store := repository.AdaptMemory(memory.NewStore())
	cfg := config.Config{
		AIProvider:   "gemini",
		GeminiAPIKey: "unit-test-key",
		GeminiModel:  "gemini-flash-latest",
		DBPassword:   "unit",
	}
	rt, err := ai.NewRuntime(cfg, store)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := rt.RemoveSettings(); err != nil {
		t.Fatal(err)
	}
	if rt.Provider().Name() != "mock" {
		t.Fatalf("expected explicit mock after remove, got %s", rt.Provider().Name())
	}
}
