# System Gap Analysis

**Workspace:** `D:\SmartCA` (Go backend + saas frontend)  
**Audit date:** 2026-07-12  
**Status convention:** All listed gaps are **OPEN** unless a future implementation pass updates them. Sorted by dependency / severity (P0 → P4).

### Evidence baseline (not gap closure)

| Suite | Result | Notes |
|-------|--------|-------|
| Browser QA | **112/112 PASS** | Against live Go API (`saas/qa-results.json`) |
| Business QA | **24/24 PASS** | Against live Go API (`saas/business-qa-results.json`) |

Overall demo is healthy; gaps below are known incompletenesses / contract defects / platform debt.

---

## Priority legend

| Priority | Meaning |
|----------|---------|
| **P0** | Blocks core demo path or data integrity if hit |
| **P1** | Broken or empty feature binding users can hit |
| **P2** | Missing API / efficiency / contract completeness |
| **P3** | UX / demo-quality polish |
| **P4** | Architecture debt for production / PostgreSQL |

---

## P0 / P1 — Correctness & binding

### GAP-P1-001 — Demo reset helper throw footgun

| Field | Value |
|-------|-------|
| **ID** | GAP-P1-001 |
| **Priority** | P1 (audit also flagged P0 risk) |
| **Depends on** | — |
| **Status** | OPEN |
| **Problem** | `saas/src/db/seed.ts` `resetDatabase()` **throws** and tells callers to use `POST /api/v1/demo/reset`. Any code path still calling the seed helper fails. |
| **Verified mitigation** | `SettingsPage` Reset button and QA expose already call `http.post('/demo/reset')`. |
| **Residual** | Exported throw helper + possible stale docs claiming Settings still uses it. |
| **Fix** | Make `resetDatabase()` delegate to HTTP (or delete export); keep single source of truth. |
| **Related** | `FRONTEND_DATA_SOURCE_AUDIT.md`, `API_CONTRACT_GAP_REPORT.md` |

### GAP-P1-002 — Login history empty

| Field | Value |
|-------|-------|
| **ID** | GAP-P1-002 |
| **Priority** | P1 |
| **Depends on** | GAP-P2-001 (backend route) ideally |
| **Status** | OPEN |
| **Problem** | `SettingsService.getLoginHistory()` returns `[]`. Collection `loginHistory` is seeded (40) and written on login, but there is **no HTTP list route**. |
| **Impact** | Settings/UI cannot show login history from API. |
| **Fix** | Add `GET /api/v1/login-history` (RBAC: settings/security) + wire service; or remove UI affordance. |
| **Related** | `CRUD_COMPLETENESS_MATRIX.md`, `FEATURE_API_TRACEABILITY_MATRIX.md` |

### GAP-P1-003 — Documents duplicate broken

| Field | Value |
|-------|-------|
| **ID** | GAP-P1-003 |
| **Priority** | P1 |
| **Depends on** | — |
| **Status** | OPEN |
| **Problem** | Routes mount `POST /documents/{id}/duplicate`, but `main.go` leaves `Documents` `AllowDuplicate` **false** → handler returns **400**. Frontend `DocumentService.duplicate` still calls the endpoint. |
| **Impact** | Document duplicate action fails at runtime. |
| **Fix** | Set `AllowDuplicate: true` **or** unmount route + remove UI duplicate. Align OpenAPI/audit “Dup” column. |
| **Related** | `API_CONTRACT_GAP_REPORT.md`, `CRUD_COMPLETENESS_MATRIX.md` |

---

## P2 — Missing APIs / contract / efficiency

### GAP-P2-001 — No `/login-history` route

| Field | Value |
|-------|-------|
| **ID** | GAP-P2-001 |
| **Priority** | P2 |
| **Depends on** | — |
| **Status** | OPEN |
| **Problem** | Seeded + written collection without REST surface. |
| **Fix** | Add list (and optional filters by `userId`) endpoint. Unblocks GAP-P1-002. |

### GAP-P2-002 — Departments / branches seeded, no API

| Field | Value |
|-------|-------|
| **ID** | GAP-P2-002 |
| **Priority** | P2 |
| **Depends on** | — |
| **Status** | OPEN |
| **Problem** | `departments` (8) and `branches` (5) loaded into memory store; no routes; frontend does not bind. |
| **Fix** | Expose read CRUD **or** stop seeding / document as unused. |

### GAP-P2-003 — Notifications `markAllRead` is N+1

| Field | Value |
|-------|-------|
| **ID** | GAP-P2-003 |
| **Priority** | P2 |
| **Depends on** | — |
| **Status** | OPEN |
| **Problem** | Frontend lists unread then `PATCH` each id. Works (browser QA covers mark all read) but scales poorly. |
| **Fix** | `POST /notifications/mark-all-read` (or bulk update) + single service call. |

### GAP-P2-004 — OpenAPI incomplete

| Field | Value |
|-------|-------|
| **ID** | GAP-P2-004 |
| **Priority** | P2 |
| **Depends on** | Stable route inventory (done) |
| **Status** | OPEN |
| **Problem** | `openapi.yaml` is a thin sketch vs ~179 routes; weak schemas; missing permissions. |
| **Fix** | Expand to full inventory; generate contract tests. |
| **Related** | `API_CONTRACT_GAP_REPORT.md` |

---

## P3 — UX / demo polish

### GAP-P3-001 — Recycle Bin still says LocalStorage

| Field | Value |
|-------|-------|
| **ID** | GAP-P3-001 |
| **Priority** | P3 |
| **Depends on** | — |
| **Status** | OPEN |
| **Problem** | `RecycleBinPage` description: “All actions persist in LocalStorage.” False — uses Archive API. |
| **Fix** | Update copy to “Go backend / API”. |

### GAP-P3-002 — AI chat canned replies

| Field | Value |
|-------|-------|
| **ID** | GAP-P3-002 |
| **Priority** | P3 |
| **Depends on** | Optional LLM provider |
| **Status** | OPEN (acceptable for demo) |
| **Problem** | `ChatService.sendMessage` appends hardcoded assistant text then PATCHes session. |
| **Fix** | Optional real model integration later. |

### GAP-P3-003 — Document mock preview text

| Field | Value |
|-------|-------|
| **ID** | GAP-P3-003 |
| **Priority** | P3 |
| **Depends on** | Object storage (optional) |
| **Status** | OPEN (acceptable for demo) |
| **Problem** | Preview/download synthesized client-side; no blob store. |
| **Fix** | Real file storage when productizing. |

### GAP-P3-004 — Dual API base URL defaults

| Field | Value |
|-------|-------|
| **ID** | GAP-P3-004 |
| **Priority** | P3 |
| **Depends on** | — |
| **Status** | OPEN |
| **Problem** | `config/env.ts` defaults to `localhost:3000/api`; `httpClient` defaults to `8080/api/v1`. |
| **Fix** | Align or deprecate unused env helper. |

### GAP-P3-005 — Stale frontend architecture docs

| Field | Value |
|-------|-------|
| **ID** | GAP-P3-005 |
| **Priority** | P3 |
| **Depends on** | — |
| **Status** | OPEN |
| **Problem** | Some `saas/docs/*` still describe MockDatabase as runtime. |
| **Fix** | Update or mark historical; prefer new inventory audits. |

---

## P4 — Architecture / production readiness

### GAP-P4-001 — No repository interfaces (`*memory.Store` concrete)

| Field | Value |
|-------|-------|
| **ID** | GAP-P4-001 |
| **Priority** | P4 |
| **Depends on** | — |
| **Status** | OPEN |
| **Problem** | All services take concrete `*memory.Store`. Blocks clean PostgreSQL swap. |
| **Fix** | Introduce ports + memory adapter first; then PG adapter. |
| **Related** | `Go/docs/POSTGRESQL_MIGRATION_BLUEPRINT.md` |

### GAP-P4-002 — Thin automated test coverage beyond payment/memory/http smoke

| Field | Value |
|-------|-------|
| **ID** | GAP-P4-002 |
| **Priority** | P4 |
| **Depends on** | GAP-P4-001 helpful for store fakes |
| **Status** | OPEN |
| **Problem** | Strong payment + memory + money tests; weak coverage for most CRUD, RBAC matrix, demo reset, documents duplicate flag, archive bulk, accounting service unit tests. |
| **Fix** | Expand Go tests; keep 112/24 as E2E regression gates; do not invent `VERIFIED_E2E` per route without proofs. |

### GAP-P4-003 — Process-memory only (no durable DB)

| Field | Value |
|-------|-------|
| **ID** | GAP-P4-003 |
| **Priority** | P4 |
| **Depends on** | GAP-P4-001 |
| **Status** | OPEN |
| **Problem** | Restart resets to seed; single-node writer model. |
| **Fix** | Execute PostgreSQL blueprint phases. |

---

## Dependency order (recommended fix sequence)

```text
GAP-P1-003 (doc duplicate flag)
    │
GAP-P2-001 → GAP-P1-002 (login history API then frontend)
    │
GAP-P1-001 (remove throw helper)
    │
GAP-P2-003 (bulk mark-all-read)
    │
GAP-P2-002 (departments/branches decide)
    │
GAP-P3-001 / P3-004 / P3-005 (copy & docs)
    │
GAP-P2-004 (OpenAPI expansion)
    │
GAP-P4-001 → GAP-P4-003 → GAP-P4-002 (ports → PG → broader tests)
```

P3-002 / P3-003 remain demo-acceptable until productization.

---

## Related docs

| Doc | Role |
|-----|------|
| `FEATURE_API_TRACEABILITY_MATRIX.md` | Feature status including COMPLETE_VERIFIED flows |
| `CRUD_COMPLETENESS_MATRIX.md` | Verb-level completeness |
| `API_CONTRACT_GAP_REPORT.md` | OpenAPI + FE/BE mismatches |
| `Go/docs/API_ROUTE_INVENTORY.md` | Per-route IMPLEMENTED_NOT_E2E_VERIFIED |
| `Go/docs/POSTGRESQL_MIGRATION_BLUEPRINT.md` | PG plan |
| `AUTH_RBAC_TEST_MATRIX.md` | Auth/RBAC test coverage map |
| `saas/docs/FRONTEND_DATA_SOURCE_AUDIT.md` | Frontend transport audit |

## Post-implementation updates (2026-07-13)

| Gap ID | Final status | Evidence |
|--------|--------------|----------|
| GAP-P1-001 Settings Reset Database | FIXED_VERIFIED | SettingsPage posts /demo/reset |
| GAP-P1-002 getLoginHistory empty | FIXED_VERIFIED | GET /login-history + SettingsService/AuthService |
| GAP-P1-003 documents duplicate 400 | FIXED_VERIFIED | AllowDuplicate=true; smoke DOC_DUP OK |
| GAP-P2-001 markAllRead N+1 | FIXED_VERIFIED | POST /notifications/mark-all-read |
| GAP-P3-001 Recycle Bin LocalStorage copy | FIXED_VERIFIED | description updated |
| GAP-P4-001 repository interfaces | PARTIAL | internal/repository Store + AdaptMemory added; services still use concrete memory (gradual migration) |

Business QA after fixes: 24/24 PASS
Browser QA after fixes: see qa-results.json


## Auth CORS fix (2026-07-13)
- Root cause: FRONTEND_ORIGIN only allowed localhost while UI opened as 127.0.0.1.
- Fix: comma-separated allowlist defaulting to localhost + 127.0.0.1; echo matching Origin.
- Verified: qa:auth 14/14, qa:browser 112/112 on http://127.0.0.1:5173.

