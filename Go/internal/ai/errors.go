package ai

import "errors"

// Provider-agnostic sentinel errors (mapped to HTTP by Service).
var (
	ErrInvalidAPIKey       = errors.New("ai: invalid api key")
	ErrQuotaExceeded       = errors.New("ai: quota exceeded")
	ErrRateLimited         = errors.New("ai: rate limited")
	ErrInvalidModel        = errors.New("ai: invalid model")
	ErrProviderUnavailable = errors.New("ai: provider unavailable")
	ErrTimeout             = errors.New("ai: timeout")
	ErrNotConfigured       = errors.New("ai: not configured")
	ErrNetwork             = errors.New("ai: network error")
	ErrUnknown             = errors.New("ai: unknown error")
)
