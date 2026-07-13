# React Frontend Inventory

**Scope:** `D:\SmartCA\saas`  
**Stack:** React 19, Vite 8, React Router 7, TanStack Query 5, Zustand, RHF + Zod  
**API:** Go REST via `httpClient` — default `http://localhost:8080/api/v1`  
**Audit date:** 2026-07-12  

---

## 1. Scripts & env

| Script | Command |
|--------|---------|
| `dev` | `vite` |
| `build` | `tsc -b && vite build` |
| `lint` | `oxlint` |
| `preview` | `vite preview` |
| `qa:browser` | `node scripts/qa-verify.mjs` |
| `qa:business` | `node scripts/qa-business.mjs` |
| `qa:screenshots` | `node scripts/capture-screenshots.mjs` |

`.env.example`: `VITE_API_BASE_URL=http://localhost:8080/api/v1`  
Runtime default in `src/services/httpClient.ts`: same.  
Note: `src/config/env.ts` still defaults to `http://localhost:3000/api` (legacy; HTTP calls use `httpClient.getApiBaseUrl()`).

---

## 2. App bootstrap (`App.tsx`)

- `QueryClientProvider` (staleTime 30s, retry 1)
- `RouterProvider` ← `@/routes`
- Theme + notifications init; branding from settings
- Dynamically loads `@/qa/expose` → `window.__SMART_CA_QA__`
- `react-hot-toast`

---

## 3. Routes → pages

Source: `src/routes/index.tsx`

| Path | Guard | Page | File |
|------|-------|------|------|
| `/login` | GuestRoute | `LoginPage` | `pages/Auth/LoginPage.tsx` |
| `/forgot-password` | GuestRoute | `ForgotPasswordPage` | `pages/Auth/ForgotPasswordPage.tsx` |
| `/` | Protected + AppLayout | `DashboardPage` | `pages/Dashboard/DashboardPage.tsx` |
| `/clients` | Protected | `ClientsPage` | `pages/Clients/ClientsPage.tsx` |
| `/clients/:id` | Protected | `ClientDetailPage` | `pages/Clients/ClientDetailPage.tsx` |
| `/companies` | Protected | `CompaniesPage` | `pages/Companies/CompaniesPage.tsx` |
| `/compliance` | Protected | `CompliancePage` | `pages/Compliance/CompliancePage.tsx` |
| `/compliance/gst` | Protected | `GSTPage` | `pages/Compliance/ComplianceSubPages.tsx` |
| `/compliance/itr` | Protected | `ITRPage` | same |
| `/compliance/tds` | Protected | `TDSPage` | same |
| `/compliance/roc` | Protected | `ROCPage` | same |
| `/accounting` | Protected | `AccountingPage` | `pages/Accounting/AccountingPage.tsx` |
| `/invoices` | Protected | `InvoicesPage` | `pages/Invoices/InvoicesPage.tsx` |
| `/payments` | Protected | `PaymentsPage` | `pages/Payments/PaymentsPage.tsx` |
| `/documents` | Protected | `DocumentsPage` | `pages/Documents/DocumentsPage.tsx` |
| `/tasks` | Protected | `TasksPage` | `pages/Tasks/TasksPage.tsx` |
| `/notes` | Protected | `NotesPage` | `pages/Notes/NotesPage.tsx` |
| `/calendar` | Protected | `CalendarPage` | `pages/Calendar/CalendarPage.tsx` |
| `/reports` | Protected | `ReportsPage` | `pages/Reports/ReportsPage.tsx` |
| `/employees` | Protected | `EmployeesPage` | `pages/Employees/EmployeesPage.tsx` |
| `/recycle-bin` | Protected | `RecycleBinPage` | `pages/RecycleBin/RecycleBinPage.tsx` |
| `/ai` | Protected | `AIPage` | `pages/AI/AIPage.tsx` |
| `/settings` | Protected | `SettingsPage` | `pages/Settings/SettingsPage.tsx` |
| `/unauthorized` | Protected | `UnauthorizedPage` | `pages/Error/UnauthorizedPage.tsx` |
| `*` | — | `NotFoundPage` | `pages/Error/NotFoundPage.tsx` |

---

## 4. Page binding status

| Page | Primary services | Query keys (representative) | Status |
|------|------------------|-----------------------------|--------|
| Login / Forgot | `AuthService` | Zustand | FULLY_API_BOUND |
| Dashboard | `DashboardService`, `ReportService` | `['dashboard']`, `['reports']` | FULLY_API_BOUND |
| Clients / detail | `ClientService` + related | `['clients']`, `['client', id]`, … | FULLY_API_BOUND |
| Companies | `CompanyService` | `['companies']` | FULLY_API_BOUND |
| Compliance + GST/ITR/TDS/ROC | `ComplianceService` | `['compliance-kanban']`, `['gst']`, … | FULLY_API_BOUND |
| Accounting | `accountingEngine` | `['accounting-snapshot']` | FULLY_API_BOUND |
| Invoices | `InvoiceService` | `['invoices']` | FULLY_API_BOUND |
| Payments | `PaymentService` | `['payments']` | FULLY_API_BOUND |
| Documents | `DocumentService` | `['documents']`, … | PARTIALLY_API_BOUND (mock preview text) |
| Tasks / Notes / Calendar | respective services | matching keys | FULLY_API_BOUND |
| Reports | `ReportService` | `['reports']` | FULLY_API_BOUND |
| Employees | `EmployeeService` | `['employees']` | FULLY_API_BOUND |
| Recycle Bin | `ArchiveService` | `['recycle-bin', tab]` | FULLY_API_BOUND (stale LocalStorage UI copy) |
| AI | `ChatService` | `['chat-sessions']` | PARTIALLY_API_BOUND (canned assistant reply) |
| Settings | `SettingsService`, `AuthService`, reconciliation | settings/users/roles/… | PARTIALLY_API_BOUND (appearance local; `getLoginHistory` → `[]`) |

Shell: Command Palette → `SearchService`; notification bell → `NotificationService` via `notificationStore`.

---

## 5. Settings tabs

| Tab | Mutations |
|-----|-----------|
| organization | `SettingsService.updateOrganization` |
| profile | `AuthService.updateProfile`; **Reset Database** → `http.post('/demo/reset')` then reload |
| password | `AuthService.changePassword` |
| users | create/edit/delete/status/password helpers |
| roles | create/edit/delete/duplicate |
| branding / notifications / email / sms / whatsapp / security / api | `updateSettings` sections |
| integrity | `runDataIntegrityCheck`, `repairDerivedData` |
| appearance | Zustand theme/language (local) |
| activity | `getAuditLogs` |

URL: `/settings?tab=<id>`.

---

## 6. Services map

All active domain services use `http` / `createCrudService` — **not** MockDatabase.

| File | Service | Endpoints / notes |
|------|---------|-------------------|
| `httpClient.ts` | `http` | Transport; token in localStorage |
| `crudFactory.ts` | factory | `GET/POST /X`, `GET/PATCH/DELETE /X/:id`, archive/restore/duplicate |
| `clientService.ts` | `ClientService` | `/clients` |
| `invoiceService.ts` | `InvoiceService` | `/invoices` |
| `paymentService.ts` | `PaymentService` | `/payments` |
| `documentService.ts` | `DocumentService` | `/documents` + mock preview fields |
| `employeeService.ts` | `EmployeeService` | `/employees` |
| `taskService.ts` | `TaskService` | `/tasks` |
| `noteService.ts` | `NoteService` | `/notes` |
| `complianceService.ts` | `ComplianceService` | `/compliance`, `/gst`, `/itr`, `/tds`, `/roc` |
| `miscService.ts` | Company / Notification / Chat / Calendar / Activity | matching paths; Chat canned reply; `markAllRead` = N+1 PATCH |
| `authService.ts` | `AuthService` | `/auth/*`, `/users`, audit-logs as history stand-in |
| `settingsService.ts` | `SettingsService` | `/settings*`, `/roles`, `/permissions`, `/users`, `/audit-logs`; **`getLoginHistory` → `[]`** |
| `dashboardService.ts` | `DashboardService` | `GET /dashboard` |
| `reportService.ts` | `ReportService` | `GET /reports/summary` |
| `searchService.ts` | `SearchService` | `GET /search` + local nav hits |
| `archiveService.ts` | `ArchiveService` | `/archive*` |
| `accountingEngine.ts` | journals/statements | `/accounting/*` |
| `reconciliationService.ts` | integrity | lists via HTTP; audit trail in localStorage |
| `relations.ts` | sync helpers | **no-op** — backend owns side effects |

Repositories under `src/repositories/*` are also HTTP-backed (`BaseRepository`).

---

## 7. Dead / legacy data layer

| Item | Behavior |
|------|----------|
| `MockDatabase` | Implemented; **not** used by pages/services at runtime |
| `getCollection()` | **Always throws** — use Go REST API |
| `initDatabase()` | No-op |
| `resetDatabase()` | **Throws** — message says use `POST /api/v1/demo/reset` |
| Settings Reset button | Calls `http.post('/demo/reset')` (correct) |
| QA `expose.ts` | `resetDatabase: () => http.post('/demo/reset')` (correct) |

---

## 8. Known frontend gaps (see also SYSTEM_GAP_ANALYSIS)

1. **`SettingsService.getLoginHistory`** returns `[]` — no `/login-history` route on backend.  
2. **`DocumentService.duplicate`** calls `POST /documents/:id/duplicate` but backend `AllowDuplicate=false` → 400.  
3. **`NotificationService.markAllRead`** — list unread then N individual PATCH (N+1).  
4. **Recycle Bin** page description still says actions persist in LocalStorage (false; uses `/archive` API).  
5. **AI chat** canned assistant replies (acceptable for demo).  
6. **Document mock preview** text (acceptable for demo).  
7. Stale docs under `docs/ARCHITECTURE.md` / older reports may still describe MockDatabase.

---

## 9. QA evidence (live API)

| Suite | Result | File |
|-------|--------|------|
| Browser regression | **112 PASS / 0 FAIL** | `qa-results.json` (2026-07-12) |
| Business logic | **24 PASS / 0 FAIL** | `business-qa-results.json` |

Covered flows include login, page loads, dark mode, overflow, client→invoice→payment→outstanding, invoice duplicate, document upload, client archive→recycle→restore, accounting tabs, settings user/role, AI send, plus Switch/regression extras (112 total). Business suite covers exact payment math, validation rejects, unbalanced journal reject, trial balance / BS / P&L checks.

Individual HTTP routes remain `IMPLEMENTED_NOT_E2E_VERIFIED` in the Go route inventory unless a dedicated per-route E2E exists (none claimed as `VERIFIED_E2E`).

---

## 10. Related docs

- `FRONTEND_DATA_SOURCE_AUDIT.md` — transport classification  
- `../../FEATURE_API_TRACEABILITY_MATRIX.md`  
- `../../CRUD_COMPLETENESS_MATRIX.md`  
- `../../SYSTEM_GAP_ANALYSIS.md`  
- `../../AUTH_RBAC_TEST_MATRIX.md`
