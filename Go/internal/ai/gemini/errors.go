package gemini

import (
	"errors"
	"fmt"
	"net/http"
	"strings"
)

// Sentinel / classified errors for the Gemini provider.
var (
	ErrInvalidAPIKey = errors.New("gemini: invalid api key")
	ErrRateLimited   = errors.New("gemini: rate limited")
	ErrQuotaExceeded = errors.New("gemini: quota exceeded")
	ErrInvalidModel  = errors.New("gemini: invalid model")
	ErrTimeout       = errors.New("gemini: timeout")
	ErrEmptyResponse = errors.New("gemini: empty response")
	ErrNetwork       = errors.New("gemini: network error")
	ErrMalformed     = errors.New("gemini: malformed response")
	ErrNotConfigured = errors.New("gemini: api key not configured")
	ErrTransient     = errors.New("gemini: transient failure")
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
	lower := strings.ToLower(msg)
	switch {
	case status == http.StatusUnauthorized || status == http.StatusForbidden:
		return fmt.Errorf("%w: %s", ErrInvalidAPIKey, msg)
	case status == http.StatusTooManyRequests || strings.Contains(lower, "resource_exhausted"):
		if strings.Contains(lower, "quota") {
			return fmt.Errorf("%w: %s", ErrQuotaExceeded, msg)
		}
		return fmt.Errorf("%w: %s", ErrRateLimited, msg)
	case status == http.StatusBadGateway || status == http.StatusServiceUnavailable || status == http.StatusGatewayTimeout:
		return fmt.Errorf("%w: %s", ErrTransient, msg)
	case status == http.StatusNotFound || strings.Contains(lower, "not found") || strings.Contains(lower, "is not found") ||
		strings.Contains(lower, "invalid model") || strings.Contains(lower, "model not found"):
		return fmt.Errorf("%w: %s", ErrInvalidModel, msg)
	case status == http.StatusBadRequest && (strings.Contains(lower, "model") || strings.Contains(lower, "not supported")):
		return fmt.Errorf("%w: %s", ErrInvalidModel, msg)
	case strings.Contains(lower, "quota"):
		return fmt.Errorf("%w: %s", ErrQuotaExceeded, msg)
	case status >= 500:
		return fmt.Errorf("%w: %s", ErrTransient, msg)
	default:
		return &APIError{Status: status, Message: msg}
	}
}

func IsRetryable(err error) bool {
	if err == nil {
		return false
	}
	return errors.Is(err, ErrRateLimited) || errors.Is(err, ErrTransient) || errors.Is(err, ErrTimeout) || errors.Is(err, ErrNetwork)
}
