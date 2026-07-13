# API Contract Gap Report

**Audit date:** 2026-07-12  
**Compared:** `Go/docs/openapi.yaml` vs `Go/internal/api/routes/routes.go` vs `saas/src/services/*`

---

## 1. Summary

| Area | Finding |
|------|---------|
| Mounted routes | ~**179** handler bindings |
| OpenAPI | Partial **sketch** — far fewer paths; thin schemas |
| Prefer for accuracy | `Go/docs/API_ROUTE_INVENTORY.md`, `Go/docs/API_CONTRACT_AUDIT.md` |
| Frontend contract | Generally aligned with routes; known mismatches below |

---

## 2. OpenAPI incompleteness (P2)

### Documented (sketch)

- `/health/live`, `/health/ready`, `/version`, `/api/v1/version`
- Auth: login, logout, me, forgot/reset/change-password
- `/api/v1/demo/reset`
- Clients: list/create/get/patch/delete (incomplete vs full archive/restore/duplicate)
- Invoices: partial
- Payments: list/create only (mutate/archive incomplete)
- Dashboard, reports/summary, search
- Accounting journals + statements
- Archive GET
- Settings GET/PATCH

### Missing from OpenAPI (major)

| Area | Gap |
|------|-----|
| Collections | companies, employees, documents, tasks, compliance, gst, itr, tds, roc, notes, notifications, calendar-events, activities, audit-logs, users, roles, permissions, **chat** |
| Verbs | archive / restore / duplicate / permanent delete for most resources |
| Payments | update, archive, restore, delete |
| Archive center | restore, permanent, bulk-restore, bulk-permanent |
| Settings | organization GET/PATCH |
| Schemas | Request/response bodies mostly empty; no permission docs; envelope components sketch only |

**Impact:** Generators, partner integration, and contract tests cannot rely on OpenAPI alone.

---

## 3. Frontend ↔ backend contract mismatches

| ID | Severity | Frontend expectation | Backend reality | Gap type |
|----|----------|----------------------|-----------------|----------|
| DOC-DUP | P1 | `POST /documents/:id/duplicate` via `DocumentService.duplicate` | Route mounted; `AllowDuplicate=false` → **400 `"duplicate not supported"`** | Broken contract |
| LOGIN-HIST | P1 | `SettingsService.getLoginHistory` usable data | Returns `[]`; collection seeded; **no route** | Missing API + stub binding |
| DEPT/BR | P2 | (potential org UI) | Seeded `departments` / `branches`; no routes | Backend missing |
| MARK-ALL | P2 | `markAllRead` efficiency | N× `PATCH /notifications/:id` | Missing bulk API |
| RESET-HELPER | P1 residual | Some docs/audit feared `resetDatabase()` throw | Settings UI correctly `POST /demo/reset`; `seed.resetDatabase()` still throws if called | Dead helper footgun |
| ENV-DEFAULT | P3 | `config/env.ts` default `localhost:3000/api` | `httpClient` default `8080/api/v1` | Confusing dual defaults |
| OPENAPI | P2 | Complete contract | Sketch only | Docs gap |

---

## 4. Semantic alignments (working contracts)

These match between frontend services and Go routes (happy path):

| Pattern | Frontend | Backend |
|---------|----------|---------|
| Soft delete | `POST /:id/archive` | mountCRUD Archive |
| Restore | `POST /:id/restore` | Restore |
| Permanent | `DELETE /:id` | PermanentDelete |
| List sort | `sortOrder` mapped to `sortDir` in httpClient/query | `sortDir` |
| Money | Rupees in JSON | Paise internal; rupees out |
| Auth | Bearer opaque token | Session middleware |
| Demo reset | `POST /demo/reset` | AuthHandler.DemoReset |
| Recycle | `/archive*` | ArchiveHandler |
| Accounting | `/accounting/journals|statements` | AccountingHandler |
| Invoice/payment sync | relations.ts no-ops | Server `WithTx` owns side effects |

---

## 5. Auth / permission contract notes

- Companies/employees archive & permanent delete use **`*.edit`** permission (no `*.delete` constants).
- GST/ITR/TDS/ROC: **all verbs** use `*.view`.
- Notes/notifications/calendar/activities: all verbs use `dashboard.view`.
- Payments mutate verbs use `payments.create` (not a separate edit/delete family).
- Demo reset requires role `super_admin` **and** `DEMO_RESET_ENABLED`.

OpenAPI does not document these permission bindings.

---

## 6. Envelope contract

**Success:** `{ "success": true, "data": ..., "meta": { "requestId", "pagination?" } }`  
**Error:** `{ "success": false, "error": { "code", "message", "details" }, "meta": { "requestId" } }`

Frontend `httpClient` unwraps this envelope. OpenAPI components only sketch it.

---

## 7. Recommended remediation order

1. **Fix documents duplicate** — set `AllowDuplicate: true` **or** unmount route + remove UI action (must match).  
2. **Add `GET /login-history`** (or nest under settings) and wire `SettingsService.getLoginHistory`.  
3. **Expand OpenAPI** to full route inventory (can generate from `API_ROUTE_INVENTORY.md`).  
4. **Add `POST /notifications/mark-all-read`** (or bulk PATCH) and simplify frontend.  
5. **Expose or drop** departments/branches seed data.  
6. **Remove or redirect** `seed.resetDatabase()` throw helper to avoid confusion.  
7. **Align `config/env.ts` default** with `httpClient`.

---

## 8. Related docs

- `Go/docs/API_ROUTE_INVENTORY.md`
- `Go/docs/API_CONTRACT_AUDIT.md`
- `Go/docs/openapi.yaml`
- `CRUD_COMPLETENESS_MATRIX.md`
- `SYSTEM_GAP_ANALYSIS.md`
- `FEATURE_API_TRACEABILITY_MATRIX.md`
