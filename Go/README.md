# Smart CA Backend (Go)

REST API for the Smart CA practice-management UI (`../saas`), backed by **PostgreSQL**.

## Stack (from `go.mod`)

- Go **1.26.5**
- chi **v5.3.1**
- google/uuid **v1.6.0**
- lib/pq **v1.10.9** (PostgreSQL driver)
- golang.org/x/crypto **v0.54.0** (bcrypt; pure Go — `CGO_ENABLED=0` is safe)

## Architecture

```
HTTP (chi) → Handlers → Services → Repository Interface → PostgreSQL Store → PostgreSQL Database
```

Clean architecture with a repository pattern:

- **Handlers** — HTTP request/response handling
- **Services** — business logic layer
- **Repository interface** — persistence contract (`internal/repository`)
- **PostgreSQL store** — concrete implementation (`internal/repository/postgres`)
- **Database** — PostgreSQL 12+, versioned SQL migrations + JSON seed data

## Project structure

```
cmd/api/                    # Entrypoint (ListenAndServe + graceful shutdown + -healthcheck)
internal/api/               # routes, handlers, middleware (CORS, auth, RBAC)
internal/app/                # business services
internal/auth/               # password + session helpers
internal/config/             # env loading
internal/database/           # PostgreSQL connection + migration runner
internal/domain/             # models, errors, money (paise)
internal/repository/         # repository interface and adapters
  ├── interfaces.go          # Store interface contract
  ├── memory/                # in-memory implementation (unit tests)
  └── postgres/               # PostgreSQL implementation
internal/seed/                # embedded data/*.json + seed loader
migrations/                   # SQL migrations (NNN_name.up.sql / .down.sql)
scripts/                      # database setup helper scripts
pkg/apiresponse/              # JSON response envelopes
Dockerfile                    # multi-stage → distroless nonroot
.dockerignore
QUICKSTART.md                 # step-by-step local setup guide
```

Shared documentation (database, API, architecture, historical reports) lives under [`../docs`](../docs).

## Quick start

See [QUICKSTART.md](QUICKSTART.md) for the full walkthrough. Summary:

**Prerequisites:** PostgreSQL 14+ running locally, Go 1.24+.

```bash
# 1. Create the database + user (pick one)
cd scripts
./setup_database.sh        # Linux/macOS
# setup_database.bat       # Windows cmd
# .\check_and_setup.ps1    # Windows PowerShell (also verifies connectivity)

# 2. Configure environment
cd ..
cp .env.example .env        # edit DB_PASSWORD / GEMINI_API_KEY as needed

# 3. Run
go run ./cmd/api
```

On boot the server connects to PostgreSQL, runs any pending migrations, seeds an empty database, and listens on `http://0.0.0.0:8080`.

| Probe | Path |
|-------|------|
| Liveness | `GET /health/live` |
| Readiness | `GET /health/ready` |
| Version | `GET /api/v1/version` |

Container / Compose health helper (no shell required in the distroless image):

```bash
/app/smartca-api -healthcheck
```

## Build

```bash
go build -trimpath -ldflags="-s -w" -o smartca-api ./cmd/api
```

## Configuration

Full reference: [`.env.example`](.env.example). Summary:

| Variable | Default | Notes |
|----------|---------|-------|
| `APP_ENV` | `development` | |
| `HTTP_HOST` | `0.0.0.0` | |
| `HTTP_PORT` | `8080` | |
| `FRONTEND_ORIGIN` | `http://localhost:5173,http://127.0.0.1:5173` | Comma-separated CORS allowlist; never `*` |
| `FRONTEND_ORIGINS` | unset | Overrides `FRONTEND_ORIGIN` when set |
| `LOG_LEVEL` | `info` | |
| `SESSION_TTL` | `30m` | `rememberMe` extends to 7d |
| `DEMO_RESET_ENABLED` | `true` in dev | Gates `POST /api/v1/demo/reset` |
| `DB_HOST` / `DB_PORT` | `localhost` / `5432` | PostgreSQL connection |
| `DB_USER` / `DB_PASSWORD` / `DB_NAME` | `smartca` / — / `smartca` | PostgreSQL credentials |
| `DB_SSLMODE` | `disable` | Use `require` in production |
| `DB_MAX_OPEN_CONNS` / `DB_MAX_IDLE_CONNS` / `DB_CONN_MAX_LIFETIME` | `25` / `5` / `5m` | Connection pool tuning |
| `AI_PROVIDER` | `gemini` | `gemini` \| `mock` |
| `GEMINI_API_KEY` / `GEMINI_MODEL` / `GEMINI_TIMEOUT` / `GEMINI_MAX_TOKENS` | — | Server-side only; never sent to the browser |

Docker Compose sets `FRONTEND_ORIGIN` to the published web origin (`:8080`) because browsers call the UI origin (nginx proxies `/api/*` same-origin).

## Auth & RBAC

- Login: `POST /api/v1/auth/login` with `identifier` (email\|username\|loginId) + `password`
- Opaque Bearer sessions, persisted in the `auth_sessions` table
- Permission-based RBAC checks on every protected route (`internal/rbac`)
- Demo password (seeded users): `SmartCA@2025` — bcrypt hash only; never returned by the API

## Money

Authoritative integers in **paise**; JSON responses expose rupee-scale numbers for the UI. GST math is rounded consistently between frontend and backend.

## Database & migrations

- SQL migration files live in `migrations/` (`NNN_description.up.sql` / `.down.sql`)
- Applied automatically on startup and tracked in `schema_migrations`
- Seed data is embedded JSON (`internal/seed/data/*.json`, `go:embed`) and loads automatically into an empty database
- `POST /api/v1/demo/reset` re-seeds the database for an authenticated `super_admin` when `DEMO_RESET_ENABLED=true`

See [`../docs/database/DATABASE_SETUP.md`](../docs/database/DATABASE_SETUP.md) and [`../docs/database/MIGRATION_GUIDE.md`](../docs/database/MIGRATION_GUIDE.md) for schema details and migration history.

## OpenAPI

[`../docs/api/openapi.yaml`](../docs/api/openapi.yaml) — partial; `internal/api/routes/routes.go` is the source of truth for mounted routes.

## Testing

```bash
gofmt -l .
go vet ./...
go test ./...
go test -race ./...   # requires a C toolchain on some Windows setups
go build ./cmd/api
```

## Docker image

`Dockerfile` (multi-stage):

1. `golang:1.26.5-bookworm` — `go mod download`, `CGO_ENABLED=0 GOOS=linux`, build `./cmd/api`
2. `gcr.io/distroless/static-debian12:nonroot` — binary + `migrations/` only, `ENTRYPOINT ["/app/smartca-api"]`

Seed data is compiled in via `go:embed`; SQL migrations are copied into the image explicitly since `database.Migrate()` reads them from disk at boot.

See the root [`docker-compose.yml`](../docker-compose.yml) for the full `db` → `api` → `web` orchestration.

## Known limitations

- No retry/backoff on initial database connect — rely on Compose `depends_on: condition: service_healthy` for startup ordering
- AI replies depend on `GEMINI_API_KEY`; without it the service falls back to the `mock` provider
- `go test -race` may require a C toolchain (`gcc`) on some Windows setups
