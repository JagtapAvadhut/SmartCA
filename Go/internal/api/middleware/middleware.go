package middleware

import (
	"context"
	"log/slog"
	"net/http"
	"runtime/debug"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/JagtapAvadhut/smartca-backend/internal/app/services"
	apperrors "github.com/JagtapAvadhut/smartca-backend/internal/domain/errors"
	"github.com/JagtapAvadhut/smartca-backend/internal/domain/models"
	"github.com/JagtapAvadhut/smartca-backend/internal/rbac"
	"github.com/JagtapAvadhut/smartca-backend/internal/repository"
	"github.com/JagtapAvadhut/smartca-backend/pkg/apiresponse"
)

type ctxKey string

const (
	CtxRequestID ctxKey = "requestId"
	CtxUser      ctxKey = "user"
	CtxToken     ctxKey = "token"
	CtxSession   ctxKey = "session"
)

func RequestIDFrom(ctx context.Context) string {
	if v, ok := ctx.Value(CtxRequestID).(string); ok {
		return v
	}
	return ""
}

func UserFrom(ctx context.Context) models.Record {
	if v, ok := ctx.Value(CtxUser).(models.Record); ok {
		return v
	}
	return nil
}

func TokenFrom(ctx context.Context) string {
	if v, ok := ctx.Value(CtxToken).(string); ok {
		return v
	}
	return ""
}

// RequestID assigns an X-Request-ID.
func RequestID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id := r.Header.Get("X-Request-ID")
		if id == "" {
			id = uuid.NewString()
		}
		w.Header().Set("X-Request-ID", id)
		ctx := context.WithValue(r.Context(), CtxRequestID, id)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// Recover catches panics and returns a JSON 500.
func Recover(log *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer func() {
				if rec := recover(); rec != nil {
					log.Error("panic recovered", "err", rec, "stack", string(debug.Stack()))
					apiresponse.Fail(w, RequestIDFrom(r.Context()),
						apperrors.Internal("internal server error", nil))
				}
			}()
			next.ServeHTTP(w, r)
		})
	}
}

// Logger logs request method, path, status, and duration.
func Logger(log *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			ww := &statusWriter{ResponseWriter: w, status: 200}
			next.ServeHTTP(ww, r)
			log.Info("request",
				"method", r.Method,
				"path", r.URL.Path,
				"status", ww.status,
				"duration", time.Since(start),
				"requestId", RequestIDFrom(r.Context()),
			)
		})
	}
}

type statusWriter struct {
	http.ResponseWriter
	status int
}

func (w *statusWriter) WriteHeader(code int) {
	w.status = code
	w.ResponseWriter.WriteHeader(code)
}

// Flush unlocks SSE / streaming when the underlying writer supports it.
func (w *statusWriter) Flush() {
	if f, ok := w.ResponseWriter.(http.Flusher); ok {
		f.Flush()
	}
}

// Unwrap lets http.ResponseController reach the real writer.
func (w *statusWriter) Unwrap() http.ResponseWriter {
	return w.ResponseWriter
}

// CORS allows configured frontend origin(s) with credentials (never *).
// request Origin must exactly match an allowlisted value (localhost ≠ 127.0.0.1).
func CORS(allowedOrigins string) func(http.Handler) http.Handler {
	allow := parseCORSOrigins(allowedOrigins)
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")
			if origin != "" && originAllowed(origin, allow) {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Set("Access-Control-Allow-Credentials", "true")
				w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Request-ID")
				w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
				w.Header().Set("Vary", "Origin")
			} else if origin != "" {
				// Reflect that Origin was considered; do not echo a mismatched allow-origin.
				w.Header().Set("Vary", "Origin")
			}
			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func parseCORSOrigins(raw string) []string {
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		o := strings.TrimSpace(p)
		if o != "" && o != "*" {
			out = append(out, o)
		}
	}
	return out
}

func originAllowed(origin string, allow []string) bool {
	for _, o := range allow {
		if o == origin {
			return true
		}
	}
	return false
}

// MaxBytes limits request body size (default 1MB).
func MaxBytes(n int64) func(http.Handler) http.Handler {
	if n <= 0 {
		n = 1 << 20
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			r.Body = http.MaxBytesReader(w, r.Body, n)
			next.ServeHTTP(w, r)
		})
	}
}

// Auth validates Bearer token and attaches user to context.
func Auth(store repository.Store, authSvc *services.AuthService) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			token := extractBearer(r)
			if token == "" {
				apiresponse.Fail(w, RequestIDFrom(r.Context()), apperrors.Unauthorized("missing authorization token"))
				return
			}
			sess, ok := store.FindSessionByToken(token)
			if !ok {
				apiresponse.Fail(w, RequestIDFrom(r.Context()), apperrors.Unauthorized("invalid or expired session"))
				return
			}
			user, err := authSvc.UserFromSession(sess)
			if err != nil {
				apiresponse.Fail(w, RequestIDFrom(r.Context()), err)
				return
			}
			ctx := context.WithValue(r.Context(), CtxUser, user)
			ctx = context.WithValue(ctx, CtxToken, token)
			ctx = context.WithValue(ctx, CtxSession, sess)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// RequirePermission ensures the authenticated user has perm.
func RequirePermission(perm string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			user := UserFrom(r.Context())
			if user == nil {
				apiresponse.Fail(w, RequestIDFrom(r.Context()), apperrors.Unauthorized("authentication required"))
				return
			}
			if !rbac.HasPermission(user, perm) {
				apiresponse.Fail(w, RequestIDFrom(r.Context()), apperrors.Forbidden("insufficient permissions"))
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func extractBearer(r *http.Request) string {
	h := r.Header.Get("Authorization")
	if h == "" {
		return ""
	}
	parts := strings.SplitN(h, " ", 2)
	if len(parts) == 2 && strings.EqualFold(parts[0], "Bearer") {
		return strings.TrimSpace(parts[1])
	}
	return strings.TrimSpace(h)
}
