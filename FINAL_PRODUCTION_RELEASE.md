# FINAL PRODUCTION RELEASE — SmartCA v1.0.0

**Release date:** 2026-07-27  
**Release Manager:** SmartCA Release Board  
**Channel:** `origin/main` (direct push; no PR)

---

## Release identity

| Field | Value |
|-------|--------|
| **Release version** | **v1.0.0** |
| **Tag** | `v1.0.0` (annotated; source of truth for commit SHA) |
| **Commit subject** | `release: SmartCA Enterprise Practice Core and Work Management v1.0` |
| **Parent** | `76c20ca` (prior Docker GA tip) |
| **History shape** | Exactly **one** new commit on `main` (squash of feature work) |
| **Resolve SHA** | `git rev-list -n1 v1.0.0` |

---

## What shipped

- Enterprise Work Management (`wm_*`)
- Practice Core (roles, intake, TL→CA→Manager gates, checklist, engagements)
- Firm isolation (ABC / WM / PRACTICE tenancy)
- RBAC + auth permission merge
- Frontend Work module (list, board, calendar, timeline, dashboard, team, intake, detail)
- Migrations **006–010**
- Seeds: `wmseed`, `practiceuatseed`, `wmreceptionseed`, `abcfirmseed`
- Docker Compose full stack
- Practice UAT + RC documentation

---

## Build status (from release commit)

| Check | Result |
|-------|--------|
| `go build ./cmd/api` | PASS |
| `go test ./internal/workmgmt/...` | PASS |
| `npm run build` (saas) | PASS |
| `docker compose build` | PASS (`smartca-api:local`, `smartca-web:local`) |

---

## Docker / migration versions

| Item | Value |
|------|--------|
| Compose project | `smartca` |
| API image | `smartca-api:local` |
| Web image | `smartca-web:local` |
| DB image | `postgres:18-alpine` |
| Migrations | through `010_wm_reports_to_backfill` |
| Containers at release | **Stopped** (`docker compose down`) — clean for production deploy |

---

## Backend / frontend

| Component | Notes |
|-----------|--------|
| Backend | Go API with Practice Core + Work Management |
| Frontend | React/Vite SaaS with Work + Intake screens |
| OpenAPI | Practice Core paths documented |

---

## Git status after release

- `main` points at single squash release commit.
- Feature branch intermediate commits **not** preserved on `main`.
- `feature/enterprise-work-management` removed after release (remote + local).
- No `.env` / secrets in tree (gitignored).
- Docker containers stopped; unused networks cleaned; volumes retained.

---

## Known issues (non-blocking)

Documented in `PRACTICE_UAT_REPORT.md` / `FINAL_RC_REPORT.md`:

- UX: Team page is provisioning, not org chart; ownership IDs vs names.
- Product backlog: recurring compliance packs, partner sign-off queue UX polish, capacity planning.
- Demo seed may still contain prior XSS-title QA strings on local DBs (cosmetic).

---

## Release notes (short)

SmartCA **v1.0.0** delivers production Practice Core for CA firms: hierarchical RBAC, intake→assign→verify→close workflow, firm-scoped workbooks, Work Management UI, and Docker-first deployment with migrations through 010.

---

## Post-push validation

Fresh clone from `main` / tag `v1.0.0`, build API + SaaS (+ Docker when available), confirm health — recorded by Release Manager after push.

**Recommendation:** **GO** for production deployment from tag `v1.0.0`.
