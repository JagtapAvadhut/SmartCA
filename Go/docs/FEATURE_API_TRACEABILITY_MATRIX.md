# Feature ↔ API Traceability Matrix

**Workspace:** `D:\SmartCA` (Go + saas)  
**Audit date:** 2026-07-12  

### Status legend

| Status | Meaning |
|--------|---------|
| `COMPLETE_VERIFIED` | Feature flow covered by prior browser QA (**112/112**) and/or business QA (**24/24**) against live Go API |
| `IMPLEMENTED_NOT_E2E_VERIFIED` | Backend + frontend exist; not specifically proven by a dedicated E2E assertion for this action |
| `PARTIAL` | Works with known limitations / demo stubs / incomplete binding |
| `BACKEND_MISSING` | No (or non-functional) backend support for what UI needs |
| `FRONTEND_BINDING_MISSING` | Backend exists (or data seeded) but frontend does not call it correctly / at all |

**Important:** Individual HTTP routes remain `IMPLEMENTED_NOT_E2E_VERIFIED` in `Go/docs/API_ROUTE_INVENTORY.md`. `COMPLETE_VERIFIED` here means the **user/business flow** was exercised by QA suites, not that every underlying verb was promoted to `VERIFIED_E2E`.

---

## Auth & session

| Module | Action | Frontend | Backend | Status | Evidence / notes |
|--------|--------|----------|---------|--------|------------------|
| Auth | Login | `AuthService.login` → `POST /auth/login` | AuthHandler | COMPLETE_VERIFIED | Browser QA AUTH login |
| Auth | Logout | `POST /auth/logout` | AuthHandler | IMPLEMENTED_NOT_E2E_VERIFIED | |
| Auth | Me / session restore | `GET /auth/me` | AuthHandler | IMPLEMENTED_NOT_E2E_VERIFIED | |
| Auth | Forgot / reset password | AuthService | Demo stubs | PARTIAL | Demo OK |
| Auth | Change password | Settings password tab | `POST /auth/change-password` | IMPLEMENTED_NOT_E2E_VERIFIED | |
| Auth | Login history (Settings) | `SettingsService.getLoginHistory` → `[]` | Collection seeded; **no route** | FRONTEND_BINDING_MISSING + BACKEND_MISSING | Empty stub; AuthService uses audit-logs as stand-in elsewhere |
| Demo | Reset database | Settings → `POST /demo/reset` | AuthHandler.DemoReset | IMPLEMENTED_NOT_E2E_VERIFIED | UI path correct; seed `resetDatabase()` throw remains footgun |

---

## Dashboard & search

| Module | Action | Frontend | Backend | Status | Evidence / notes |
|--------|--------|----------|---------|--------|------------------|
| Dashboard | Load KPIs | `GET /dashboard` | DashboardService | COMPLETE_VERIFIED | Browser page load + outstanding REL tests; business suite deltas |
| Dashboard | Click Outstanding → payments | Navigation | — | COMPLETE_VERIFIED | Browser QA |
| Reports | Summary charts | `GET /reports/summary` | ReportService | COMPLETE_VERIFIED | Browser REL reports live |
| Search | Command palette | `GET /search` + local nav | SearchHandler | COMPLETE_VERIFIED | Browser REGRESSION Ctrl+K |

---

## Clients

| Module | Action | Frontend | Backend | Status | Evidence / notes |
|--------|--------|----------|---------|--------|------------------|
| Clients | List / page load | `GET /clients` | CRUD | COMPLETE_VERIFIED | Browser PAGE_LOAD |
| Clients | Create | `POST /clients` | CRUD | COMPLETE_VERIFIED | Browser CRUD client create; business suite |
| Clients | Edit | `PATCH /clients/:id` | CRUD | IMPLEMENTED_NOT_E2E_VERIFIED | |
| Clients | Duplicate | `POST /clients/:id/duplicate` | CRUD AllowDuplicate | IMPLEMENTED_NOT_E2E_VERIFIED | |
| Clients | Archive | `POST /clients/:id/archive` | CRUD | COMPLETE_VERIFIED | Browser CRUD client archive |
| Clients | Detail view | multi-service | CRUD + related | IMPLEMENTED_NOT_E2E_VERIFIED | |
| Clients | Outstanding sync | via invoice/payment | Invoice/Payment services | COMPLETE_VERIFIED | Business 24/24 |

---

## Companies / Employees

| Module | Action | Frontend | Backend | Status | Evidence / notes |
|--------|--------|----------|---------|--------|------------------|
| Companies | List / CRUD | CompanyService | `/companies` | COMPLETE_VERIFIED (list); mutations IMPLEMENTED_NOT_E2E_VERIFIED | Page load covered |
| Companies | Duplicate | CRUD factory | AllowDuplicate true | IMPLEMENTED_NOT_E2E_VERIFIED | |
| Employees | List / CRUD | EmployeeService | `/employees` | COMPLETE_VERIFIED (list); mutations IMPLEMENTED_NOT_E2E_VERIFIED | Page load covered |
| Employees | Duplicate | CRUD factory | AllowDuplicate true | IMPLEMENTED_NOT_E2E_VERIFIED | |
| Org structure | Departments list | — | Seeded only | BACKEND_MISSING | No `/departments` |
| Org structure | Branches list | — | Seeded only | BACKEND_MISSING | No `/branches` |

---

## Invoices

| Module | Action | Frontend | Backend | Status | Evidence / notes |
|--------|--------|----------|---------|--------|------------------|
| Invoices | List | `GET /invoices` | InvoiceHandler | COMPLETE_VERIFIED | Browser |
| Invoices | Create | `POST /invoices` | InvoiceHandler | COMPLETE_VERIFIED | Browser + business |
| Invoices | Edit / save after client select | `PATCH` | InvoiceHandler | COMPLETE_VERIFIED | Browser REGRESSION invoice save |
| Invoices | Duplicate | `POST /invoices/:id/duplicate` | InvoiceHandler | COMPLETE_VERIFIED | Browser CRUD invoice duplicate |
| Invoices | Archive / delete | archive / DELETE | InvoiceHandler | IMPLEMENTED_NOT_E2E_VERIFIED | Business deletes invoice in chain |
| Invoices | GST totals | client prep + server recompute | money.ComputeInvoiceTax | COMPLETE_VERIFIED | Business GST case |
| Invoices | Deep-link filter `?q=` | UI | list search | COMPLETE_VERIFIED | Browser REGRESSION |

---

## Payments

| Module | Action | Frontend | Backend | Status | Evidence / notes |
|--------|--------|----------|---------|--------|------------------|
| Payments | List | `GET /payments` | PaymentHandler | COMPLETE_VERIFIED | Browser page load |
| Payments | Create | `POST /payments` | PaymentHandler | COMPLETE_VERIFIED | Browser + business |
| Payments | Edit amount | `PATCH` | PaymentHandler | COMPLETE_VERIFIED | Business edit recalculates |
| Payments | Delete | `DELETE` | PaymentHandler | COMPLETE_VERIFIED | Browser + business rollback |
| Payments | Reject zero / negative / overpay / dup ref | UI + API | PaymentService validation | COMPLETE_VERIFIED | Business suite |
| Payments | Duplicate | — | Not mounted | BACKEND_MISSING | By design |

---

## Documents

| Module | Action | Frontend | Backend | Status | Evidence / notes |
|--------|--------|----------|---------|--------|------------------|
| Documents | List / upload create | DocumentService | `/documents` | COMPLETE_VERIFIED | Browser CRUD document upload |
| Documents | Favourite toggle | PATCH | CRUD | COMPLETE_VERIFIED | Browser |
| Documents | Duplicate | `POST /documents/:id/duplicate` (+ PATCH overrides) | Route mounted; **AllowDuplicate=false → 400** | BACKEND_MISSING (effective) / PARTIAL | Frontend bound to non-working endpoint |
| Documents | Preview / download | Client mock preview blob | Metadata only | PARTIAL | Demo OK |

---

## Compliance

| Module | Action | Frontend | Backend | Status | Evidence / notes |
|--------|--------|----------|---------|--------|------------------|
| Compliance | Kanban / page | ComplianceService | `/compliance` | COMPLETE_VERIFIED (load) | Browser PAGE_LOAD |
| GST / ITR / TDS / ROC | List pages | ComplianceService | matching paths | COMPLETE_VERIFIED (load) | Browser PAGE_LOAD |
| Compliance | Create / status move / delete | services | CRUD | IMPLEMENTED_NOT_E2E_VERIFIED | |

---

## Accounting

| Module | Action | Frontend | Backend | Status | Evidence / notes |
|--------|--------|----------|---------|--------|------------------|
| Accounting | Tabs interactive | accountingEngine | journals + statements | COMPLETE_VERIFIED | Browser ACCOUNTING modules |
| Accounting | Post balanced journal | `POST /accounting/journals` | AccountingService | IMPLEMENTED_NOT_E2E_VERIFIED | |
| Accounting | Reject unbalanced journal | assertBalanced + API | AccountingService | COMPLETE_VERIFIED | Business QA |
| Accounting | Trial balance / BS / P&L | `GET /accounting/statements` | AccountingService | COMPLETE_VERIFIED | Business QA |

---

## Tasks / Notes / Calendar / Notifications

| Module | Action | Frontend | Backend | Status | Evidence / notes |
|--------|--------|----------|---------|--------|------------------|
| Tasks | List / CRUD | TaskService | `/tasks` | COMPLETE_VERIFIED (load); mutations IMPLEMENTED_NOT_E2E_VERIFIED | |
| Notes | List / CRUD | NoteService | `/notes` | COMPLETE_VERIFIED (load) | |
| Calendar | Month/week/day | CalendarService | `/calendar-events` | COMPLETE_VERIFIED | Browser |
| Notifications | Open panel | NotificationService | `/notifications` | COMPLETE_VERIFIED | Browser |
| Notifications | Mark all read | N× `PATCH /notifications/:id` | CRUD Update | PARTIAL | Works; N+1 pattern (GAP-P2) |

---

## Recycle Bin (Archive)

| Module | Action | Frontend | Backend | Status | Evidence / notes |
|--------|--------|----------|---------|--------|------------------|
| Recycle | List archived | `GET /archive` | ArchiveHandler | COMPLETE_VERIFIED | Browser shows archived client |
| Recycle | Restore | `POST /archive/restore` | ArchiveHandler | COMPLETE_VERIFIED | Browser RECYCLE restore |
| Recycle | Permanent / bulk | ArchiveService | archive permanent/bulk | IMPLEMENTED_NOT_E2E_VERIFIED | |
| Recycle | UI copy | Still says LocalStorage | — | PARTIAL | Misleading copy (GAP-P3) |

---

## Settings (users / roles / branding)

| Module | Action | Frontend | Backend | Status | Evidence / notes |
|--------|--------|----------|---------|--------|------------------|
| Settings | Page load / branding | SettingsService | `/settings` | COMPLETE_VERIFIED | Browser SETTINGS branding |
| Settings | Create user | `POST /users` | CRUD users | COMPLETE_VERIFIED | Browser + persists after refresh |
| Settings | Create role | `POST /roles` | CRUD roles | COMPLETE_VERIFIED | Browser |
| Settings | Theme persist | Zustand local | — | COMPLETE_VERIFIED | Browser (UI-owned) |
| Settings | Notification switches | settings PATCH | SettingsHandler | COMPLETE_VERIFIED | Browser SWITCH* cases |
| Settings | Organization | `/settings/organization` | SettingsHandler | IMPLEMENTED_NOT_E2E_VERIFIED | |
| Settings | Audit activity tab | `GET /audit-logs` | CRUD | IMPLEMENTED_NOT_E2E_VERIFIED | |
| Settings | Login history | returns `[]` | No route | FRONTEND_BINDING_MISSING + BACKEND_MISSING | |

---

## AI

| Module | Action | Frontend | Backend | Status | Evidence / notes |
|--------|--------|----------|---------|--------|------------------|
| AI | Page load / send message | ChatService → `/chat` | CRUD chat | COMPLETE_VERIFIED (send) | Browser AI send; reply text canned → PARTIAL quality |
| AI | Attach documents | Simulated modal | — | PARTIAL | Demo OK |

---

## Cross-cutting / platform

| Module | Action | Frontend | Backend | Status | Evidence / notes |
|--------|--------|----------|---------|--------|------------------|
| Health | Live / ready | — | HealthHandler | IMPLEMENTED_NOT_E2E_VERIFIED | Go http smoke covers live |
| OpenAPI | Contract docs | — | `openapi.yaml` | PARTIAL | Incomplete vs ~179 routes |
| Persistence | PostgreSQL | — | memory only | BACKEND_MISSING | Migration blueprint exists |
| Repository ports | Interfaces | — | concrete `*memory.Store` | BACKEND_MISSING | Critical for PG |
| Dark mode / overflow / a11y smoke | UI | — | COMPLETE_VERIFIED | Browser suite |

---

## Summary counts (approximate)

| Status | Rough share |
|--------|-------------|
| COMPLETE_VERIFIED | Core demo flows (auth login, dashboard/reports, client/invoice/payment chain, recycle, settings user/role, accounting rejects, page loads, AI send, etc.) |
| IMPLEMENTED_NOT_E2E_VERIFIED | Most secondary CRUD verbs and specialty routes |
| PARTIAL | AI quality, document preview, markAllRead N+1, Recycle copy, OpenAPI, forgot/reset stubs |
| BACKEND_MISSING | loginHistory/departments/branches routes; effective document duplicate; PG/repo interfaces |
| FRONTEND_BINDING_MISSING | Login history empty stub; document duplicate calling non-working API |

---

## Related docs

- `Go/docs/API_ROUTE_INVENTORY.md` — per-route status (no invented `VERIFIED_E2E`)
- `CRUD_COMPLETENESS_MATRIX.md`
- `SYSTEM_GAP_ANALYSIS.md`
- `saas/docs/FRONTEND_DATA_SOURCE_AUDIT.md`
