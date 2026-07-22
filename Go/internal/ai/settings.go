package ai

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"io"
	"os"
	"strings"
	"time"

	"github.com/JagtapAvadhut/smartca-backend/internal/ai/gemini"
	"github.com/JagtapAvadhut/smartca-backend/internal/config"
	"github.com/JagtapAvadhut/smartca-backend/internal/domain/models"
	"github.com/JagtapAvadhut/smartca-backend/internal/repository"
)

const (
	ColAISettings   = "aiSettings"
	AISettingsDocID = "AI-CFG-001"
)

// StoredSettings is the persisted AI configuration (API key stored encrypted).
type StoredSettings struct {
	Provider  string `json:"provider"`
	Model     string `json:"model"`
	BaseURL   string `json:"baseUrl"`
	APIKeyEnc string `json:"apiKeyEnc,omitempty"`
	UpdatedAt string `json:"updatedAt,omitempty"`
}

// PublicSettings is the browser-safe view (keys masked, never raw).
type PublicSettings struct {
	Provider     string           `json:"provider"`
	Model        string           `json:"model"`
	BaseURL      string           `json:"baseUrl"`
	HasAPIKey    bool             `json:"hasApiKey"`
	APIKeyMasked string           `json:"apiKeyMasked"`
	UpdatedAt    string           `json:"updatedAt,omitempty"`
	Available    []string         `json:"availableProviders"`
	Models       ModelsByProvider `json:"suggestedModels"`
}

// ModelsByProvider lists UI-friendly model suggestions.
type ModelsByProvider struct {
	Gemini []string `json:"gemini"`
	OpenAI []string `json:"openai"`
	Ollama []string `json:"ollama"`
	Mock   []string `json:"mock"`
}

// SaveSettingsInput is the PUT body from the AI Settings UI.
type SaveSettingsInput struct {
	Provider    string `json:"provider"`
	Model       string `json:"model"`
	BaseURL     string `json:"baseUrl"`
	APIKey      string `json:"apiKey"`      // empty = keep existing (same provider only)
	ClearAPIKey bool   `json:"clearApiKey"` // true = remove stored key
}

// TestSettingsInput verifies credentials (may include unsaved key).
type TestSettingsInput struct {
	Provider string `json:"provider"`
	Model    string `json:"model"`
	BaseURL  string `json:"baseUrl"`
	APIKey   string `json:"apiKey"` // empty = use stored key
}

// TestResult is returned by Test Connection.
type TestResult struct {
	OK       bool   `json:"ok"`
	Provider string `json:"provider"`
	Model    string `json:"model"`
	Message  string `json:"message"`
}

// SuggestedModels returns static fallbacks. Prefer DiscoverSuggestedModels when a key exists.
func SuggestedModels() ModelsByProvider {
	return ModelsByProvider{
		Gemini: gemini.FallbackModels(),
		OpenAI: []string{"gpt-4o-mini", "gpt-4o", "gpt-4.1-mini"},
		Ollama: []string{"llama3.2", "llama3.1", "mistral", "qwen2.5"},
		Mock:   []string{"mock"},
	}
}

// DiscoverSuggestedModels lists Gemini models from the live API when possible.
func DiscoverSuggestedModels(ctx context.Context, cfg config.Config, s *StoredSettings) ModelsByProvider {
	out := SuggestedModels()
	key := ""
	if s != nil {
		plain, err := DecryptAPIKey(cfg, s.APIKeyEnc)
		if err == nil {
			key = plain
		}
	}
	if key == "" {
		key = strings.TrimSpace(cfg.GeminiAPIKey)
	}
	if key == "" {
		return out
	}
	model := "gemini-flash-latest"
	if s != nil && strings.TrimSpace(s.Model) != "" && defaultProvider(s.Provider) == "gemini" {
		model = s.Model
	} else if strings.TrimSpace(cfg.GeminiModel) != "" {
		model = cfg.GeminiModel
	}
	c, err := gemini.NewClient(gemini.Config{
		APIKey:  key,
		Model:   model,
		Timeout: 15 * time.Second,
	})
	if err != nil {
		return out
	}
	ctx, cancel := context.WithTimeout(ctx, 12*time.Second)
	defer cancel()
	models, err := c.ListGenerateModels(ctx)
	if err != nil || len(models) == 0 {
		return out
	}
	out.Gemini = models
	return out
}

func AvailableProviders() []string {
	return []string{"mock", "gemini", "openai", "ollama"}
}

func deriveSecretKey(cfg config.Config) []byte {
	secret := strings.TrimSpace(os.Getenv("AI_SETTINGS_SECRET"))
	if secret == "" {
		secret = strings.TrimSpace(cfg.DBPassword)
	}
	if secret == "" {
		secret = "smartca-dev-ai-settings"
	}
	sum := sha256.Sum256([]byte("smartca-ai-v1:" + secret))
	return sum[:]
}

func EncryptAPIKey(cfg config.Config, plain string) (string, error) {
	plain = strings.TrimSpace(plain)
	if plain == "" {
		return "", nil
	}
	block, err := aes.NewCipher(deriveSecretKey(cfg))
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}
	out := gcm.Seal(nonce, nonce, []byte(plain), nil)
	return base64.StdEncoding.EncodeToString(out), nil
}

func DecryptAPIKey(cfg config.Config, enc string) (string, error) {
	enc = strings.TrimSpace(enc)
	if enc == "" {
		return "", nil
	}
	raw, err := base64.StdEncoding.DecodeString(enc)
	if err != nil {
		return "", fmt.Errorf("decrypt api key: %w", err)
	}
	block, err := aes.NewCipher(deriveSecretKey(cfg))
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	if len(raw) < gcm.NonceSize() {
		return "", fmt.Errorf("decrypt api key: ciphertext too short")
	}
	nonce, ciphertext := raw[:gcm.NonceSize()], raw[gcm.NonceSize():]
	plain, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", fmt.Errorf("decrypt api key: %w", err)
	}
	return string(plain), nil
}

func MaskAPIKey(key string) string {
	key = strings.TrimSpace(key)
	if key == "" {
		return ""
	}
	r := []rune(key)
	if len(r) <= 4 {
		return strings.Repeat("•", len(r))
	}
	if len(r) <= 8 {
		return strings.Repeat("•", len(r)-2) + string(r[len(r)-2:])
	}
	return string(r[:2]) + strings.Repeat("•", len(r)-6) + string(r[len(r)-4:])
}

func LoadStoredSettings(store repository.Store) (*StoredSettings, error) {
	if store == nil {
		return &StoredSettings{Provider: "mock"}, nil
	}
	rec, err := store.Get(ColAISettings, AISettingsDocID)
	if err != nil {
		return &StoredSettings{Provider: "mock"}, nil
	}
	s := &StoredSettings{
		Provider:  strings.ToLower(rec.GetString("provider")),
		Model:     rec.GetString("model"),
		BaseURL:   rec.GetString("baseUrl"),
		APIKeyEnc: rec.GetString("apiKeyEnc"),
		UpdatedAt: rec.GetString("updatedAt"),
	}
	if s.Provider == "" {
		s.Provider = "mock"
	}
	return s, nil
}

func SaveStoredSettings(store repository.Store, s *StoredSettings) error {
	if store == nil {
		return fmt.Errorf("store unavailable")
	}
	if s.UpdatedAt == "" {
		s.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	}
	data := models.Record{
		"id":        AISettingsDocID,
		"provider":  s.Provider,
		"model":     s.Model,
		"baseUrl":   s.BaseURL,
		"apiKeyEnc": s.APIKeyEnc,
		"updatedAt": s.UpdatedAt,
	}
	if _, err := store.Get(ColAISettings, AISettingsDocID); err != nil {
		_, err = store.Create(ColAISettings, data)
		return err
	}
	_, err := store.Update(ColAISettings, AISettingsDocID, data)
	return err
}

func DeleteStoredSettings(store repository.Store) error {
	if store == nil {
		return nil
	}
	_ = store.PermanentDelete(ColAISettings, AISettingsDocID)
	return nil
}

func ToPublic(cfg config.Config, s *StoredSettings) PublicSettings {
	return ToPublicWithModels(cfg, s, SuggestedModels())
}

func ToPublicWithModels(cfg config.Config, s *StoredSettings, models ModelsByProvider) PublicSettings {
	if s == nil {
		s = &StoredSettings{Provider: "mock"}
	}
	plain, _ := DecryptAPIKey(cfg, s.APIKeyEnc)
	provider, _ := NormalizeProvider(s.Provider)
	// Reflect env-configured keys so Docker Gemini does not look "unconfigured" in the UI.
	if plain == "" && provider == "gemini" && strings.TrimSpace(cfg.GeminiAPIKey) != "" {
		plain = strings.TrimSpace(cfg.GeminiAPIKey)
	}
	if plain == "" && provider == "openai" {
		plain = strings.TrimSpace(os.Getenv("OPENAI_API_KEY"))
	}
	return PublicSettings{
		Provider:     provider,
		Model:        s.Model,
		BaseURL:      s.BaseURL,
		HasAPIKey:    plain != "",
		APIKeyMasked: MaskAPIKey(plain),
		UpdatedAt:    s.UpdatedAt,
		Available:    AvailableProviders(),
		Models:       models,
	}
}

// NormalizeProvider validates and canonicalizes a provider id.
// Unknown values return an error (they are NOT silently mapped to mock).
func NormalizeProvider(p string) (string, error) {
	p = strings.ToLower(strings.TrimSpace(p))
	switch p {
	case "gemini", "openai", "ollama", "mock":
		return p, nil
	case "google", "google gemini", "google-gemini":
		return "gemini", nil
	default:
		if p == "" {
			return "", fmt.Errorf("%w: provider is required", ErrNotConfigured)
		}
		return "", fmt.Errorf("%w: unknown provider %q (use mock, gemini, openai, or ollama)", ErrNotConfigured, p)
	}
}

func defaultProvider(p string) string {
	n, err := NormalizeProvider(p)
	if err != nil {
		return "mock"
	}
	return n
}
