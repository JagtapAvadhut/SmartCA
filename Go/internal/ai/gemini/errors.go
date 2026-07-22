package gemini

import (
	"errors"
	"fmt"
	"net/http"
	"strings"
)

// Sentinel / classified errors for the Gemini provider.
var (
	ErrInvalidAPIKey   = errors.New("gemini: invalid api key")
	ErrRateLimited     = errors.New("gemini: rate limited")
	ErrTimeout         = errors.New("gemini: timeout")
	ErrEmptyResponse   = errors.New("gemini: empty response")
	ErrNetwork         = errors.New("gemini: network error")
	ErrMalformed       = errors.New("gemini: malformed response")
	ErrNotConfigured   = errors.New("gemini: api key not configured")
	ErrTransient       = errors.New("gemini: transient failure")
)

// APIError wraps an HTTP status from the Gemini API.
type APIError struct {
	Status  int
	Message string
	Body    string
}

func (e *APIError) Error() string {
	if e.Message != "" {
		return fmt.Sprintf("gemini api %d: %s", e.Status, e.Message)
	}
	return fmt.Sprintf("gemini api %d", e.Status)
}

func classifyHTTP(status int, msg string) error {
	switch status {
	case http.StatusUnauthorized, http.StatusForbidden:
		return fmt.Errorf("%w: %s", ErrInvalidAPIKey, msg)
	case http.StatusTooManyRequests:
		return fmt.Errorf("%w: %s", ErrRateLimited, msg)
	case http.StatusBadGateway, http.StatusServiceUnavailable, http.StatusGatewayTimeout:
		return fmt.Errorf("%w: %s", ErrTransient, msg)
	default:
		if status == 429 || strings.Contains(strings.ToLower(msg), "resource_exhausted") || strings.Contains(strings.ToLower(msg), "quota") {
			return fmt.Errorf("%w: %s", ErrRateLimited, msg)
		}
		return &APIError{Status: status, Message: msg}
	}
}

func IsRetryable(err error) bool {
	if err == nil {
		return false
	}
	return errors.Is(err, ErrRateLimited) || errors.Is(err, ErrTransient) || errors.Is(err, ErrTimeout) || errors.Is(err, ErrNetwork)
}
