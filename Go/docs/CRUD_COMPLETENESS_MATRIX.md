# CRUD Completeness Matrix

**Audit date:** 2026-07-12  
**Sources:** `Go/internal/api/routes/routes.go`, `Go/cmd/api/main.go`, `saas/src/services/*`

### Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Implemented and wired end-to-end |
| ⚠️ | Mounted / called but broken or limited |
| ❌ | Not implemented |
| UI | Frontend service method exists |
| API | Backend route exists and handler succeeds for happy path |

Duplicate column distinguishes **route mounted** vs **handler allows** (`AllowDuplicate`).

---

## Core business entities

| Entity | List | Get | Create | Update | Archive | Restore | Permanent delete | Duplicate (UI) | Duplicate (API effective) | Notes |
|--------|:----:|:---:|:------:|:------:|:-------:|:-------:|:----------------:|:--------------:|:-------------------------:|-------|
| clients | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | AllowDuplicate true |
| companies | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Archive/delete perm = `companies.edit` |
| employees | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Archive/delete perm = `employees.edit` |
| invoices | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Dedicated InvoiceHandler |
| payments | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | No duplicate by design |
| documents | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ UI | ⚠️ **400** | Route mounted; `AllowDuplicate=false` |
| tasks | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | |
| notes | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ mount | ❌ | Frontend may still expose duplicate via factory if used — notes mount has no dup |
| compliance | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | |
| gst | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | All verbs gated `gst.view` |
| itr | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | |
| tds | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | |
| roc | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | |

---

## Supporting entities

| Entity | List | Get | Create | Update | Archive | Restore | Permanent delete | Duplicate | Notes |
|--------|:----:|:---:|:------:|:------:|:-------:|:-------:|:----------------:|:---------:|-------|
| notifications | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | markAllRead = N× Update |
| calendar-events | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | Collection key `calendar` |
| activities | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | |
| audit-logs | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | |
| users | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | Password hashed on create/update |
| roles | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | Frontend duplicateRole uses create+copy pattern, not `/duplicate` |
| permissions | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | |
| chat | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | AI messages via PATCH session |

---

## Singletons & specialty (not generic CRUD mounts)

| Resource | Read | Write | Notes |
|----------|:----:|:-----:|-------|
| settings | ✅ GET `/settings` | ✅ PATCH | Singleton |
| organization | ✅ GET `/settings/organization` | ✅ PATCH | Singleton |
| dashboard | ✅ GET | ❌ | Computed |
| reports/summary | ✅ GET | ❌ | Computed |
| search | ✅ GET | ❌ | |
| accounting journals | ✅ GET | ✅ POST | Balance validation |
| accounting statements | ✅ GET | ❌ | |
| archive list | ✅ GET | — | |
| archive restore / permanent / bulk | — | ✅ POST | Recycle Bin |

---

## Seeded without CRUD API

| Collection | Seeded | List API | CRUD | Frontend binding |
|------------|-------:|:--------:|:----:|------------------|
| loginHistory | 40 | ❌ | ❌ | `getLoginHistory` → `[]` |
| departments | 8 | ❌ | ❌ | None |
| branches | 5 | ❌ | ❌ | None |
| sessions (seed docs) | 5 | ❌ | ❌ | N/A — ≠ runtime auth sessions |
| journals | 0 start | via accounting | via accounting | accountingEngine |

---

## Soft-delete model (all CRUD collections)

| Verb | HTTP | Semantics |
|------|------|-----------|
| Soft delete | `POST /{col}/{id}/archive` | Sets archived flags; excluded from default lists |
| Restore | `POST /{col}/{id}/restore` | Clears archive |
| Hard delete | `DELETE /{col}/{id}` | Permanent |
| Center restore/purge | `POST /archive/*` | Cross-collection Recycle Bin |

Frontend `createCrudService.delete` maps to **permanent** DELETE. Soft-delete UI uses `archive()`.

---

## Completeness gaps (actionable)

1. **Documents duplicate** — enable `AllowDuplicate: true` on Documents handler **or** remove frontend duplicate / unmount route.  
2. **loginHistory / departments / branches** — add list (and optionally CRUD) routes **or** stop seeding / remove UI expectations.  
3. **Notifications mark-all-read** — add bulk endpoint; replace N+1 frontend loop.  
4. **Notes duplicate** — if UI offers it via shared factory, either mount dup or hide action.  
5. **Payments duplicate** — intentionally absent; keep UI without duplicate.

---

## Related docs

- `FEATURE_API_TRACEABILITY_MATRIX.md`
- `Go/docs/API_ROUTE_INVENTORY.md`
- `API_CONTRACT_GAP_REPORT.md`
- `SYSTEM_GAP_ANALYSIS.md`
