# Smart CA Go API — multi-stage production image
# Go version matches go.mod (1.26.5). Seed JSON is embedded via go:embed — no runtime data copy.
# CGO is disabled: dependencies (chi, uuid, x/crypto bcrypt) are pure Go.
#
# Docker build was NOT executed in the authoring environment (Docker unavailable).

# ---------- builder ----------
FROM golang:1.26.5-bookworm AS builder

WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY cmd/ ./cmd/
COPY internal/ ./internal/
COPY pkg/ ./pkg/

# linux/amd64 is the common deploy target; omit GOARCH to use builder default if preferred.
ENV CGO_ENABLED=0 \
    GOOS=linux

RUN go build -trimpath -ldflags="-s -w" -o /out/smartca-api ./cmd/api

# ---------- runtime ----------
# Distroless static + nonroot: no shell, no package manager. Healthcheck uses the binary flag.
FROM gcr.io/distroless/static-debian12:nonroot

WORKDIR /app

COPY --from=builder /out/smartca-api /app/smartca-api

ENV APP_ENV=production \
    HTTP_HOST=0.0.0.0 \
    HTTP_PORT=8080 \
    LOG_LEVEL=info \
    SESSION_TTL=30m \
    DEMO_RESET_ENABLED=true

EXPOSE 8080

USER nonroot:nonroot

# Container HEALTHCHECK should invoke: ["/app/smartca-api", "-healthcheck"]
ENTRYPOINT ["/app/smartca-api"]
