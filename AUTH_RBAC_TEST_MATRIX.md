# Auth & RBAC Test Matrix

**Audit date:** 2026-07-12  
**Scopes:** `Go/internal/auth`, `Go/internal/rbac`, `Go/internal/api/middleware`, `saas` auth/settings flows  

**Credentials:** Demo usernames and passwords are **not** listed in this document. Use seed data / local demo docs / `.env` examples maintained outside git docs if needed.

---

## 1. Auth mechanism summary

| Concern | Implementation | Test posture today |
|---------|----------------|--------------------|
| Password storage | bcrypt cost 10; plaintext stripped at seed | Seed integrity checks hash present |
| Login identifiers | email / username / loginId | HTTP smoke: login succeeds |
| Session | Opaque hex token; in-memory map; TTL (`SESSION_TTL`, rememberMe → 7d) | Login + authenticated list clients |
| Auth middleware | Bearer → `FindSessionByToken` → user; strips secrets | Unauthorized clients rejected |
| Logout | Revoke session | Not dedicated unit-tested |
| Change password | bcrypt re-hash | Not dedicated unit-tested |
| Forgot / reset | Demo stubs (no email / weak token semantics) | Untested beyond existence |
| Demo reset | `super_admin` + `DEMO_RESET_ENABLED` | Untested in Go suite |

---

## 2. Permission catalog (backend constants)

From `internal/rbac/rbac.go`:

| Family | Permissions |
|--------|-------------|
| Dashboard | `dashboard.view` |
| Clients | `clients.view`, `.create`, `.edit`, `.delete` |
| Companies | `companies.view`, `.create`, `.edit` *(no `.delete` — routes reuse `.edit`)* |
| Compliance | `compliance.view`, `.create`, `.edit`, `.delete` |
| Tax modules | `gst.view`, `itr.view`, `tds.view`, `roc.view` |
| Accounting | `accounting.view` |
| Invoices | `invoices.view`, `.create`, `.edit`, `.delete` |
| Payments | `payments.view`, `payments.create` *(create gates mutate verbs)* |
| Documents | `documents.view`, `.upload`, `.delete` |
| Tasks | `tasks.view`, `.create`, `.edit`, `.delete` |
| Reports | `reports.view`, `reports.export` |
| Employees | `employees.view`, `.create`, `.edit` *(archive/delete use `.edit`)* |
| AI | `ai.view` |
| Settings | `settings.view`, `.edit`, `.users`, `.roles`, `.security`, `.branding`, `.api` |

**Helpers:** `HasPermission`, `HasAnyPermission`, `HasRole`, `CanDemoReset` (`role == super_admin`).

Seeded permission/role catalogs: see `permissions.json` / `roles.json` counts in `GO_BACKEND_INVENTORY.md` (43 permissions, 14 roles).

---

## 3. Route ↔ permission matrix (test planning)

Status keys for this matrix:

| Key | Meaning |
|-----|---------|
| `COV` | Covered by existing automated test (Go or QA suite) |
| `SMOKE` | Exercised indirectly by browser/business QA while logged in as privileged demo user |
| `GAP` | No automated proof — needs test |

### Auth endpoints

| Method | Path | AuthN | AuthZ | Coverage |
|--------|------|-------|-------|----------|
| POST | `/auth/login` | Public | — | COV (http integration) + SMOKE (browser 112) |
| POST | `/auth/logout` | Session | — | GAP |
| GET | `/auth/me` | Session | — | GAP (likely used by app; not asserted) |
| POST | `/auth/change-password` | Session | — | GAP |
| POST | `/auth/forgot-password` | Public | stub | GAP |
| POST | `/auth/reset-password` | Public | stub | GAP |
| POST | `/demo/reset` | Session | `super_admin` + flag | GAP |

### Negative auth cases (recommended)

| Case | Expected | Coverage |
|------|----------|----------|
| No Authorization on `/clients` | 401 | COV (http integration) |
| Expired / revoked token | 401 | GAP |
| Inactive user login | 401/403 | GAP |
| Wrong password | 401 | GAP |
| Non–super_admin demo reset | 403 | GAP |
| Demo reset when flag false | 403 | GAP |

---

## 4. RBAC allow / deny matrix (by module)

Assumption for SMOKE: browser/business QA run as a **privileged demo admin** (full permissions). That does **not** prove deny paths for limited roles.

| Module | Required permission(s) | Allow path coverage | Deny path coverage |
|--------|------------------------|---------------------|--------------------|
| Dashboard | `dashboard.view` | SMOKE | GAP |
| Clients | `clients.*` | SMOKE (CRUD create/archive) | GAP |
| Companies | `companies.*` / edit for delete | SMOKE (page load) | GAP |
| Employees | `employees.*` / edit for delete | SMOKE (page load) | GAP |
| Invoices | `invoices.*` | SMOKE + business | GAP |
| Payments | `payments.view` / `.create` | SMOKE + business | GAP |
| Documents | `documents.view` / upload / delete | SMOKE (upload) | GAP |
| Tasks / Notes | `tasks.*` / `dashboard.view` | SMOKE (load) | GAP |
| Compliance + GST/ITR/TDS/ROC | compliance / `*.view` | SMOKE (load) | GAP |
| Accounting | `accounting.view` | SMOKE + business (unbalanced reject) | GAP |
| Reports | `reports.view` | SMOKE | GAP |
| Search / Calendar / Notifications | `dashboard.view` | SMOKE | GAP |
| Archive / Recycle | `settings.view` | SMOKE (restore) | GAP |
| Settings / org | `settings.view` / `.edit` | SMOKE (branding) | GAP |
| Users | `settings.users` | SMOKE (create user) | GAP |
| Roles / permissions | `settings.roles` | SMOKE (create role) | GAP |
| Chat / AI | `ai.view` | SMOKE (send) | GAP |
| Audit logs | `settings.view` | GAP | GAP |

---

## 5. Frontend RBAC / auth UX

| Behavior | Location | Coverage |
|----------|----------|----------|
| Login / guest redirect | `LoginPage`, `GuestRoute` | SMOKE |
| Protected layout | `ProtectedRoute` | SMOKE |
| Unauthorized page | `/unauthorized` | GAP (role-limited users) |
| Nav permission filtering | `constants/navigation.ts` + auth store | GAP for limited roles |
| Settings user/role CRUD | SettingsPage | SMOKE (create user/role + refresh) |
| Token persistence | `smart-ca-token` + Zustand auth | SMOKE |
| 401 clears session | httpClient | GAP automated |

---

## 6. Business / browser QA auth-related evidence

| Suite | Result | Auth-relevant cases |
|-------|--------|---------------------|
| Browser **112/112** | PASS | Login; settings create user (+ refresh); create role; theme; notification switches; recycle; privileged module page loads |
| Business **24/24** | PASS | Financial + accounting rules under authenticated QA harness (`__SMART_CA_QA__`) |

These prove **happy-path privileged** behavior against the live API. They are **not** a full RBAC deny matrix and do **not** justify labeling individual routes `VERIFIED_E2E`.

---

## 7. Recommended test backlog (ordered)

1. **Go table-driven RBAC:** for each permission constant, assert allow with permission present and 403 when absent (sample one route per family).  
2. **Session lifecycle:** expiry, logout revoke, concurrent logout.  
3. **Demo reset AuthZ:** super_admin only; flag off.  
4. **Inactive / bad credentials** login cases.  
5. **Frontend limited-role Playwright:** staff role cannot open Settings users; cannot demo reset.  
6. **Change-password** success + wrong current password.  
7. After GAP-P2-001: login-history visibility for self vs admin.

---

## 8. Related docs

- `SYSTEM_GAP_ANALYSIS.md` — GAP-P4-002 test thinness  
- `Go/docs/GO_BACKEND_INVENTORY.md` — auth/rbac packages  
- `Go/docs/API_ROUTE_INVENTORY.md` — per-route permissions  
- `FEATURE_API_TRACEABILITY_MATRIX.md` — COMPLETE_VERIFIED flows  
- Seed / local demo docs — **credentials** (not duplicated here)
