package ai

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/JagtapAvadhut/smartca-backend/internal/ai/gemini"
	"github.com/JagtapAvadhut/smartca-backend/internal/ai/mockprovider"
	"github.com/JagtapAvadhut/smartca-backend/internal/ai/ollama"
	"github.com/JagtapAvadhut/smartca-backend/internal/ai/openai"
	"github.com/JagtapAvadhut/smartca-backend/internal/config"
	apperrors "github.com/JagtapAvadhut/smartca-backend/internal/domain/errors"
	"github.com/JagtapAvadhut/smartca-backend/internal/repository"
)

// Runtime manages the active provider from DB settings with env fallback.
type Runtime struct {
	mu            sync.RWMutex
	cfg           config.Config
	store         repository.Store
	provider      Provider
	settings      *StoredSettings
	modelsCache   ModelsByProvider
	modelsCacheAt time.Time
}

func NewRuntime(cfg config.Config, store repository.Store) (*Runtime, error) {
	rt := &Runtime{cfg: cfg, store: store}
	if err := rt.Reload(); err != nil {
		// Fall back to env/mock so API still boots.
		p, _ := NewProviderFromConfig(cfg)
		if p == nil {
			p = &mockAdapter{p: mockprovider.New()}
		}
		rt.provider = p
		rt.settings = &StoredSettings{Provider: p.Name()}
	}
	return rt, nil
}

func (rt *Runtime) Provider() Provider {
	rt.mu.RLock()
	defer rt.mu.RUnlock()
	return rt.provider
}

func (rt *Runtime) Settings() *StoredSettings {
	rt.mu.RLock()
	defer rt.mu.RUnlock()
	if rt.settings == nil {
		return &StoredSettings{Provider: "mock"}
	}
	cp := *rt.settings
	return &cp
}

func (rt *Runtime) PublicSettings() PublicSettings {
	return ToPublicWithModels(rt.cfg, rt.Settings(), rt.suggestedModels(context.Background()))
}

func (rt *Runtime) suggestedModels(ctx context.Context) ModelsByProvider {
	rt.mu.RLock()
	if !rt.modelsCacheAt.IsZero() && time.Since(rt.modelsCacheAt) < 5*time.Minute && len(rt.modelsCache.Gemini) > 0 {
		cached := rt.modelsCache
		rt.mu.RUnlock()
		return cached
	}
	rt.mu.RUnlock()

	discovered := DiscoverSuggestedModels(ctx, rt.cfg, rt.Settings())
	rt.mu.Lock()
	rt.modelsCache = discovered
	rt.modelsCacheAt = time.Now()
	rt.mu.Unlock()
	return discovered
}

func (rt *Runtime) Reload() error {
	stored, err := LoadStoredSettings(rt.store)
	if err != nil {
		return err
	}

	// DB wins only when the user has explicitly saved settings.
	// Placeholder "mock" with no UpdatedAt (missing row) must not block env Gemini.
	if !isExplicitStoredSettings(stored) {
		if envP, err := NewProviderFromConfig(rt.cfg); err == nil && envP != nil {
			settings := &StoredSettings{
				Provider: envP.Name(),
				Model:    defaultModel(envP.Name()),
			}
			if envP.Name() == "gemini" {
				model := strings.TrimSpace(rt.cfg.GeminiModel)
				if model == "" {
					model = defaultModel("gemini")
				}
				settings.Model = model
			}
			rt.mu.Lock()
			rt.provider = envP
			rt.settings = settings
			rt.mu.Unlock()
			return nil
		}
	}

	p, err := BuildProvider(rt.cfg, stored)
	if err != nil {
		// If stored Gemini/OpenAI is broken, fall back to env instead of dying as mock silently
		// when a usable env key exists — unless the user explicitly chose mock.
		if isExplicitStoredSettings(stored) && defaultProvider(stored.Provider) == "mock" {
			p = &mockAdapter{p: mockprovider.New()}
			rt.mu.Lock()
			rt.provider = p
			rt.settings = stored
			rt.mu.Unlock()
			return nil
		}
		if envP, envErr := NewProviderFromConfig(rt.cfg); envErr == nil && envP != nil && envP.Name() != "mock" {
			rt.mu.Lock()
			rt.provider = envP
			rt.settings = &StoredSettings{Provider: envP.Name(), Model: defaultModel(envP.Name())}
			if envP.Name() == "gemini" && strings.TrimSpace(rt.cfg.GeminiModel) != "" {
				rt.settings.Model = rt.cfg.GeminiModel
			}
			rt.mu.Unlock()
			return nil
		}
		return err
	}
	rt.mu.Lock()
	rt.provider = p
	rt.settings = stored
	rt.mu.Unlock()
	return nil
}

// isExplicitStoredSettings reports whether DB holds a user-saved preference
// (Save Settings or Remove), as opposed to a missing-row placeholder.
func isExplicitStoredSettings(s *StoredSettings) bool {
	if s == nil {
		return false
	}
	if strings.TrimSpace(s.UpdatedAt) != "" {
		return true
	}
	if strings.TrimSpace(s.APIKeyEnc) != "" {
		return true
	}
	p := defaultProvider(s.Provider)
	if p != "mock" {
		return true
	}
	// mock + empty updatedAt + empty key = missing row placeholder
	return false
}

func (rt *Runtime) GetSettings() PublicSettings {
	_ = rt.Reload()
	return rt.PublicSettings()
}

func (rt *Runtime) SaveSettings(in SaveSettingsInput) (PublicSettings, error) {
	provider, err := NormalizeProvider(in.Provider)
	if err != nil {
		return PublicSettings{}, apperrors.Validation(err.Error())
	}
	cur, _ := LoadStoredSettings(rt.store)
	if cur == nil {
		cur = &StoredSettings{Provider: "mock"}
	}
	prevProvider := defaultProvider(cur.Provider)

	next := &StoredSettings{
		Provider:  provider,
		Model:     strings.TrimSpace(in.Model),
		BaseURL:   strings.TrimSpace(in.BaseURL),
		APIKeyEnc: cur.APIKeyEnc,
		UpdatedAt: time.Now().UTC().Format(time.RFC3339),
	}

	// Switching cloud providers must not reuse another provider's API key.
	if prevProvider != provider && (provider == "gemini" || provider == "openai" || prevProvider == "gemini" || prevProvider == "openai") {
		if strings.TrimSpace(in.APIKey) == "" || looksMasked(in.APIKey) {
			next.APIKeyEnc = ""
		}
	}

	if in.ClearAPIKey {
		next.APIKeyEnc = ""
	} else if strings.TrimSpace(in.APIKey) != "" && !looksMasked(in.APIKey) {
		enc, err := EncryptAPIKey(rt.cfg, in.APIKey)
		if err != nil {
			return PublicSettings{}, apperrors.Internal("failed to encrypt API key", err)
		}
		next.APIKeyEnc = enc
	}

	if provider == "mock" {
		next.APIKeyEnc = ""
		next.BaseURL = ""
		if next.Model == "" {
			next.Model = "mock"
		}
	}
	if provider == "ollama" && next.BaseURL == "" {
		next.BaseURL = "http://host.docker.internal:11434"
	}
	if provider != "ollama" {
		next.BaseURL = ""
	}
	if next.Model == "" {
		next.Model = defaultModel(provider)
	}

	// Validate we can construct the provider before persisting.
	if _, err := BuildProvider(rt.cfg, next); err != nil {
		return PublicSettings{}, mapProviderError(err)
	}

	if err := SaveStoredSettings(rt.store, next); err != nil {
		return PublicSettings{}, apperrors.Internal("failed to save AI settings", err)
	}
	rt.mu.Lock()
	rt.modelsCacheAt = time.Time{} // invalidate discovered models after provider/key change
	rt.mu.Unlock()
	if err := rt.Reload(); err != nil {
		return PublicSettings{}, mapProviderError(err)
	}
	return rt.PublicSettings(), nil
}

func (rt *Runtime) RemoveSettings() (PublicSettings, error) {
	_ = DeleteStoredSettings(rt.store)
	// Reset to mock regardless of env so "Remove" is explicit.
	mock := &StoredSettings{Provider: "mock", Model: "mock", UpdatedAt: time.Now().UTC().Format(time.RFC3339)}
	if err := SaveStoredSettings(rt.store, mock); err != nil {
		return PublicSettings{}, apperrors.Internal("failed to reset AI settings", err)
	}
	if err := rt.Reload(); err != nil {
		return PublicSettings{}, mapProviderError(err)
	}
	return rt.PublicSettings(), nil
}

func (rt *Runtime) TestConnection(ctx context.Context, in TestSettingsInput) (*TestResult, error) {
	provider, err := NormalizeProvider(in.Provider)
	if err != nil {
		return &TestResult{OK: false, Provider: strings.TrimSpace(in.Provider), Model: strings.TrimSpace(in.Model), Message: err.Error()}, nil
	}
	cur := rt.Settings()
	key := strings.TrimSpace(in.APIKey)
	if key == "" || looksMasked(key) {
		// Only reuse stored key when testing the same provider that owns it.
		if defaultProvider(cur.Provider) == provider {
			plain, derr := DecryptAPIKey(rt.cfg, cur.APIKeyEnc)
			if derr != nil {
				return &TestResult{OK: false, Provider: provider, Model: strings.TrimSpace(in.Model), Message: "Failed to read stored API key"}, nil
			}
			key = plain
		}
		if key == "" && provider == "gemini" {
			key = strings.TrimSpace(rt.cfg.GeminiAPIKey)
		}
		if key == "" && provider == "openai" {
			key = strings.TrimSpace(os.Getenv("OPENAI_API_KEY"))
		}
	}
	model := strings.TrimSpace(in.Model)
	if model == "" {
		if defaultProvider(cur.Provider) == provider {
			model = cur.Model
		}
	}
	if model == "" {
		model = defaultModel(provider)
	}
	base := strings.TrimSpace(in.BaseURL)
	if base == "" && provider == "ollama" {
		base = cur.BaseURL
	}
	tmp := &StoredSettings{
		Provider: provider,
		Model:    model,
		BaseURL:  base,
	}
	if key != "" {
		enc, eerr := EncryptAPIKey(rt.cfg, key)
		if eerr != nil {
			return &TestResult{OK: false, Provider: provider, Model: model, Message: "Failed to prepare API key"}, nil
		}
		tmp.APIKeyEnc = enc
	}
	p, berr := BuildProvider(rt.cfg, tmp)
	if berr != nil {
		return &TestResult{OK: false, Provider: provider, Model: model, Message: humanErr(berr)}, nil
	}
	ctx, cancel := context.WithTimeout(ctx, 20*time.Second)
	defer cancel()
	if tester, ok := p.(ConnectionTester); ok {
		if terr := tester.TestConnection(ctx); terr != nil {
			return &TestResult{OK: false, Provider: provider, Model: model, Message: humanErr(terr)}, nil
		}
	} else {
		_, gerr := p.Generate(ctx, GenerateRequest{
			Messages:  []Message{{Role: "user", Content: "Reply with OK"}},
			MaxTokens: 8,
		})
		if gerr != nil {
			return &TestResult{OK: false, Provider: provider, Model: model, Message: humanErr(gerr)}, nil
		}
	}
	return &TestResult{
		OK:       true,
		Provider: provider,
		Model:    defaultStr(model, defaultModel(provider)),
		Message:  "Connected",
	}, nil
}

// BuildProvider constructs a Provider from stored settings (decrypted key).
func BuildProvider(cfg config.Config, s *StoredSettings) (Provider, error) {
	if s == nil {
		return &mockAdapter{p: mockprovider.New()}, nil
	}
	provider, err := NormalizeProvider(s.Provider)
	if err != nil {
		return nil, err
	}
	key, err := DecryptAPIKey(cfg, s.APIKeyEnc)
	if err != nil {
		return nil, err
	}
	if key == "" && provider == "gemini" {
		key = cfg.GeminiAPIKey
	}
	if key == "" && provider == "openai" {
		key = strings.TrimSpace(os.Getenv("OPENAI_API_KEY"))
	}
	timeout := cfg.GeminiTimeout
	if timeout <= 0 {
		timeout = 45 * time.Second
	}
	switch provider {
	case "mock":
		return &mockAdapter{p: mockprovider.New()}, nil
	case "gemini":
		c, err := gemini.NewClient(gemini.Config{
			APIKey:  key,
			Model:   defaultStr(s.Model, defaultStr(cfg.GeminiModel, defaultModel("gemini"))),
			Timeout: timeout,
			BaseURL: s.BaseURL,
		})
		if err != nil {
			return nil, err
		}
		return &geminiAdapter{c: c}, nil
	case "openai":
		c, err := openai.NewClient(openai.Config{
			APIKey:  key,
			Model:   defaultStr(s.Model, "gpt-4o-mini"),
			Timeout: timeout,
			BaseURL: s.BaseURL,
		})
		if err != nil {
			return nil, err
		}
		return &openaiAdapter{c: c}, nil
	case "ollama":
		c, err := ollama.NewClient(ollama.Config{
			BaseURL: defaultStr(s.BaseURL, "http://host.docker.internal:11434"),
			Model:   defaultStr(s.Model, "llama3.2"),
			Timeout: timeout * 2,
		})
		if err != nil {
			return nil, err
		}
		return &ollamaAdapter{c: c}, nil
	default:
		return nil, fmt.Errorf("%w: unknown provider %q", ErrNotConfigured, provider)
	}
}

func defaultModel(provider string) string {
	switch provider {
	case "gemini":
		return "gemini-flash-latest"
	case "openai":
		return "gpt-4o-mini"
	case "ollama":
		return "llama3.2"
	default:
		return "mock"
	}
}

func looksMasked(s string) bool {
	return strings.Contains(s, "•") || strings.Contains(s, "*")
}

func humanErr(err error) string {
	if err == nil {
		return "Unknown error"
	}
	switch {
	case errors.Is(err, ErrInvalidAPIKey), errors.Is(err, gemini.ErrInvalidAPIKey), errors.Is(err, openai.ErrInvalidAPIKey):
		msg := err.Error()
		if strings.Contains(msg, "ACCESS_TOKEN_TYPE_UNSUPPORTED") {
			return "Invalid API key [ACCESS_TOKEN_TYPE_UNSUPPORTED] — Google rejected this credential type. Create a new Gemini API key in AI Studio and update Go/.env + root .env"
		}
		if strings.Contains(msg, "API_KEY_SERVICE_BLOCKED") {
			return "API key blocked for Gemini API — enable Generative Language API / create a new AI Studio key"
		}
		return "Invalid API key"
	case errors.Is(err, ErrQuotaExceeded), errors.Is(err, gemini.ErrQuotaExceeded), errors.Is(err, openai.ErrQuotaExceeded):
		return "Quota exceeded"
	case errors.Is(err, ErrRateLimited), errors.Is(err, gemini.ErrRateLimited), errors.Is(err, openai.ErrRateLimited):
		return "Rate limit exceeded"
	case errors.Is(err, gemini.ErrInvalidModel):
		return "Invalid or unavailable model — pick another from the discovered list"
	case errors.Is(err, ErrTimeout), errors.Is(err, gemini.ErrTimeout), errors.Is(err, openai.ErrTimeout), errors.Is(err, ollama.ErrTimeout):
		return "Network timeout"
	case errors.Is(err, ErrProviderUnavailable), errors.Is(err, openai.ErrUnavailable), errors.Is(err, ollama.ErrUnavailable):
		return "Provider unavailable"
	case errors.Is(err, ErrNotConfigured), errors.Is(err, gemini.ErrNotConfigured), errors.Is(err, openai.ErrNotConfigured):
		return "Provider not configured — paste an API key and save"
	case errors.Is(err, gemini.ErrMalformed), errors.Is(err, openai.ErrMalformed):
		return "JSON parsing error from provider"
	default:
		msg := err.Error()
		if len(msg) > 160 {
			msg = msg[:160]
		}
		return msg
	}
}
