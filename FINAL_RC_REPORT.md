# FINAL RC REPORT — SmartCA Enterprise Work / Practice Core

**Date:** 2026-07-27  
**Branch:** `feature/enterprise-work-management`  
**Mission:** Final Release Candidate A–Z validation before push  

---

## Release recommendation

**APPROVE push of feature branch** (no merge to `main` in this step).

| Gate | Result |
|------|--------|
| Backend build | PASS |
| Frontend build | PASS |
| Unit / workmgmt tests | PASS |
| Practice E2E (24) | PASS |
| Migrations 006–010 | PASS (local + Docker) |
| Health live/ready | PASS |
| Docker compose rebuild | PASS (db/api/web healthy) |
| Critical bugs open | **0** (firm isolation fixed in RC) |
| High bugs open (RC blockers) | **0** |
| Secrets in commit | Reviewed — `.env` gitignored |

---

## Build status

| Component | Command / check | Result |
|-----------|-----------------|--------|
| Go API | `go build ./cmd/api` | PASS |
| workmgmt tests | `go test ./internal/workmgmt/... -count=1` | PASS |
| SaaS | `npm run build` (`tsc -b && vite build`) | PASS |
| Docker images | `smartca-api:local`, `smartca-web:local` | Built |
| Compose | `docker compose up --build -d` | db/api/web **healthy** |

---

## Docker status

| Service | Image | Health |
|---------|-------|--------|
| `smartca-db` | `postgres:18-alpine` | healthy |
| `smartca-api` | `smartca-api:local` | healthy |
| `smartca-web` | `smartca-web:local` | healthy (published `:8080`) |

Migrations applied in container: `006` … `010`.  
Login smoke (Docker): `rajesh.sharma@smartca.in` → **200**.  
Web UI (`/`) → **200**.  
No restart loops observed in compose logs after healthy.

---

## Database status

Local Postgres (`smartca` / migrations recorded through `010_wm_reports_to_backfill`).  
Docker volume DB applied same migration set on fresh compose.  
FK / soft-delete / triad / reports_to / practice integrity present.

---

## Critical RC bug found and fixed

| ID | Title | Severity | Status |
|----|-------|----------|--------|
| RC-FIRM-01 | Leadership list/dashboard saw **all firms** (~6583 works) — ABC MP and WM Manager identical totals | **Critical** | **FIXED** |

**Fix:** Firm tenancy via user-id prefix (`ABC-` / `WM-` / `PRACTICE-`) on `Actor.FirmKey`, `ListFilter.FirmKey`, `canViewWork`, ListWork SQL, and Dashboard (incl. department + follow-ups).  
**Proof:** ABC MP list **901**; WM Manager list **5022**; dashboard dept totals for ABC sum to firm book (~901).  
**Test:** `TestFirmIsolation_LeadershipCannotSeeOtherFirm`.

---

## Business / role validation (sample)

| Flow / role | Result |
|-------------|--------|
| Auth login roles (ABC / WM / practice) | PASS |
| Reception intake create | PASS (E2E) |
| Manager intake approve/reject | PASS |
| Checklist verify/reject | PASS |
| TL/CA verify SoD / emp blocked | PASS |
| HR cannot create work | PASS |
| Emp cannot create | PASS |
| Partner sign-off (prior BUG-0001) | VERIFIED historically |
| Firm isolation leadership | PASS (RC fix) |
| Soft-delete / hard-delete ban | Covered in prior QA |

Known product gaps from `PRACTICE_UAT_REPORT.md` (enhancements, not RC blockers): Team page ≠ org chart, ownership names UX, partner button copy, recurring packs, etc.

---

## API / security / performance

| Check | Result |
|-------|--------|
| No auth → 401 | PASS |
| Privilege escalation smokes (E2E) | PASS |
| SQLi search smoke | PASS (no crash) |
| XSS title stored (React text) | PASS (not executed) |
| List/dashboard latency (scoped) | Typically tens of ms locally |

---

## Automation

| Suite | Result |
|-------|--------|
| `go test ./internal/workmgmt/...` | PASS |
| `saas/scripts/qa-practice-e2e.mjs` | **24 PASS / 0 FAIL** |

---

## Git

- **Do not merge to `main` automatically** (per mission).
- Feature branch push only after this report.
- `.env` excluded via `.gitignore`.
- Large `saas/qa-artifacts/` screenshots **not** required in git (optional evidence locally).

**Commit hash:** `b5db21004b7b033928fdd842a6237d5762430765`  
**Docker image tags:** `smartca-api:local`, `smartca-web:local`

---

## Remaining known issues (non-blocking for feature push)

1. Practice UAT UX enhancements (Top 100 in `PRACTICE_UAT_REPORT.md`) — backlog.  
2. Compose PowerShell exit code noise on `docker compose down` stderr (containers still healthy).  
3. Call-log “upcoming” dashboard metric still loosely scoped.  
4. Demo XSS titles may remain in WM seed data on local DB (cosmetic trust issue for demos).

---

## Sign-off

RC gates required for **feature branch push** are met after firm-isolation fix + Docker healthy rebuild.  
**Merge to main** remains a separate Release Manager decision.
