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
	// Database configuration
	DBHost            string
	DBPort            int
	DBUser            string
	DBPassword        string
	DBName            string
	DBSSLMode         string
	DBMaxOpenConns    int
	DBMaxIdleConns    int
	DBConnMaxLifetime time.Duration
	// AI / Gemini (server-side only — never sent to the frontend)
	AIProvider      string
	GeminiAPIKey    string
	GeminiModel     string
	GeminiTimeout   time.Duration
	GeminiMaxTokens int
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

// DBConnectionString returns the PostgreSQL connection string.
func (c Config) DBConnectionString() string {
	return fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		c.DBHost, c.DBPort, c.DBUser, c.DBPassword, c.DBName, c.DBSSLMode)
}

// Load reads configuration from environment variables and validates it.
func Load() (Config, error) {
	loadDotEnv(".env")

	// Prefer FRONTEND_ORIGINS; fall back to FRONTEND_ORIGIN.
	// Default includes both localhost and 127.0.0.1 — browsers treat them as distinct origins.
	originRaw := getenv("FRONTEND_ORIGINS", "")
	if originRaw == "" {
		originRaw = getenv("FRONTEND_ORIGIN", "http://localhost:5173,http://127.0.0.1:5173")
	}
	origins := ParseOrigins(originRaw)

	cfg := Config{
		AppEnv:            getenv("APP_ENV", "development"),
		HTTPHost:          getenv("HTTP_HOST", "0.0.0.0"),
		HTTPPort:          getenvInt("HTTP_PORT", 8080),
		FrontendOrigin:    strings.Join(origins, ","),
		FrontendOrigins:   origins,
		LogLevel:          getenv("LOG_LEVEL", "info"),
		SessionTTL:        getenvDuration("SESSION_TTL", 30*time.Minute),
		DBHost:            getenv("DB_HOST", "localhost"),
		DBPort:            getenvInt("DB_PORT", 5432),
		DBUser:            getenv("DB_USER", "smartca"),
		DBPassword:        getenv("DB_PASSWORD", ""),
		DBName:            getenv("DB_NAME", "smartca"),
		DBSSLMode:         getenv("DB_SSLMODE", "disable"),
		DBMaxOpenConns:    getenvInt("DB_MAX_OPEN_CONNS", 25),
		DBMaxIdleConns:    getenvInt("DB_MAX_IDLE_CONNS", 10),
		DBConnMaxLifetime: getenvDuration("DB_CONN_MAX_LIFETIME", 5*time.Minute),
		AIProvider:        strings.ToLower(getenv("AI_PROVIDER", "mock")),
		GeminiAPIKey:      getenv("GEMINI_API_KEY", ""),
		GeminiModel:       getenv("GEMINI_MODEL", "gemini-flash-latest"),
		GeminiTimeout:     getenvDuration("GEMINI_TIMEOUT", 45*time.Second),
		GeminiMaxTokens:   getenvInt("GEMINI_MAX_TOKENS", 2048),
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

// loadDotEnv loads KEY=VALUE pairs from a local .env file into the process
// environment when the key is not already set. Existing OS env wins.
func loadDotEnv(path string) {
	data, err := os.ReadFile(path)
	if err != nil {
		return
	}
	for _, line := range strings.Split(string(data), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, val, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		key = strings.TrimSpace(key)
		val = strings.TrimSpace(val)
		if len(val) >= 2 {
			if (val[0] == '"' && val[len(val)-1] == '"') || (val[0] == '\'' && val[len(val)-1] == '\'') {
				val = val[1 : len(val)-1]
			}
		}
		if key == "" {
			continue
		}
		if _, exists := os.LookupEnv(key); exists {
			continue
		}
		_ = os.Setenv(key, val)
	}
}
