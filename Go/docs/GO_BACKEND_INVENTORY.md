# Go Backend Inventory

**Root:** `D:\SmartCA\Go`  
**Module:** `github.com/JagtapAvadhut/smartca-backend` (`go 1.26.5`)  
**Audit date:** 2026-07-12  
**OpenAPI:** `docs/openapi.yaml` (partial sketch; see `API_ROUTE_INVENTORY.md` / `API_CONTRACT_AUDIT.md` for full routes)

**Domain model (global):** `models.Record` = `map[string]any` — no typed business entity structs.

---

## 1. Package / file inventory (36 `.go` files)

| Absolute path | Package |
|---|---|
| `D:\SmartCA\Go\cmd\api\main.go` | `main` |
| `D:\SmartCA\Go\internal\api\routes\routes.go` | `routes` |
| `D:\SmartCA\Go\internal\api\handlers\auth.go` | `handlers` |
| `D:\SmartCA\Go\internal\api\handlers\crud.go` | `handlers` |
| `D:\SmartCA\Go\internal\api\handlers\health.go` | `handlers` |
| `D:\SmartCA\Go\internal\api\handlers\helpers.go` | `handlers` |
| `D:\SmartCA\Go\internal\api\handlers\invoice_payment.go` | `handlers` |
| `D:\SmartCA\Go\internal\api\handlers\misc.go` | `handlers` |
| `D:\SmartCA\Go\internal\api\middleware\middleware.go` | `middleware` |
| `D:\SmartCA\Go\internal\app\services\accounting_service.go` | `services` |
| `D:\SmartCA\Go\internal\app\services\archive_service.go` | `services` |
| `D:\SmartCA\Go\internal\app\services\auth_service.go` | `services` |
| `D:\SmartCA\Go\internal\app\services\bench_test.go` | `services_test` |
| `D:\SmartCA\Go\internal\app\services\collections.go` | `services` |
| `D:\SmartCA\Go\internal\app\services\crud_service.go` | `services` |
| `D:\SmartCA\Go\internal\app\services\dashboard_service.go` | `services` |
| `D:\SmartCA\Go\internal\app\services\invoice_service.go` | `services` |
| `D:\SmartCA\Go\internal\app\services\payment_service.go` | `services` |
| `D:\SmartCA\Go\internal\app\services\payment_service_test.go` | `services_test` |
| `D:\SmartCA\Go\internal\app\services\report_service.go` | `services` |
| `D:\SmartCA\Go\internal\app\services\search_service.go` | `services` |
| `D:\SmartCA\Go\internal\auth\password.go` | `auth` |
| `D:\SmartCA\Go\internal\auth\session.go` | `auth` |
| `D:\SmartCA\Go\internal\config\config.go` | `config` |
| `D:\SmartCA\Go\internal\domain\errors\errors.go` | `errors` |
| `D:\SmartCA\Go\internal\domain\models\record.go` | `models` |
| `D:\SmartCA\Go\internal\domain\money\money.go` | `money` |
| `D:\SmartCA\Go\internal\domain\money\money_test.go` | `money_test` |
| `D:\SmartCA\Go\internal\rbac\rbac.go` | `rbac` |
| `D:\SmartCA\Go\internal\repository\memory\store.go` | `memory` |
| `D:\SmartCA\Go\internal\repository\memory\query.go` | `memory` |
| `D:\SmartCA\Go\internal\repository\memory\session_lookup.go` | `memory` |
| `D:\SmartCA\Go\internal\repository\memory\store_test.go` | `memory` |
| `D:\SmartCA\Go\internal\seed\seed.go` | `seed` |
| `D:\SmartCA\Go\pkg\apiresponse\response.go` | `apiresponse` |
| `D:\SmartCA\Go\tests\http_integration_test.go` | `tests` |

---

## 2. Layer overview

```
React (saas) → HTTP REST → chi routes → handlers → services → *memory.Store → seed JSON
```

### Entry (`cmd/api/main.go`)

1. Load `config` from env  
2. `seed.LoadSeed()` → bcrypt user passwords → `memory.NewStore()` + `Reset`  
3. `seed.ValidateIntegrity`  
4. Wire services/handlers into `routes.Deps`  
5. Serve `http.Server` with graceful shutdown  

### Global middleware (all routes)

`RequestID` → `Recover` → `Logger` → `CORS(FrontendOrigin)` → `MaxBytes(1 MiB)`

### Auth / RBAC

| Concern | Implementation |
|---------|----------------|
| Passwords | bcrypt cost 10 (`internal/auth/password.go`) |
| Sessions | Opaque hex token (32 bytes); runtime map on `*memory.Store` (not the seeded `sessions` collection) |
| Login | Email / username / loginId; `status=active`; writes `loginHistory` + `activities` |
| Middleware | `middleware.Auth` (Bearer → session → user); `RequirePermission` per route |
| Demo reset | `POST /api/v1/demo/reset` — `super_admin` + `DEMO_RESET_ENABLED` |

### Money

- Internal: `money.Paise` (`int64`)  
- JSON/API: float **rupees** for frontend parity  
- GST: `math.Round(taxable * 0.18)` with CGST/SGST or IGST split  

### Critical migration note

**There are no repository interfaces.** All services take concrete `*memory.Store`. This is a **P4 / PostgreSQL-migration blocker** (see `POSTGRESQL_MIGRATION_BLUEPRINT.md`).

---

## 3. Memory store

**Package:** `internal/repository/memory`

| Mechanism | Behavior |
|-----------|----------|
| Locking | Single `sync.RWMutex` over all collections + auth sessions |
| Reads | `RLock`, return deep clones |
| Writes | Exclusive `Lock` |
| `WithTx` | Exclusive lock + full deep-clone snapshot; rollback on error; nested ops skip re-lock via `txDepth` |
| Soft delete | `archived` / `archivedAt` (+ `status=="archived"` treated archived in queries) |

**Collections (28):**  
`clients`, `companies`, `employees`, `invoices`, `payments`, `documents`, `tasks`, `gst`, `itr`, `tds`, `roc`, `compliance`, `notifications`, `activities`, `calendar`, `users`, `roles`, `permissions`, `organization`, `settings`, `auditLogs`, `loginHistory`, `chat`, `departments`, `branches`, `notes`, `journals`, `sessions`

**Public store surface:** `Get`, `Exists`, `Count`, `GetAll`, `List`, `Create`, `Update`, `Delete`/`Archive`, `Restore`, `PermanentDelete`, `ReplaceAll`, `Reset`, `Snapshot`, `WithTx`, plus runtime session APIs (`CreateSession`, `FindSessionByToken`, …).

---

## 4. Services → `*memory.Store`

| Service | File | Role |
|---------|------|------|
| `CRUDService` | `crud_service.go` | Generic list/get/create/update/archive/restore/delete/duplicate |
| `InvoiceService` | `invoice_service.go` | Invoice CRUD + tax + client outstanding via `WithTx` |
| `PaymentService` | `payment_service.go` | Payment CRUD + invoice/client paid sync via `WithTx` |
| `AuthService` | `auth_service.go` | Login/logout/me/passwords; writes loginHistory |
| `DashboardService` | `dashboard_service.go` | Live KPIs |
| `ReportService` | `report_service.go` | Report summary series |
| `SearchService` | `search_service.go` | Cross-collection search |
| `AccountingService` | `accounting_service.go` | Journals + statements |
| `ArchiveService` | `archive_service.go` | Recycle Bin + `DemoReset` |
| `SettingsService` | `archive_service.go` | Settings + organization singletons |

---

## 5. Handlers

| Handler | Methods |
|---------|---------|
| `HealthHandler` | `Live`, `Ready`, `Version` (`1.0.0`) |
| `AuthHandler` | `Login`, `Logout`, `Me`, `ForgotPassword`, `ResetPassword`, `ChangePassword`, `DemoReset` |
| `CRUDHandler` | List/Get/Create/Update/Archive/Restore/PermanentDelete/Duplicate (`AllowDuplicate` gate) |
| `InvoiceHandler` | Full CRUD + Duplicate |
| `PaymentHandler` | Full CRUD **without** Duplicate |
| `DashboardHandler` | `Get` |
| `ReportHandler` | `Summary` |
| `SearchHandler` | `Search` |
| `AccountingHandler` | `Journals`, `PostJournal`, `Statements` |
| `ArchiveHandler` | `List`, `Restore`, `Permanent`, `BulkRestore`, `BulkPermanent` |
| `SettingsHandler` | `Get`, `Update`, `GetOrganization`, `UpdateOrganization` |

---

## 6. Seed counts

| Collection | Count | Notes |
|---|---:|---|
| clients | 120 | |
| companies | 60 | |
| employees | 25 | |
| invoices | 150 | |
| payments | 120 | |
| documents | 100 | |
| tasks | 100 | |
| gst | 100 | |
| itr | 80 | |
| tds | 60 | |
| roc | 50 | |
| compliance | 80 | |
| notifications | 30 | |
| activities | 50 | |
| calendar | 40 | Exposed as `/calendar-events` |
| users | 32 | bcrypt at load; plaintext removed |
| roles | 14 | |
| permissions | 43 | |
| organization | 1 | Singleton via `/settings/organization` |
| settings | 1 | Singleton via `/settings` |
| auditLogs | 50 | |
| loginHistory | 40 | **Seeded; no HTTP list route** |
| chat | 10 | From `chat.json` sessions array |
| departments | 8 | **Seeded; no API** |
| branches | 5 | **Seeded; no API** |
| sessions | 5 | Seed docs ≠ runtime auth sessions |
| notes | 2 | `seedNotes()` in Go |
| journals | 0 | Empty default |

**Embedded JSON present but not loaded:** `activityLogs`, `cities`, `countries`, `states`, `menu`, `modules`, `sidebar`, `preferences`, `theme`, `reports`, `dashboard`.

Demo credentials: see seed / local demo docs (no plaintext passwords in this inventory).

---

## 7. Entity matrix

| Entity | Model | Service | HTTP | Archive | Duplicate |
|---|---|---|---|---|---|
| clients | Record | CRUD | `/clients` | Yes | Yes (`AllowDuplicate`) |
| companies | Record | CRUD | `/companies` | Yes | Yes |
| employees | Record | CRUD | `/employees` | Yes | Yes |
| documents | Record | CRUD | `/documents` | Yes | Route mounted; **`AllowDuplicate=false` → 400** |
| tasks | Record | CRUD | `/tasks` | Yes | Yes |
| compliance / gst / itr / tds / roc | Record | CRUD | matching paths | Yes | No |
| notes / notifications / activities | Record | CRUD | matching paths | Yes | No |
| calendar | Record | CRUD | `/calendar-events` | Yes | No |
| auditLogs / users / roles / permissions / chat | Record | CRUD | matching paths | Yes | No |
| invoices | Record | InvoiceService | `/invoices` | Yes | Yes |
| payments | Record | PaymentService | `/payments` | Yes | No |
| organization / settings | Record | SettingsService | `/settings*` | Store only | N/A |
| journals | Record | AccountingService | `/accounting/journals` | Via store | N/A |
| departments / branches / loginHistory | Record | — | **None** | Seeded only | — |
| runtime sessions | `memory.Session` | AuthService | login/logout Bearer | N/A | — |

Cross-cutting: dashboard, reports/summary, search, accounting/statements, archive center, demo reset.

---

## 8. Tests

| File | Coverage |
|------|----------|
| `tests/http_integration_test.go` | Unauthorized clients; login + list clients; health live |
| `internal/app/services/payment_service_test.go` | Payment→invoice→client chain; overpay rejected; concurrency |
| `internal/app/services/bench_test.go` | Dashboard, client list, payment create benchmarks |
| `internal/repository/memory/store_test.go` | Concurrent reads; CRUD archive/restore; WithTx; list/search; Reset |
| `internal/domain/money/money_test.go` | `ComputeInvoiceTax` frontend parity |

**Thin beyond payment/memory/http smoke** — most CRUD collections, RBAC matrix, demo reset, documents duplicate flag, accounting, archive bulk are not covered by dedicated tests.

---

## 9. Config / errors / envelope

**Env:** `APP_ENV`, `HTTP_HOST`, `HTTP_PORT`, `FRONTEND_ORIGIN` (no `*`), `LOG_LEVEL`, `SESSION_TTL` (≥1m), `DEMO_RESET_ENABLED`

**Error codes:** `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `BAD_REQUEST`, `INTERNAL_ERROR`

**Success envelope:** `{ success, data, meta.requestId, meta.pagination? }`  
**Error envelope:** `{ success: false, error: { code, message, details }, meta.requestId }`

---

## 10. Related docs

| Doc | Purpose |
|-----|---------|
| `API_ROUTE_INVENTORY.md` | Exhaustive route table + verification status |
| `API_CONTRACT_AUDIT.md` | Human-readable contract summary |
| `openapi.yaml` | Partial OpenAPI sketch |
| `IN_MEMORY_DATABASE_MODEL.md` | Store / Record / seed model |
| `POSTGRESQL_MIGRATION_BLUEPRINT.md` | PG migration plan |
| `../../SYSTEM_GAP_ANALYSIS.md` | Prioritized gaps P0–P4 |
| `../../FEATURE_API_TRACEABILITY_MATRIX.md` | Feature ↔ API status |
| `../../CRUD_COMPLETENESS_MATRIX.md` | CRUD verb completeness |
| `../../API_CONTRACT_GAP_REPORT.md` | OpenAPI / contract gaps |
