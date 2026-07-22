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

func TestEncryptDecryptMask(t *testing.T) {
	cfg := config.Config{DBPassword: "test-secret"}
	enc, err := ai.EncryptAPIKey(cfg, "sk-test-1234567890")
	if err != nil || enc == "" {
		t.Fatalf("encrypt: %v %q", err, enc)
	}
	if strings.Contains(enc, "sk-test") {
		t.Fatal("ciphertext leaked plaintext")
	}
	plain, err := ai.DecryptAPIKey(cfg, enc)
	if err != nil || plain != "sk-test-1234567890" {
		t.Fatalf("decrypt: %v %q", err, plain)
	}
	masked := ai.MaskAPIKey(plain)
	if masked == plain || !strings.Contains(masked, "•") {
		t.Fatalf("mask failed: %q", masked)
	}
}

func TestRuntimeSaveLoadMock(t *testing.T) {
	store := repository.AdaptMemory(memory.NewStore())
	cfg := config.Config{AIProvider: "mock", DBPassword: "unit"}
	rt, err := ai.NewRuntime(cfg, store)
	if err != nil {
		t.Fatal(err)
	}
	pub, err := rt.SaveSettings(ai.SaveSettingsInput{Provider: "mock", Model: "mock"})
	if err != nil {
		t.Fatal(err)
	}
	if pub.Provider != "mock" {
		t.Fatalf("got %+v", pub)
	}
	got := rt.GetSettings()
	if got.Provider != "mock" || got.HasAPIKey {
		t.Fatalf("reload %+v", got)
	}
	if rt.Provider().Name() != "mock" {
		t.Fatal(rt.Provider().Name())
	}
}

func TestRuntimeMaskDoesNotStoreMaskedKey(t *testing.T) {
	store := repository.AdaptMemory(memory.NewStore())
	cfg := config.Config{AIProvider: "mock", DBPassword: "unit"}
	rt, _ := ai.NewRuntime(cfg, store)
	_, err := rt.SaveSettings(ai.SaveSettingsInput{
		Provider: "mock",
		Model:    "mock",
		APIKey:   "sk••••1234",
	})
	if err != nil {
		t.Fatal(err)
	}
	s := rt.Settings()
	if s.APIKeyEnc != "" {
		t.Fatal("masked key should not be encrypted as secret")
	}
}

func TestRuntimeRemove(t *testing.T) {
	store := repository.AdaptMemory(memory.NewStore())
	cfg := config.Config{DBPassword: "unit"}
	rt, _ := ai.NewRuntime(cfg, store)
	_, _ = rt.SaveSettings(ai.SaveSettingsInput{Provider: "mock", Model: "mock"})
	pub, err := rt.RemoveSettings()
	if err != nil {
		t.Fatal(err)
	}
	if pub.Provider != "mock" {
		t.Fatalf("%+v", pub)
	}
}

func TestMockStream(t *testing.T) {
	p, _ := ai.NewProviderFromConfig(config.Config{AIProvider: "mock"})
	svc := ai.NewService(config.Config{}, repository.AdaptMemory(memory.NewStore()), nil, p)
	var parts []string
	out, err := svc.ChatStream(context.Background(), "s1", ai.ChatInput{Message: "Hello GST"}, func(ch ai.StreamChunk) error {
		if ch.Delta != "" {
			parts = append(parts, ch.Delta)
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	if out.Reply == "" || len(parts) == 0 {
		t.Fatalf("stream empty: %+v parts=%d", out, len(parts))
	}
	if !strings.Contains(out.Reply, "Mock") {
		t.Fatalf("reply=%s", out.Reply)
	}
}

func TestBuildProviderOllama(t *testing.T) {
	cfg := config.Config{}
	p, err := ai.BuildProvider(cfg, &ai.StoredSettings{
		Provider: "ollama",
		Model:    "llama3.2",
		BaseURL:  "http://127.0.0.1:11434",
	})
	if err != nil {
		t.Fatal(err)
	}
	if p.Name() != "ollama" {
		t.Fatal(p.Name())
	}
}

func TestPracticeContextIncludesModules(t *testing.T) {
	store := repository.AdaptMemory(memory.NewStore())
	ctx := ai.NewContextBuilder(store)
	s := ctx.PracticeSnippet()
	for _, key := range []string{"clients", "gst", "tds", "roc", "invoices", "dashboard"} {
		if !strings.Contains(s, key) {
			t.Fatalf("missing %s in %s", key, s)
		}
	}
}

func TestMapErrorsHuman(t *testing.T) {
	p, _ := ai.NewProviderFromConfig(config.Config{AIProvider: "mock"})
	svc := ai.NewService(config.Config{}, repository.AdaptMemory(memory.NewStore()), nil, p)
	_, err := svc.Chat(context.Background(), "x", ai.ChatInput{Message: ""})
	if err == nil {
		t.Fatal("expected validation")
	}
}

func TestPublicSettingsNeverExposesRawKey(t *testing.T) {
	cfg := config.Config{DBPassword: "sec"}
	enc, _ := ai.EncryptAPIKey(cfg, "super-secret-key-value")
	pub := ai.ToPublic(cfg, &ai.StoredSettings{Provider: "gemini", Model: "gemini-flash-latest", APIKeyEnc: enc})
	if pub.APIKeyMasked == "super-secret-key-value" || strings.Contains(pub.APIKeyMasked, "secret-key") {
		t.Fatalf("leaked: %+v", pub)
	}
	if !pub.HasAPIKey {
		t.Fatal("expected hasApiKey")
	}
}
