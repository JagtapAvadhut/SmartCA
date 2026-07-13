package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

// Config holds runtime settings loaded from the environment.
type Config struct {
	AppEnv   string
	HTTPHost string
	HTTPPort int
	// FrontendOrigin is the comma-joined allowlist (kept for logs / backward compatibility).
	FrontendOrigin string
	// FrontendOrigins is the parsed CORS allowlist (never includes "*").
	FrontendOrigins  []string
	LogLevel         string
	SessionTTL       time.Duration
	DemoResetEnabled bool
}

// Addr returns host:port for the HTTP listener.
func (c Config) Addr() string {
	host := c.HTTPHost
	if host == "" {
		host = "0.0.0.0"
	}
	return fmt.Sprintf("%s:%d", host, c.HTTPPort)
}

// IsDevelopment reports whether APP_ENV is development-like.
func (c Config) IsDevelopment() bool {
	switch strings.ToLower(c.AppEnv) {
	case "dev", "development", "local", "":
		return true
	default:
		return false
	}
}

// Load reads configuration from environment variables and validates it.
func Load() (Config, error) {
	// Prefer FRONTEND_ORIGINS; fall back to FRONTEND_ORIGIN.
	// Default includes both localhost and 127.0.0.1 — browsers treat them as distinct origins.
	originRaw := getenv("FRONTEND_ORIGINS", "")
	if originRaw == "" {
		originRaw = getenv("FRONTEND_ORIGIN", "http://localhost:5173,http://127.0.0.1:5173")
	}
	origins := ParseOrigins(originRaw)

	cfg := Config{
		AppEnv:          getenv("APP_ENV", "development"),
		HTTPHost:        getenv("HTTP_HOST", "0.0.0.0"),
		HTTPPort:        getenvInt("HTTP_PORT", 8080),
		FrontendOrigin:  strings.Join(origins, ","),
		FrontendOrigins: origins,
		LogLevel:        getenv("LOG_LEVEL", "info"),
		SessionTTL:      getenvDuration("SESSION_TTL", 30*time.Minute),
	}

	if v, ok := os.LookupEnv("DEMO_RESET_ENABLED"); ok {
		b, err := strconv.ParseBool(v)
		if err != nil {
			return Config{}, fmt.Errorf("DEMO_RESET_ENABLED: %w", err)
		}
		cfg.DemoResetEnabled = b
	} else {
		cfg.DemoResetEnabled = cfg.IsDevelopment()
	}

	if err := cfg.Validate(); err != nil {
		return Config{}, err
	}
	return cfg, nil
}

// ParseOrigins splits a comma-separated origin allowlist and trims entries.
func ParseOrigins(raw string) []string {
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	seen := map[string]struct{}{}
	for _, p := range parts {
		o := strings.TrimSpace(p)
		if o == "" {
			continue
		}
		if _, ok := seen[o]; ok {
			continue
		}
		seen[o] = struct{}{}
		out = append(out, o)
	}
	return out
}

// OriginAllowed reports whether requestOrigin is in the allowlist.
func (c Config) OriginAllowed(requestOrigin string) bool {
	if requestOrigin == "" {
		return false
	}
	for _, o := range c.FrontendOrigins {
		if o == requestOrigin {
			return true
		}
	}
	return false
}

// Validate checks required fields and ranges.
func (c Config) Validate() error {
	if c.HTTPPort < 1 || c.HTTPPort > 65535 {
		return fmt.Errorf("HTTP_PORT must be between 1 and 65535")
	}
	if len(c.FrontendOrigins) == 0 {
		return fmt.Errorf("FRONTEND_ORIGIN/FRONTEND_ORIGINS is required")
	}
	for _, o := range c.FrontendOrigins {
		if o == "*" {
			return fmt.Errorf("FRONTEND_ORIGIN must not be * (credentials require an explicit origin)")
		}
	}
	if c.SessionTTL < time.Minute {
		return fmt.Errorf("SESSION_TTL must be at least 1m")
	}
	switch strings.ToLower(c.LogLevel) {
	case "debug", "info", "warn", "warning", "error":
	default:
		return fmt.Errorf("LOG_LEVEL must be debug|info|warn|error")
	}
	return nil
}

func getenv(key, fallback string) string {
	if v, ok := os.LookupEnv(key); ok && strings.TrimSpace(v) != "" {
		return strings.TrimSpace(v)
	}
	return fallback
}

func getenvInt(key string, fallback int) int {
	v, ok := os.LookupEnv(key)
	if !ok || strings.TrimSpace(v) == "" {
		return fallback
	}
	n, err := strconv.Atoi(strings.TrimSpace(v))
	if err != nil {
		return fallback
	}
	return n
}

func getenvDuration(key string, fallback time.Duration) time.Duration {
	v, ok := os.LookupEnv(key)
	if !ok || strings.TrimSpace(v) == "" {
		return fallback
	}
	d, err := time.ParseDuration(strings.TrimSpace(v))
	if err != nil {
		return fallback
	}
	return d
}
