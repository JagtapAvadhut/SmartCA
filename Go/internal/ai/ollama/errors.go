package ollama

import (
	"errors"
	"fmt"
	"net/http"
)

var (
	ErrTimeout       = errors.New("ollama: timeout")
	ErrEmptyResponse = errors.New("ollama: empty response")
	ErrNetwork       = errors.New("ollama: network error")
	ErrMalformed     = errors.New("ollama: malformed response")
	ErrUnavailable   = errors.New("ollama: provider unavailable")
	ErrNotConfigured = errors.New("ollama: base url or model not configured")
)

func classifyHTTP(status int, body string) error {
	msg := body
	if len(msg) > 300 {
		msg = msg[:300]
	}
	switch status {
	case http.StatusBadGateway, http.StatusServiceUnavailable, http.StatusGatewayTimeout, http.StatusNotFound:
		return fmt.Errorf("%w: %s", ErrUnavailable, msg)
	default:
		return fmt.Errorf("ollama api %d: %s", status, msg)
	}
}
