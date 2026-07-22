package openai

import (
	"errors"
	"fmt"
	"net/http"
	"strings"
)

var (
	ErrInvalidAPIKey = errors.New("openai: invalid api key")
	ErrRateLimited   = errors.New("openai: rate limited")
	ErrQuotaExceeded = errors.New("openai: quota exceeded")
	ErrTimeout       = errors.New("openai: timeout")
	ErrEmptyResponse = errors.New("openai: empty response")
	ErrNetwork       = errors.New("openai: network error")
	ErrMalformed     = errors.New("openai: malformed response")
	ErrNotConfigured = errors.New("openai: api key not configured")
	ErrUnavailable   = errors.New("openai: provider unavailable")
)

func classifyHTTP(status int, body string) error {
	msg := body
	if len(msg) > 300 {
		msg = msg[:300]
	}
	low := strings.ToLower(body)
	switch status {
	case http.StatusUnauthorized, http.StatusForbidden:
		return fmt.Errorf("%w: %s", ErrInvalidAPIKey, msg)
	case http.StatusTooManyRequests:
		if strings.Contains(low, "quota") || strings.Contains(low, "billing") {
			return fmt.Errorf("%w: %s", ErrQuotaExceeded, msg)
		}
		return fmt.Errorf("%w: %s", ErrRateLimited, msg)
	case http.StatusBadGateway, http.StatusServiceUnavailable, http.StatusGatewayTimeout:
		return fmt.Errorf("%w: %s", ErrUnavailable, msg)
	default:
		if strings.Contains(low, "quota") {
			return fmt.Errorf("%w: %s", ErrQuotaExceeded, msg)
		}
		return fmt.Errorf("openai api %d: %s", status, msg)
	}
}
