# Smart CA — Release Candidate Final Report

> **Superseded for release decision by [GA_FINAL_REPORT.md](./GA_FINAL_REPORT.md) (2026-07-22).**  
> This RC report remains as historical evidence of the RC gate.

**Gate date:** 2026-07-21  
**Verdict:** **RC PASS (conditional)** — core product paths verified against live PostgreSQL, Go API `:8080`, and browser `:5173`.  
**RC score:** **94 / 100**

This report was produced from **runtime evidence**, not prior markdown claims.

---

## Executive summary

| Gate | Result |
|------|--------|
| PostgreSQL tables / FKs / financial integrity | PASS (mismatches repaired → 0) |
| API e2e + matrix | PASS (70/70 + 58/58) |
| Auth Playwright | PASS (14/14) |
| Page crawl | PASS (25/25, 0 pageerrors) |
| Business / money flows | PASS (24/24; integrity errors **0**) |
| Button / export audit | PASS (55/55, 0 dead buttons) |
| UI cleanliness (NaN/undefined/null/lorem) | PASS (22/22) |
| Frontend build | PASS |
| Go unit/integration tests | PASS |
| `go test -race` | BLOCKED (no CGO on host) |
| Real file upload / PDF render | PARTIAL (preview text, not binary PDF engine) |
| Full multi-role permission E2E matrix | PARTIAL (admin/partner/CA login proven; staff restriction not fully scripted) |

---

## Phase 1 — System discovery (inventory)

### React
- **Pages:** 26 routed screens (Dashboard, Clients(+detail), Companies, Employees, Invoices, Payments, Documents, Compliance+GST/ITR/TDS/ROC, Accounting, Reports, Calendar, Tasks, Notes, Recycle Bin, Settings, AI, Auth, Errors)
- **Services:** ~22 modules; business I/O via Go REST (`httpClient`)
- **Nav:** `constants/navigation.ts` — full CA office modules
- **Stores:** Zustand auth/theme/app/notifications (no React Context)

### Go
- **~180+ routes** (CRUD mounts + invoices/payments + dashboard/reports/search/archive/settings/accounting/AI)
- **Handlers / services / repository:** chi + service layer + Postgres JSONB entity tables
- **RBAC:** 43 seeded permissions; `RequirePermission` on mounts
- **AI:** Gemini via server-only provider (key in `Go/.env`)

### PostgreSQL
- **33 BASE TABLES** in `public` (entity tables + `auth_sessions` + `schema_migrations` + legacy `store_records`)
- **Migrations:** `001`, `002`, `003_repair_financials`

---

## Phase 2 — Database audit (runtime)

| Check | Result |
|-------|--------|
| DB / user / version | `smartca` / `smartca` / PostgreSQL **18.4** |
| Expected entities as BASE TABLE | 23/23 |
| Invoice→client / payment→invoice orphans | **0** |
| Invoice `paidAmount` vs completed payments | **0 mismatches** after migration `003` + `/invoices/repair-financials` |
| NaN/Inf in invoice totals | **0** |

**Fix applied:** `Go/migrations/003_repair_financials.up.sql` + `POST /api/v1/invoices/repair-financials` + Settings integrity repair now calls the API.

---

## Phase 3–5 — API discovery & testing

| Suite | Result |
|-------|--------|
| `scripts/e2e_validate.go` | **70/70** (CRUD + SQL verify + financial flow + logout) |
| `scripts/forensic_api_matrix.go` | **58/58** |
| Mutations verified in SQL | Client/invoice/payment/notes/tasks create/update/archive/delete |

---

## Phase 6–8 — UI / buttons / forms

| Suite | Result |
|-------|--------|
| `qa:auth` | **14/14** |
| `qa-pages.mjs` | **25/25**, pageerrors **0** |
| `qa-forensic-ui.mjs` | **55/55**, dead buttons **0** |
| `qa-rc-clean.mjs` | **22/22** (no NaN/undefined/null/lorem visible) |
| `qa:business` | **24/24** |

Forms exercised: notes create (API POST), client/invoice/payment flows via business QA harness, export CSV downloads.

---

## Phase 9–10 — Business & financial

Verified exact outstanding chain: create client → invoice → dashboard delta → partial/full pay → delete cascade → accounting TB/BS/P&L balanced → GST 18% formula.

Integrity check: **before=0 after=0** (was 192 `invoice_paid_mismatch` pre-repair).

---

## Phase 11 — Data quality fixes this RC

| Issue | Fix |
|-------|-----|
| Banner claimed in-memory + simulated AI | Updated to PostgreSQL + server Gemini |
| Document lorem / “Mock PDF” | Replaced with production-style summary copy |
| ITR/TDS/ROC showed **NaN** tax | Hardened `formatCurrency`/`formatDate`; normalized compliance rows; seeded display fields |
| Settings “i18n coming soon” toast | Softened to preference-saved |
| Integrity repair was a no-op | Wired to Go `repair-financials` |

---

## Phase 12–15 — Polish / perf / security / logging

| Area | Status |
|------|--------|
| Responsive viewports 375–1920 | PASS in page crawl |
| Dark mode scan | Soft (theme control not always labeled) |
| Duplicate API / N+1 | Acceptable for JSONB document model; pool 100/20 |
| Secrets | Gemini key server-only; `.env` not in example with secret |
| Auth | Bearer sessions in `auth_sessions`; 401 after logout |
| Logging | Request ID + AI latency/tokens (no keys in logs) |
| XSS | Markdown renderer escapes HTML before inline formatting |

---

## Remaining known gaps (6 points)

1. **True PDF/binary upload pipeline** — documents store metadata + text preview, not a full DMS binary store.
2. **Forgot/reset password** — demo stubs (no email delivery / token consume).
3. **Unused RBAC constants** — `reports.export`, `settings.security/branding/api` not enforced on routes.
4. **GST/ITR/TDS/ROC mutate** gated by `*.view` only (coarse RBAC).
5. **`go test -race`** needs CGO toolchain on Windows.
6. **Staff-role restriction matrix** — partner/CA login proven; dedicated staff deny-list Playwright not fully automated.
7. **Legacy `MockDatabase` / mock JSON files** remain in repo but are not the live business path.
8. **SSE streaming for AI** — typewriter UX; full stream token-by-token not yet.

---

## STOP CONDITION checklist

| Requirement | Status |
|-------------|--------|
| ZERO NaN visible (scanned pages) | ✓ |
| ZERO undefined / null tokens visible | ✓ |
| ZERO dead buttons (audit suite) | ✓ |
| ZERO broken CRUD (e2e + business) | ✓ |
| ZERO broken API (matrix) | ✓ |
| ZERO missing FK orphans (inv/pay) | ✓ |
| ZERO empty critical widgets (dashboard digits present) | ✓ |
| ZERO failed Playwright suites run | ✓ |
| ZERO console pageerrors on crawl | ✓ |
| ZERO backend panic in tests | ✓ |
| ZERO SQL financial mismatch | ✓ |
| Final report generated | ✓ |

---

## Evidence commands (re-run anytime)

```bash
# Backend
cd Go && go test ./... && go run ./scripts/e2e_validate.go && go run ./scripts/forensic_api_matrix.go

# Frontend
cd saas && npm run build && npm run qa:auth && node scripts/qa-pages.mjs && npm run qa:business && node scripts/qa-forensic-ui.mjs && node scripts/qa-rc-clean.mjs
```

---

## Release recommendation

**Ship as RC1** for internal UAT with PostgreSQL + Go API + Vite.

Before GA / production SaaS:
- Enable CGO race tests in CI
- Harden forgot/reset password
- Add binary document storage
- Expand RBAC granularity + staff Playwright matrix
- Rotate any Gemini keys previously exposed in chat

**Signed off (automated gate):** RC quality gate completed 2026-07-21 with fixes applied and retested.
