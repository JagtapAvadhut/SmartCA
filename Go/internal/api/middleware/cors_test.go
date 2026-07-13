package middleware_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/JagtapAvadhut/smartca-backend/internal/api/middleware"
)

func TestCORSEchoesMatchingOrigin(t *testing.T) {
	allow := "http://localhost:5173,http://127.0.0.1:5173"
	h := middleware.CORS(allow)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	}))

	t.Run("127.0.0.1 preflight", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodOptions, "/api/v1/auth/login", nil)
		req.Header.Set("Origin", "http://127.0.0.1:5173")
		req.Header.Set("Access-Control-Request-Method", "POST")
		rr := httptest.NewRecorder()
		h.ServeHTTP(rr, req)
		if rr.Code != http.StatusNoContent {
			t.Fatalf("status=%d", rr.Code)
		}
		if got := rr.Header().Get("Access-Control-Allow-Origin"); got != "http://127.0.0.1:5173" {
			t.Fatalf("ACAO=%q", got)
		}
		if rr.Header().Get("Access-Control-Allow-Credentials") != "true" {
			t.Fatal("credentials missing")
		}
	})

	t.Run("localhost POST", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", nil)
		req.Header.Set("Origin", "http://localhost:5173")
		rr := httptest.NewRecorder()
		h.ServeHTTP(rr, req)
		if got := rr.Header().Get("Access-Control-Allow-Origin"); got != "http://localhost:5173" {
			t.Fatalf("ACAO=%q", got)
		}
	})

	t.Run("disallowed origin", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodOptions, "/api/v1/auth/login", nil)
		req.Header.Set("Origin", "http://evil.example")
		rr := httptest.NewRecorder()
		h.ServeHTTP(rr, req)
		if got := rr.Header().Get("Access-Control-Allow-Origin"); got != "" {
			t.Fatalf("must not echo disallowed origin, got %q", got)
		}
	})
}
