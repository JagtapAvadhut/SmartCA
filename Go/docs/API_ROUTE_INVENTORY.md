# API Route Inventory

**Source of truth:** `internal/api/routes/routes.go`  
**Base URL:** `http://localhost:8080`  
**Audit date:** 2026-07-12  

**Registered handler bindings:** **~179** (5 CRUD collections × 8 verbs including mounted document duplicate + 14 × 7 + invoices 8 + payments 7 + specialty routes). Approximate count historically cited as ~178.

### Verification status convention

| Status | Meaning |
|--------|---------|
| `IMPLEMENTED_NOT_E2E_VERIFIED` | Route is mounted and implemented; **no dedicated per-route E2E proof**. Default for all rows below. |
| `VERIFIED_E2E` | **Not used in this inventory.** Do not invent. Overall demo was proven by browser QA **112/112 PASS** and business QA **24/24 PASS** against the live Go API (prior session / `qa-results.json`), but that does **not** promote individual routes to `VERIFIED_E2E`. |

Protected group: `middleware.Auth` (Bearer opaque session). Most routes also use `RequirePermission(...)`.

**CRUD mount pattern** (`mountCRUD`):  
`GET /`, `GET /{id}`, `POST /`, `PATCH /{id}`, `POST /{id}/archive`, `POST /{id}/restore`, `DELETE /{id}` [, `POST /{id}/duplicate` if `dup`].

---

## A. Public / ops (no Auth)

| Method | Path | Handler | Auth / permission | Status |
|--------|------|---------|-------------------|--------|
| GET | `/health/live` | `HealthHandler.Live` | global only | IMPLEMENTED_NOT_E2E_VERIFIED |
| GET | `/health/ready` | `HealthHandler.Ready` | global only | IMPLEMENTED_NOT_E2E_VERIFIED |
| GET | `/version` | `HealthHandler.Version` | global only | IMPLEMENTED_NOT_E2E_VERIFIED |
| GET | `/api/v1/version` | `HealthHandler.Version` | global only | IMPLEMENTED_NOT_E2E_VERIFIED |
| POST | `/api/v1/auth/login` | `AuthHandler.Login` | public | IMPLEMENTED_NOT_E2E_VERIFIED |
| POST | `/api/v1/auth/forgot-password` | `AuthHandler.ForgotPassword` | public (demo stub) | IMPLEMENTED_NOT_E2E_VERIFIED |
| POST | `/api/v1/auth/reset-password` | `AuthHandler.ResetPassword` | public (demo stub) | IMPLEMENTED_NOT_E2E_VERIFIED |

---

## B. Auth / demo (Auth required)

| Method | Path | Handler | Permission / extra | Status |
|--------|------|---------|-------------------|--------|
| POST | `/api/v1/auth/logout` | `AuthHandler.Logout` | Auth only | IMPLEMENTED_NOT_E2E_VERIFIED |
| GET | `/api/v1/auth/me` | `AuthHandler.Me` | Auth only | IMPLEMENTED_NOT_E2E_VERIFIED |
| POST | `/api/v1/auth/change-password` | `AuthHandler.ChangePassword` | Auth only | IMPLEMENTED_NOT_E2E_VERIFIED |
| POST | `/api/v1/demo/reset` | `AuthHandler.DemoReset` | Auth + `DEMO_RESET_ENABLED` + `super_admin` | IMPLEMENTED_NOT_E2E_VERIFIED |

---

## C. Generic CRUD resources

Status for **every** method on every base path below: `IMPLEMENTED_NOT_E2E_VERIFIED`.

| Base path | Handler | view / create / edit / delete | Duplicate mounted? | Effective duplicate |
|-----------|---------|-------------------------------|--------------------|---------------------|
| `/api/v1/clients` | Clients CRUD | `clients.view` / `.create` / `.edit` / `.delete` | Yes | Works (`AllowDuplicate: true`) |
| `/api/v1/companies` | Companies | `companies.view` / `.create` / `.edit` / **`.edit`** | Yes | Works |
| `/api/v1/employees` | Employees | `employees.view` / `.create` / `.edit` / **`.edit`** | Yes | Works |
| `/api/v1/documents` | Documents | `documents.view` / `.upload` / `.upload` / `.delete` | **Yes** | **Fails 400** — `AllowDuplicate` left false in `main.go` |
| `/api/v1/tasks` | Tasks | `tasks.view` / `.create` / `.edit` / `.delete` | Yes | Works |
| `/api/v1/compliance` | Compliance | `compliance.*` | No | — |
| `/api/v1/gst` | GST | all `gst.view` | No | — |
| `/api/v1/itr` | ITR | all `itr.view` | No | — |
| `/api/v1/tds` | TDS | all `tds.view` | No | — |
| `/api/v1/roc` | ROC | all `roc.view` | No | — |
| `/api/v1/notes` | Notes | all `dashboard.view` | No | — |
| `/api/v1/notifications` | Notifs | all `dashboard.view` | No | — |
| `/api/v1/calendar-events` | Calendar | all `dashboard.view` | No | — |
| `/api/v1/activities` | Activities | all `dashboard.view` | No | — |
| `/api/v1/audit-logs` | AuditLogs | all `settings.view` | No | — |
| `/api/v1/users` | Users | all `settings.users` | No | — |
| `/api/v1/roles` | Roles | all `settings.roles` | No | — |
| `/api/v1/permissions` | Perms | all `settings.roles` | No | — |
| `/api/v1/chat` | Chat | all `ai.view` | No | — |

### Expanded CRUD verbs

| Method | Subpath | Handler method | Perm slot |
|--------|---------|----------------|-----------|
| GET | `/` | `List` | view |
| GET | `/{id}` | `Get` | view |
| POST | `/` | `Create` | create |
| PATCH | `/{id}` | `Update` | edit |
| POST | `/{id}/archive` | `Archive` | delete |
| POST | `/{id}/restore` | `Restore` | edit |
| DELETE | `/{id}` | `PermanentDelete` | delete |
| POST | `/{id}/duplicate` | `Duplicate` | create (only if mounted) |

List query params (where applicable): `page`, `pageSize`, `search`, `status`, `sortBy`, `sortDir`.

---

## D. Invoices (`mountInvoices`)

| Method | Path | Handler | Permission | Status |
|--------|------|---------|------------|--------|
| GET | `/api/v1/invoices` | `InvoiceHandler.List` | `invoices.view` | IMPLEMENTED_NOT_E2E_VERIFIED |
| GET | `/api/v1/invoices/{id}` | `Get` | `invoices.view` | IMPLEMENTED_NOT_E2E_VERIFIED |
| POST | `/api/v1/invoices` | `Create` | `invoices.create` | IMPLEMENTED_NOT_E2E_VERIFIED |
| PATCH | `/api/v1/invoices/{id}` | `Update` | `invoices.edit` | IMPLEMENTED_NOT_E2E_VERIFIED |
| POST | `/api/v1/invoices/{id}/archive` | `Archive` | `invoices.delete` | IMPLEMENTED_NOT_E2E_VERIFIED |
| POST | `/api/v1/invoices/{id}/restore` | `Restore` | `invoices.edit` | IMPLEMENTED_NOT_E2E_VERIFIED |
| DELETE | `/api/v1/invoices/{id}` | `PermanentDelete` | `invoices.delete` | IMPLEMENTED_NOT_E2E_VERIFIED |
| POST | `/api/v1/invoices/{id}/duplicate` | `Duplicate` | `invoices.create` | IMPLEMENTED_NOT_E2E_VERIFIED |

GST totals computed server-side (`money.ComputeInvoiceTax`); JSON amounts in rupees.

---

## E. Payments (`mountPayments`) — no duplicate

| Method | Path | Handler | Permission | Status |
|--------|------|---------|------------|--------|
| GET | `/api/v1/payments` | `PaymentHandler.List` | `payments.view` | IMPLEMENTED_NOT_E2E_VERIFIED |
| GET | `/api/v1/payments/{id}` | `Get` | `payments.view` | IMPLEMENTED_NOT_E2E_VERIFIED |
| POST | `/api/v1/payments` | `Create` | `payments.create` | IMPLEMENTED_NOT_E2E_VERIFIED |
| PATCH | `/api/v1/payments/{id}` | `Update` | `payments.create` | IMPLEMENTED_NOT_E2E_VERIFIED |
| POST | `/api/v1/payments/{id}/archive` | `Archive` | `payments.create` | IMPLEMENTED_NOT_E2E_VERIFIED |
| POST | `/api/v1/payments/{id}/restore` | `Restore` | `payments.create` | IMPLEMENTED_NOT_E2E_VERIFIED |
| DELETE | `/api/v1/payments/{id}` | `PermanentDelete` | `payments.create` | IMPLEMENTED_NOT_E2E_VERIFIED |

Create/update/delete sync invoice `paidAmount` / status / `remainingAmount` and client outstanding inside `WithTx`. Archived payments excluded from paid totals.

---

## F. Dashboard / reports / search

| Method | Path | Handler | Permission | Status |
|--------|------|---------|------------|--------|
| GET | `/api/v1/dashboard` | `DashboardHandler.Get` | `dashboard.view` | IMPLEMENTED_NOT_E2E_VERIFIED |
| GET | `/api/v1/reports/summary` | `ReportHandler.Summary` | `reports.view` | IMPLEMENTED_NOT_E2E_VERIFIED |
| GET | `/api/v1/search` | `SearchHandler.Search` | `dashboard.view` | IMPLEMENTED_NOT_E2E_VERIFIED |

Query: `q`, `limit` on search.

---

## G. Accounting

Group middleware: `RequirePermission(accounting.view)`.

| Method | Path | Handler | Status |
|--------|------|---------|--------|
| GET | `/api/v1/accounting/journals` | `Journals` | IMPLEMENTED_NOT_E2E_VERIFIED |
| POST | `/api/v1/accounting/journals` | `PostJournal` | IMPLEMENTED_NOT_E2E_VERIFIED |
| GET | `/api/v1/accounting/statements` | `Statements` | IMPLEMENTED_NOT_E2E_VERIFIED |

Unbalanced manual journals are rejected (covered by business QA suite as a flow, not as per-route E2E status).

---

## H. Archive center (Recycle Bin)

Group middleware: `RequirePermission(settings.view)`.

| Method | Path | Handler | Status |
|--------|------|---------|--------|
| GET | `/api/v1/archive/` | `List` | IMPLEMENTED_NOT_E2E_VERIFIED |
| POST | `/api/v1/archive/restore` | `Restore` | IMPLEMENTED_NOT_E2E_VERIFIED |
| POST | `/api/v1/archive/permanent` | `Permanent` | IMPLEMENTED_NOT_E2E_VERIFIED |
| POST | `/api/v1/archive/bulk-restore` | `BulkRestore` | IMPLEMENTED_NOT_E2E_VERIFIED |
| POST | `/api/v1/archive/bulk-permanent` | `BulkPermanent` | IMPLEMENTED_NOT_E2E_VERIFIED |

---

## I. Settings

| Method | Path | Handler | Permission | Status |
|--------|------|---------|------------|--------|
| GET | `/api/v1/settings/` | `Get` | `settings.view` | IMPLEMENTED_NOT_E2E_VERIFIED |
| PATCH | `/api/v1/settings/` | `Update` | `settings.edit` | IMPLEMENTED_NOT_E2E_VERIFIED |
| GET | `/api/v1/settings/organization` | `GetOrganization` | `settings.view` | IMPLEMENTED_NOT_E2E_VERIFIED |
| PATCH | `/api/v1/settings/organization` | `UpdateOrganization` | `settings.edit` | IMPLEMENTED_NOT_E2E_VERIFIED |

---

## J. Seeded collections with **no HTTP routes**

| Collection | Seeded | HTTP |
|------------|-------:|------|
| `loginHistory` | 40 | **None** (written on login only) |
| `departments` | 8 | **None** |
| `branches` | 5 | **None** |
| `sessions` (seed docs) | 5 | **None** (≠ runtime Bearer sessions) |

---

## Route count breakdown

| Group | Count |
|-------|------:|
| Public/ops + public auth | 7 |
| Protected auth/demo | 4 |
| CRUD with dup mounted (clients, companies, employees, documents, tasks) × 8 | 40 |
| CRUD without dup (14 collections) × 7 | 98 |
| Invoices | 8 |
| Payments | 7 |
| Dashboard / reports / search | 3 |
| Accounting | 3 |
| Archive | 5 |
| Settings | 4 |
| **Total** | **179** |

---

## OpenAPI coverage vs this inventory

`docs/openapi.yaml` documents a **thin subset** (health, version, auth, demo reset, partial clients/invoices/payments, dashboard, reports, search, accounting, archive GET, settings GET/PATCH).

**Missing from OpenAPI (major):** companies, employees, documents, tasks, compliance, gst/itr/tds/roc, notes, notifications, calendar-events, activities, audit-logs, users, roles, permissions, chat, most archive/restore/duplicate verbs, organization settings, full payment mutate surface.

Prefer this inventory + `API_CONTRACT_AUDIT.md` over OpenAPI for accuracy until OpenAPI is completed.

---

## Related evidence (demo-level, not per-route E2E)

| Suite | Result | Evidence |
|-------|--------|----------|
| Browser QA (`npm run qa:browser`) | **112/112 PASS** | `saas/qa-results.json` (2026-07-12, against live API) |
| Business QA (`npm run qa:business`) | **24/24 PASS** | `saas/business-qa-results.json` |

These prove overall demo flows (client/invoice/payment/dashboard/settings user-role/recycle/accounting unbalanced reject, etc.) — they do **not** change per-route status in this file to `VERIFIED_E2E`.
