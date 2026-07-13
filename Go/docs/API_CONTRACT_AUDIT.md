# API Contract Audit

Inventory derived from `internal/api/routes/routes.go`. Base URL: `http://localhost:8080`. Authenticated routes require `Authorization: Bearer <opaque-session-token>` unless noted.

Auth middleware: `middleware.Auth` on the protected group. Permission middleware: `middleware.RequirePermission(...)` per route.

---

## Ops / health (no auth)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/health/live` | Liveness |
| GET | `/health/ready` | Readiness (store present) |
| GET | `/version` | Ops probe; same handler as API version |
| GET | `/api/v1/version` | Canonical version contract |

---

## Auth & demo

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/api/v1/auth/login` | Public | Returns opaque session token |
| POST | `/api/v1/auth/forgot-password` | Public | Demo stub |
| POST | `/api/v1/auth/reset-password` | Public | Demo stub |
| POST | `/api/v1/auth/logout` | Session | Revokes session |
| GET | `/api/v1/auth/me` | Session | Current user + permissions |
| POST | `/api/v1/auth/change-password` | Session | bcrypt re-hash |
| POST | `/api/v1/demo/reset` | Session + `super_admin` | Requires `DEMO_RESET_ENABLED` |

---

## CRUD collections

Standard verbs for each collection below:

| Method | Path suffix | Typical permission |
|--------|-------------|--------------------|
| GET | `/` | `*.view` |
| GET | `/{id}` | `*.view` |
| POST | `/` | `*.create` (or view where write-restricted) |
| PATCH | `/{id}` | `*.edit` |
| POST | `/{id}/archive` | `*.delete` (or edit where mapped) |
| POST | `/{id}/restore` | `*.edit` |
| DELETE | `/{id}` | Permanent delete |
| POST | `/{id}/duplicate` | Only where marked **dup** |

| Prefix | Permissions (view / create / edit / delete) | Dup |
|--------|---------------------------------------------|-----|
| `/api/v1/clients` | `clients.view` / `clients.create` / `clients.edit` / `clients.delete` | Yes |
| `/api/v1/companies` | `companies.view` / `companies.create` / `companies.edit` / `companies.edit` | Yes |
| `/api/v1/employees` | `employees.view` / `employees.create` / `employees.edit` / `employees.edit` | Yes |
| `/api/v1/documents` | `documents.view` / `documents.upload` / `documents.upload` / `documents.delete` | No |
| `/api/v1/tasks` | `tasks.view` / `tasks.create` / `tasks.edit` / `tasks.delete` | Yes |
| `/api/v1/compliance` | `compliance.view` / `compliance.create` / `compliance.edit` / `compliance.delete` | No |
| `/api/v1/gst` | `gst.view` (all verbs) | No |
| `/api/v1/itr` | `itr.view` (all verbs) | No |
| `/api/v1/tds` | `tds.view` (all verbs) | No |
| `/api/v1/roc` | `roc.view` (all verbs) | No |
| `/api/v1/notes` | `dashboard.view` (all verbs) | No |
| `/api/v1/notifications` | `dashboard.view` (all verbs) | No |
| `/api/v1/calendar-events` | `dashboard.view` (all verbs) | No |
| `/api/v1/activities` | `dashboard.view` (all verbs) | No |
| `/api/v1/audit-logs` | `settings.view` (all verbs) | No |
| `/api/v1/users` | `settings.users` (all verbs) | No |
| `/api/v1/roles` | `settings.roles` (all verbs) | No |
| `/api/v1/permissions` | `settings.roles` (all verbs) | No |
| `/api/v1/chat` | `ai.view` (all verbs) | No |

List query params (where applicable): `page`, `pageSize`, `search`, `status`, `sortBy`, `sortDir`.

---

## Invoices

Permission family: `invoices.view` / `invoices.create` / `invoices.edit` / `invoices.delete`.

| Method | Path | Permission |
|--------|------|------------|
| GET | `/api/v1/invoices` | `invoices.view` |
| GET | `/api/v1/invoices/{id}` | `invoices.view` |
| POST | `/api/v1/invoices` | `invoices.create` |
| PATCH | `/api/v1/invoices/{id}` | `invoices.edit` |
| POST | `/api/v1/invoices/{id}/archive` | `invoices.delete` |
| POST | `/api/v1/invoices/{id}/restore` | `invoices.edit` |
| DELETE | `/api/v1/invoices/{id}` | `invoices.delete` |
| POST | `/api/v1/invoices/{id}/duplicate` | `invoices.create` |

GST totals computed server-side (`money.ComputeInvoiceTax`); JSON amounts in rupees.

---

## Payments

Permission family: `payments.view` / `payments.create` (create also gates update/archive/restore/delete).

| Method | Path | Permission |
|--------|------|------------|
| GET | `/api/v1/payments` | `payments.view` |
| GET | `/api/v1/payments/{id}` | `payments.view` |
| POST | `/api/v1/payments` | `payments.create` |
| PATCH | `/api/v1/payments/{id}` | `payments.create` |
| POST | `/api/v1/payments/{id}/archive` | `payments.create` |
| POST | `/api/v1/payments/{id}/restore` | `payments.create` |
| DELETE | `/api/v1/payments/{id}` | `payments.create` |

Create/update/delete sync invoice `paidAmount` / status / `remainingAmount` and client outstanding inside `WithTx`. Archived payments are excluded from paid totals.

---

## Dashboard, reports, search

| Method | Path | Permission |
|--------|------|------------|
| GET | `/api/v1/dashboard` | `dashboard.view` |
| GET | `/api/v1/reports/summary` | `reports.view` |
| GET | `/api/v1/search` | `dashboard.view` | Query: `q`, `limit` |

---

## Accounting

All under `accounting.view`:

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/v1/accounting/journals` | List journals |
| POST | `/api/v1/accounting/journals` | Balanced manual journal |
| GET | `/api/v1/accounting/statements` | Trial balance / P&L / balance sheet |

---

## Archive (Recycle Bin)

All under `settings.view`:

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/v1/archive` | Optional `collection` query |
| POST | `/api/v1/archive/restore` | Restore one |
| POST | `/api/v1/archive/permanent` | Purge one |
| POST | `/api/v1/archive/bulk-restore` | Bulk restore |
| POST | `/api/v1/archive/bulk-permanent` | Bulk purge |

---

## Settings

| Method | Path | Permission |
|--------|------|------------|
| GET | `/api/v1/settings` | `settings.view` |
| PATCH | `/api/v1/settings` | `settings.edit` |
| GET | `/api/v1/settings/organization` | `settings.view` |
| PATCH | `/api/v1/settings/organization` | `settings.edit` |

---

## Envelope & errors

- Success: `{ "success": true, "data": ..., "meta": { "requestId", "pagination?" } }`
- Error: `{ "success": false, "error": { "code", "message", "details" }, "meta": { "requestId" } }`
- CORS: single `FRONTEND_ORIGIN` (credentials; never `*`)
- Body size limit: 1 MiB (`MaxBytes`)

See also [`openapi.yaml`](openapi.yaml).
