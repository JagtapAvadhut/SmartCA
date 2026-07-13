# Smart CA — System Status

**Generated:** 2026-07-12  
**Workspace:** `D:\SmartCA\` (`Go\` + `saas\`)  
**Authority:** Derived from source + executed tests (not estimates).

---

## 1. Executive summary

Smart CA is a CA practice management **demo** with a React frontend and a Go REST API backed by a **concurrency-safe in-memory store** and deterministic seed data. There is **no PostgreSQL** and **no object storage**.

Frontend business data is API-bound (`VITE_API_BASE_URL` → Go). LocalStorage is limited to theme/auth token/UI preferences. Browser QA **112/112** and business QA **24/24** pass against the live Go API.

---

## 2. Current architecture

```
React (Vite) → HTTP REST /api/v1 → Chi handlers → Services → memory.Store → Seed JSON
```

Future target: same stack with PostgreSQL repositories behind `repository.Store`.

## 3–4. Stacks

| Layer | Stack |
|-------|--------|
| Frontend | React 19, TypeScript, Vite 8, TanStack Query 5, Zustand, RHF+Zod, Tailwind 4 |
| Backend | Go 1.26.5, chi v5, bcrypt, uuid, slog, in-memory RWMutex store |

## 5. Folders

- `D:\SmartCA\Go` — Go module `github.com/JagtapAvadhut/smartca-backend`
- `D:\SmartCA\saas` — npm package `smart-ca` (GitHub: JagtapAvadhut/SmartCA)

## 6–7. Run commands

```bash
# Backend
cd D:\SmartCA\Go
go run ./cmd/api
# :8080

# Frontend
cd D:\SmartCA\saas
# .env: VITE_API_BASE_URL=http://localhost:8080/api/v1
npm run dev
# :5173
```

## 8. Environment

Backend: `APP_ENV`, `HTTP_HOST`, `HTTP_PORT`, `FRONTEND_ORIGIN`, `LOG_LEVEL`, `SESSION_TTL`, `DEMO_RESET_ENABLED`  
Frontend: `VITE_API_BASE_URL`, `VITE_APP_NAME`

## 9–11. Auth / RBAC

- Opaque in-memory Bearer sessions; bcrypt `passwordHash` in seed
- Permission middleware on routes; demo users/roles in seed (credentials in local demo docs only)
- `POST /api/v1/demo/reset` requires Super Admin + `DEMO_RESET_ENABLED`

## 12–16. In-memory DB

- Typed collections on `*memory.Store` (Record maps)
- `WithTx` exclusive write + snapshot rollback
- Money: integer paise calculations; JSON rupees
- Restart / demo reset → deterministic seed

## 17–20. Inventories (see linked docs)

| Doc | Path |
|-----|------|
| Go inventory | `Go/docs/GO_BACKEND_INVENTORY.md` |
| Routes (~180) | `Go/docs/API_ROUTE_INVENTORY.md` |
| React inventory | `saas/docs/REACT_FRONTEND_INVENTORY.md` |
| Feature matrix | `FEATURE_API_TRACEABILITY_MATRIX.md` |
| CRUD matrix | `CRUD_COMPLETENESS_MATRIX.md` |
| Gaps | `SYSTEM_GAP_ANALYSIS.md` |

## 21–28. Coverage summary

- Primary modules API-bound: clients, companies, employees, invoices, payments, documents, tasks, compliance (+GST/ITR/TDS/ROC), notes, calendar, accounting, reports, dashboard, users/roles, settings, recycle bin, search, notifications, chat metadata
- Forbidden MockDatabase business path: **disabled** (`getCollection` throws)
- Remaining partial: AI canned replies (explicit demo), document preview text simulation, integrity audit log history in localStorage (meta only), services still take concrete `*memory.Store` (interface exists for PG)

## 29–40. Domain behavior

- Dashboard/Reports: live Go aggregation
- Documents: metadata only; preview simulated
- Accounting: demo journals + statements; unbalanced rejected
- Recycle Bin: archive center APIs
- Settings: backend-owned org/branding/security; theme browser-owned

## 41–48. Verification (this pass)

| Check | Result |
|-------|--------|
| `go test ./...` | PASS |
| `go test -race` | NOT RUN (CGO unavailable) |
| `go build ./cmd/api` | PASS |
| Frontend `tsc` + build | PASS |
| Browser QA | **112 PASS / 0 FAIL** |
| Business QA | **24 PASS / 0 FAIL** |

## 49–50. Remaining gaps

See `SYSTEM_GAP_ANALYSIS.md` post-implementation table. Non-blocking: OpenAPI completeness, departments/branches APIs, full service→interface migration, seed integrity mismatches (~192 invoice_paid_mismatch historical seed rows), race detector CI.

## 51. PostgreSQL readiness

Blueprint: `Go/docs/POSTGRESQL_MIGRATION_BLUEPRINT.md`  
Contract: `repository.Store` + `AdaptMemory`. Handlers stay HTTP-only; swap repository implementation later.

## 52–54. Verdicts

| Verdict | Status |
|---------||--------|
| Demo readiness | **READY** for local client walkthroughs |
| Production readiness | **BLOCKED** — no durable DB, no object storage, demo auth, in-memory sessions |
| PostgreSQL readiness | **ARCHITECTURE READY** for repository swap; not implemented |

## 55. Git state (at report time — verify after commits)

- Frontend remote: `https://github.com/JagtapAvadhut/SmartCA.git` branch `main`
- Backend: local git only (no remote configured)


## Auth CORS fix (2026-07-13)
- Root cause: FRONTEND_ORIGIN only allowed localhost while UI opened as 127.0.0.1.
- Fix: comma-separated allowlist defaulting to localhost + 127.0.0.1; echo matching Origin.
- Verified: qa:auth 14/14, qa:browser 112/112 on http://127.0.0.1:5173.

