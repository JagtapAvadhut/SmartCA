package ai_test

import (
	"context"
	"strings"
	"testing"

	"github.com/JagtapAvadhut/smartca-backend/internal/ai"
	"github.com/JagtapAvadhut/smartca-backend/internal/config"
	"github.com/JagtapAvadhut/smartca-backend/internal/repository"
	"github.com/JagtapAvadhut/smartca-backend/internal/repository/memory"
)

func TestNormalizeProviderRejectsUnknown(t *testing.T) {
	_, err := ai.NormalizeProvider("not-a-provider")
	if err == nil {
		t.Fatal("expected error")
	}
	p, err := ai.NormalizeProvider("Google Gemini")
	if err != nil || p != "gemini" {
		t.Fatalf("%q %v", p, err)
	}
}

func TestProviderSwitchClearsForeignAPIKey(t *testing.T) {
	store := repository.AdaptMemory(memory.NewStore())
	cfg := config.Config{DBPassword: "unit", GeminiAPIKey: ""}
	rt, err := ai.NewRuntime(cfg, store)
	if err != nil {
		t.Fatal(err)
	}
	// Seed a mock setting first.
	if _, err := rt.SaveSettings(ai.SaveSettingsInput{Provider: "mock", Model: "mock"}); err != nil {
		t.Fatal(err)
	}
	// Saving gemini without a key and without env key must fail — must NOT silently stay mock.
	_, err = rt.SaveSettings(ai.SaveSettingsInput{Provider: "gemini", Model: "gemini-flash-latest", APIKey: ""})
	if err == nil {
		t.Fatal("expected gemini save without key to fail")
	}
	got := rt.GetSettings()
	if got.Provider != "mock" {
		t.Fatalf("provider should remain mock until valid save, got %s", got.Provider)
	}
}

func TestSaveGeminiPersistsProvider(t *testing.T) {
	store := repository.AdaptMemory(memory.NewStore())
	cfg := config.Config{DBPassword: "unit", GeminiAPIKey: "test-key-not-called"}
	rt, err := ai.NewRuntime(cfg, store)
	if err != nil {
		t.Fatal(err)
	}
	pub, err := rt.SaveSettings(ai.SaveSettingsInput{
		Provider: "gemini",
		Model:    "gemini-flash-latest",
		APIKey:   "AIzaSyTestKeyForUnitOnly123456",
	})
	if err != nil {
		t.Fatal(err)
	}
	if pub.Provider != "gemini" {
		t.Fatalf("got provider %s", pub.Provider)
	}
	if !pub.HasAPIKey || pub.APIKeyMasked == "" {
		t.Fatalf("expected masked key: %+v", pub)
	}
	if strings.Contains(pub.APIKeyMasked, "TestKeyForUnit") {
		t.Fatal("raw key leaked")
	}
	reload := rt.GetSettings()
	if reload.Provider != "gemini" || reload.Model != "gemini-flash-latest" {
		t.Fatalf("%+v", reload)
	}
	if rt.Provider().Name() != "gemini" {
		t.Fatal(rt.Provider().Name())
	}
}

func TestTestConnectionMockOK(t *testing.T) {
	store := repository.AdaptMemory(memory.NewStore())
	rt, _ := ai.NewRuntime(config.Config{DBPassword: "unit"}, store)
	res, err := rt.TestConnection(context.Background(), ai.TestSettingsInput{Provider: "mock", Model: "mock"})
	if err != nil {
		t.Fatal(err)
	}
	if res == nil || !res.OK || res.Message != "Connected" {
		t.Fatalf("%+v", res)
	}
}

func TestSuggestedModelsUseLatestAliases(t *testing.T) {
	m := ai.SuggestedModels()
	if m.Gemini[0] != "gemini-flash-latest" {
		t.Fatalf("%v", m.Gemini)
	}
}
