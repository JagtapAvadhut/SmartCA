# Smart CA Backend (Go)

In-memory REST API for the Smart CA practice-management UI (`../saas`).

> **Demo / development only.** No durable database. Process restart reloads the embedded seed. **Not for production customer data.**

## Stack (from `go.mod`)

- Go **1.26.5**
- chi **v5.3.1**
- google/uuid **v1.6.0**
- golang.org/x/crypto **v0.54.0** (bcrypt; pure Go — `CGO_ENABLED=0` is safe)

## Architecture

```
HTTP (chi) → Handlers → Services → memory.Store → deterministic seed (go:embed)
```

Layers stay PostgreSQL-migration friendly via repository boundaries; current concrete store is in-memory.

## Project structure

```
cmd/api/           # Entrypoint (ListenAndServe + graceful shutdown + -healthcheck)
internal/api/      # routes, handlers, middleware (CORS, auth, RBAC)
internal/app/      # business services
internal/auth/     # password + session helpers
internal/config/   # env loading
internal/domain/   # models, errors, money (paise)
internal/repository/memory/
internal/seed/     # embed data/*.json
pkg/apiresponse/   # JSON envelopes
docs/              # OpenAPI, inventories, blueprints
Dockerfile         # multi-stage → distroless nonroot
.dockerignore
```

## Run (native)

```bash
cd Go
cp .env.example .env   # optional
go run ./cmd/api
```

Listens on `http://0.0.0.0:8080` by default.

| Probe | Path |
|-------|------|
| Liveness | `GET /health/live` |
| Readiness | `GET /health/ready` |
| Version | `GET /api/v1/version` |

Container / Compose health helper (no shell required in distroless):

```bash
./smartca-api -healthcheck
```

## Build

```bash
go build -trimpath -ldflags="-s -w" -o smartca-api.exe ./cmd/api
```

## Configuration

See `.env.example`. Summary:

| Variable | Default | Notes |
|----------|---------|-------|
| `APP_ENV` | `development` | |
| `HTTP_HOST` | `0.0.0.0` | |
| `HTTP_PORT` | `8080` | |
| `FRONTEND_ORIGIN` | `http://localhost:5173,http://127.0.0.1:5173` | Comma-separated; never `*` |
| `FRONTEND_ORIGINS` | unset | Overrides `FRONTEND_ORIGIN` when set |
| `LOG_LEVEL` | `info` | |
| `SESSION_TTL` | `30m` | `rememberMe` → 7d |
| `DEMO_RESET_ENABLED` | true in dev | `POST /api/v1/demo/reset` |

Docker Compose sets `FRONTEND_ORIGIN` to the published web origins (`:8080`) because browsers call the UI origin (same-origin `/api` proxy).

## Auth & RBAC

- Login: `POST /api/v1/auth/login` with `identifier` (email|username|loginId) + `password`
- Opaque Bearer sessions in memory
- RBAC permission checks on protected routes
- Demo password (seeded users): `SmartCA@2025` — hashes only in store; never returned

## Money

Authoritative integers in **paise**; JSON often exposes rupee numbers for the UI. Invoice GST math aligns with the frontend demo rule (e.g. 18% rounded).

## Seed / reset

- Embedded JSON under `internal/seed/data/`
- Restart → seed reload
- `POST /api/v1/demo/reset` (auth + `super_admin` + flag)

## OpenAPI

`docs/openapi.yaml` — may be partial relative to mounted routes. Prefer `internal/api/routes/routes.go` as source of truth.

## Testing

```bash
go vet ./...
go test ./...
go test -race ./...   # requires CGO/gcc on some Windows setups
go build ./cmd/api
```

## Docker image design

`Dockerfile` (multi-stage):

1. `golang:1.26.5-bookworm` — `go mod download`, `CGO_ENABLED=0 GOOS=linux`, build `./cmd/api`
2. `gcr.io/distroless/static-debian12:nonroot` — binary only, `ENTRYPOINT ["/app/smartca-api"]`

Seed files are **compiled in** via `go:embed` — no runtime JSON copy.

**Docker build/run was NOT executed in the environment that authored these files.**

Workspace Compose (sibling `saas/`): `../docker-compose.yml` — service name `api`, internal port `8080`, healthcheck uses `-healthcheck`.

## Known limitations

- No PostgreSQL / persistence
- Restart resets data
- Distroless has no shell (use binary healthcheck)
- Docker runtime verification: **NOT RUN** here

## Future PostgreSQL

See `docs/POSTGRESQL_MIGRATION_BLUEPRINT.md`.
