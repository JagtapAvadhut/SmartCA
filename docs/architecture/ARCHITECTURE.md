# Architecture

Canonical reference for how Smart CA is put together. The same diagrams are summarized in the root [README](../../README.md); this document goes one level deeper.

## System overview

```mermaid
flowchart LR
  U["Browser"] --> R["React 19 + Vite\n(saas/)"]
  R -->|"HTTPS /api/v1\nJSON + Bearer token"| A["Go REST API\n(Go/)"]
  A --> MW["Middleware\nCORS → Auth → RBAC"]
  MW --> H["Handlers\n(internal/api/handlers)"]
  H --> S["Application Services\n(internal/app/services)"]
  S --> Repo["Repository interface\n(internal/repository)"]
  Repo --> PG["PostgreSQL 18\n(internal/repository/postgres)"]
  S -->|"AI requests only"| AI["AI service\n(internal/ai)"]
  AI -->|"server-side only, never browser-visible"| G["Google Gemini\n(gemini-2.5-flash)"]
```

Key rule: the React app **never** talks to PostgreSQL or Gemini directly. Every read/write and every AI call is mediated by the Go API, which enforces authentication, RBAC, and money-math correctness.

## Docker Compose topology

```mermaid
flowchart TB
  subgraph net["Docker network: smartca-net"]
    DB[("db\npostgres:18-alpine\nvolume: db-data")]
    API["api\ndistroless nonroot Go binary\n:8080 (internal, expose only)"]
    WEB["web\nnginx-unprivileged\n:8080"]
    DB -->|"depends_on: service_healthy\n(pg_isready)"| API
    API -->|"depends_on: service_healthy\n(-healthcheck flag)"| WEB
  end
  Browser(["Browser"]) -->|"published :8080"| WEB
  WEB -->|"/api/* reverse proxy"| API
  API --> DB
```

`docker compose up --build` brings the three services up in that order automatically via `depends_on: condition: service_healthy`.

## Request flow (authenticated read)

```mermaid
sequenceDiagram
  participant Browser
  participant Nginx as nginx (Docker only)
  participant API as Go API
  participant MW as Auth/RBAC middleware
  participant Svc as Service layer
  participant DB as PostgreSQL

  Browser->>Nginx: GET /api/v1/clients (Authorization: Bearer ...)
  Nginx->>API: proxy_pass (same-origin in Docker; direct in native dev)
  API->>MW: validate session token
  MW->>MW: resolve user → role → permissions
  MW-->>API: allow (clients.view) or 401/403
  API->>Svc: CRUDService.List(ColClients)
  Svc->>DB: SELECT ... FROM clients WHERE ...
  DB-->>Svc: rows
  Svc-->>API: []models.Record
  API-->>Browser: {"success":true,"data":[...],"meta":{"requestId":"..."}}
```

## RBAC model

```mermaid
flowchart TD
  Req["Incoming request"] --> Auth{"Valid Bearer session?"}
  Auth -- no --> R401["401 Unauthorized"]
  Auth -- yes --> Role["Resolve user → role → permissions\n(roles, role_permissions, user_permissions)"]
  Role --> Perm{"Has required permission?\ne.g. invoices.create"}
  Perm -- no --> R403["403 Forbidden"]
  Perm -- yes --> Handler["Handler → Service → PostgreSQL"]
```

Permissions are granular per module + action (`clients.view`, `invoices.create`, `settings.roles`, …) defined in `Go/internal/rbac/rbac.go`. Roles bundle permissions; users may also receive direct permission overrides. The React UI reads the same permission set to hide/disable actions, but every mutation is re-validated server-side — the frontend is never the source of authorization truth.

## Folder structure

```mermaid
flowchart LR
  Root["SmartCA/"] --> Go["Go/ — REST API"]
  Root --> Saas["saas/ — React SPA"]
  Root --> Docs["docs/"]
  Root --> Compose["docker-compose.yml"]

  Go --> GoCmd["cmd/api"]
  Go --> GoInternal["internal/\n(api, app, auth, config, database, domain, repository, rbac, seed, ai)"]
  Go --> GoMigrations["migrations/"]
  Go --> GoScripts["scripts/"]

  Saas --> SaasSrc["src/\n(pages, components, services, store, hooks)"]
  Saas --> SaasScripts["scripts/ (Playwright QA)"]

  Docs --> DocsShots["screenshots/"]
  Docs --> DocsArch["architecture/"]
  Docs --> DocsApi["api/openapi.yaml"]
  Docs --> DocsDb["database/"]
  Docs --> DocsReports["reports/"]
```

## Related documents

- [Database setup](../database/DATABASE_SETUP.md) and [migration history](../database/MIGRATION_GUIDE.md)
- [OpenAPI reference](../api/openapi.yaml)
- [Historical release reports](../reports)
