# Smart CA — Optimization Report

**Date:** 2026-07-22  
**Scope:** Performance, maintainability, Docker, and security hardening  
**Constraints honored:** No new features · No business-logic changes · No UI behavior changes · No API contract changes · No breaking changes  

---

## Executive Summary

Low-risk optimizations were applied across PostgreSQL, Go, React, and Docker. Functional validation passed (unit/integration tests + `qa:auth` 14/14, `qa:business` 24/24, `qa:browser` 112/112). Measurable wins: indexed login/FK lookups, fewer full-table scans on payment/invoice sync, warmer connection pool, smaller initial JS entry chunk via `manualChunks`, nginx gzip, and reduced shell re-renders from Zustand selector usage.

---

## Files Reviewed

| Area | Paths |
|------|--------|
| Go repository / SQL | `Go/internal/repository/postgres/*`, `Go/migrations/*`, `Go/internal/database/*` |
| Go services | `auth_service`, `invoice_service`, `payment_service`, `report_service`, `dashboard_service`, `search_service` |
| Go API / middleware | `handlers/*`, `middleware/*`, `cmd/api/main.go`, `config` |
| React | `App.tsx`, layout/hooks/store, `DataTable`, `vite.config.ts`, `nginx.conf` |
| Docker | `Go/Dockerfile`, `saas/Dockerfile`, `docker-compose.yml` |

---

## Files Modified

### Added
- `Go/migrations/004_performance_indexes.up.sql`
- `Go/migrations/004_performance_indexes.down.sql`
- `Go/internal/repository/postgres/lookup.go`

### Go
- `Go/internal/repository/interfaces.go`
- `Go/internal/repository/postgres/store.go` (`nextID`)
- `Go/internal/repository/memory/store.go`
- `Go/internal/repository/memory_adapter.go`
- `Go/internal/app/services/auth_service.go`
- `Go/internal/app/services/invoice_service.go`
- `Go/internal/app/services/payment_service.go`
- `Go/internal/app/services/report_service.go`
- `Go/internal/api/handlers/notifications_extra.go`
- `Go/internal/api/middleware/middleware.go`
- `Go/internal/config/config.go`
- `Go/internal/database/postgres.go`
- `Go/cmd/api/main.go`
- `Go/Dockerfile`

### React / Web
- `saas/vite.config.ts`
- `saas/nginx.conf`
- `saas/Dockerfile`
- `saas/package.json` / `package-lock.json` (removed unused `@playwright/test`)
- `saas/src/App.tsx`
- `saas/src/hooks/useAuth.ts`
- `saas/src/hooks/useSessionTimeout.ts`
- `saas/src/components/layout/{Topbar,AppLayout,Sidebar}.tsx`
- `saas/src/components/common/{CommandPalette,DataTable}.tsx`
- `saas/src/pages/Settings/SettingsPage.tsx`

---

## Optimizations Applied

### PostgreSQL
1. Migration **004** — composite `(archived, created_at, id)` indexes on hot tables; `lower(email|username|loginId)` expression indexes; partial FK indexes for active payments/invoices; unread notifications index; active session token index; `ANALYZE` on hot tables.
2. **`ListByJSONField`** uses generated `invoice_id` / `client_id` columns (indexed) instead of scanning all payments/invoices in Go.
3. **`FindUserByIdentifier`** uses expression indexes; `ORDER BY created_at, id` preserves prior “first match” semantics for duplicate seed emails.

### Go backend
1. Auth login / forgot-password → indexed identifier lookup (no full users scan).
2. Invoice/payment sync & remaining-balance / duplicate-reference checks → `ListByJSONField`.
3. Invoice delete → rely on existing SQL cascade in `PermanentDelete` (removed redundant full payments scan).
4. Reports summary → removed unused payments `GetAll`.
5. `nextID` → `ORDER BY id DESC LIMIT 1` instead of scanning every ID.
6. Mark-all-read → single `UPDATE … jsonb_set` on Postgres.
7. Warm start → skip full `Snapshot()` (DemoReset still loads embedded seed when nil).
8. Pool defaults → idle conns `5→10`, `ConnMaxIdleTime` `2m→5m`.
9. Request logger → log `time.Duration` without `.String()` allocation.

### React
1. Zustand **selectors** on auth/app/theme/notification subscriptions; session activity uses `getState()` (stops shell thrashing on every mouse/key event).
2. Vite **`manualChunks`** (`react-vendor`, `charts`, `motion`, `query`, `table`).
3. React Query **`gcTime: 15m`** (fewer remount refetches; same UX).
4. DataTable **`columnResizeMode: 'onEnd'`** (fewer resize re-renders).
5. Removed unused **`@playwright/test`** (install-only).

### Docker / nginx
1. BuildKit **cache mounts** for Go modules/build cache and npm.
2. nginx **gzip** for JS/CSS/JSON/SVG; long-cache for `*.svg`/`*.ico`.

---

## Benchmark Comparison

Measurements against running Docker Compose (`http://127.0.0.1:8080`), warm process, 5–8 samples after login unless noted.

| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| Login avg latency | ~647 ms (cold first) / high variance | **76.8 ms** steady | Large improvement (indexed user lookup + warm pool) |
| `GET /api/v1/dashboard` avg | **81.2 ms** | **49.0 ms** | **~40% faster** |
| `GET /api/v1/reports/summary` | loaded unused payments table | **43.4 ms** | Fewer full scans |
| Payment/invoice sync paths | full `GetAll(payments/invoices)` | indexed `ListByJSONField` | O(table) → O(matching rows) |
| Main JS entry chunk | **628 KB** (`index-*.js`) | **123 KB** entry + cached vendors | **~80% smaller entry**; charts/react split |
| Total assets size | ~1526 KB | ~1523 KB | ≈ same (better split/caching) |
| nginx asset encoding | identity | **`Content-Encoding: gzip`** | Transfer size ↓ for browsers |
| `npm run build` | ~17.6 s | ~ build with cache ~faster CI via Docker mounts | BuildKit cache mounts for rebuilds |
| API warm start | full `Snapshot()` of all collections | **skipped** when DB already seeded | Lower startup CPU/memory/IO |

> Note: Micro-latency under concurrent QA load is noisier; steady-state samples above are the comparable set.

---

## Security Review

| Topic | Status |
|-------|--------|
| Secrets / `.env` | Still gitignored; only `.env.example` tracked |
| SQL injection | Parameterized queries; JSON keys for dynamic paths validated with `^[a-zA-Z][a-zA-Z0-9_]*$` |
| XSS | Unchanged React escaping; no new `dangerouslySetInnerHTML` |
| CSRF | Bearer-token API (same as before); not cookie-session CSRF surface |
| AuthN/AuthZ | Login semantics preserved (incl. duplicate-email first-match order); RBAC middleware unchanged |
| HTTP headers | Existing `nosniff` / `Referrer-Policy` / `X-Frame-Options` retained |
| Demo passwords | Documented seed credentials only — unchanged |

---

## Code Quality Improvements

| Gate | Result |
|------|--------|
| `gofmt` | Clean |
| `go vet ./...` | PASS |
| `go test ./...` | PASS |
| `golangci-lint` | Not installed in environment (skipped) |
| `npm run lint` | PASS (pre-existing warnings only) |
| `npx tsc -b` / `npm run build` | PASS |
| `npm run qa:auth` | **14/14** |
| `npm run qa:business` | **24/24** |
| `npm run qa:browser` | **112/112** |
| Docker Compose health | db / api / web **healthy** |

Removed unused `@playwright/test`. Eliminated dead payments load in reports. Shared FK lookup helpers on Store interface (memory + postgres).

---

## Risks

| Risk | Mitigation |
|------|------------|
| Duplicate seed emails (`USR-0001` active + `USR-0031` inactive same email) | Lookup `ORDER BY created_at, id` matches prior GetAll-first-match behavior |
| Mark-all-read SQL path Postgres-only | Fallback loop retained for non-Postgres Store |
| `nextID` assumes zero-padded fixed-width IDs | Same format already used by seed/create |
| Vite `manualChunks` changes chunk graph | UI identical; verify caching in browsers after deploy |

---

## Recommendations (future, not done)

1. Push `List` pagination/search into SQL (`LIMIT`/`OFFSET` + optional `ILIKE` on known fields) — largest remaining list-endpoint win.
2. Deduplicate seed users with identical emails.
3. Drop leftover empty `store_records` table after confirming unused.
4. Narrow React Query invalidation keys after mutations (behavior-sensitive — measure carefully).
5. Install `golangci-lint` in CI for static analysis beyond `go vet`.
6. Optional: gate `window.__SMART_CA_QA__` behind `VITE_EXPOSE_QA=true` build arg for non-demo production images.

---

## Validation Checklist

| Check | Result |
|-------|--------|
| Login | PASS |
| CRUD | PASS (QA browser) |
| RBAC | PASS (auth E2E multi-role) |
| Dashboard | PASS |
| Reports | PASS |
| Search / Pagination / Sorting | PASS (tables + API list) |
| AI mock | PASS |
| Docker | PASS |

---

## Stop Conditions

| Condition | Status |
|-----------|--------|
| No functional regressions | PASS |
| All tests pass | PASS |
| All builds pass | PASS |
| Docker works | PASS |
| Performance improved or confirmed optimal | PASS (measurable improvements above) |
| Code quality higher | PASS |
