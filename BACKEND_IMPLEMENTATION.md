# BACKEND_IMPLEMENTATION.md — Practice Core (v1)

**Team:** Backend (Team 3)  
**Date:** 2026-07-27  
**Branch:** `feature/enterprise-work-management` (working tree; not pushed)  
**Authority:** [ARCHITECTURE_REVIEW.md](./ARCHITECTURE_REVIEW.md) + [BUSINESS_REVIEW.md](./BUSINESS_REVIEW.md) P0s as phased in Architecture §1–§2  

---

## 1. Summary

Practice Core backend is implemented **additively** on the existing `workmgmt` module and migration `006`. Free `PATCH status → completed` is no longer the control path; gated transitions, intake, ownership triad, practice statuses, checklist verify, and corrected role normalize are enforced in Go with unit tests.

**Claim:** This is **Practice Core API/domain progress** — not a Release Gate authorization for CA practice production.

---

## 2. What was built

### 2.1 Role model & RBAC (B1)

| Change | Detail |
|--------|--------|
| Canonical roles | `partner`, `manager`, `ca`, `senior_ca`, `junior_ca`, `team_leader`, `accountant`, `article_assistant`, `employee`, `hr`, `reception`, `admin`, `client` |
| Normalize fix | Partner ≠ Manager; Article/Junior ≠ TL; HR/Reception ≠ Employee+edit; Accountant stays accountant |
| Permissions | Added `work.transition`, `work.verify.tl`, `work.verify.ca`, `work.close.manager`, `work.close.partner`, `work.reopen`, `intake.*`, `hierarchy.place`, `engagement.*` |
| Explicit denies | HR/Reception lack `work.create` / `work.assign` / `work.edit`; Article lacks verify/close; Executors lack assign |

**Files:** `Go/internal/workmgmt/hierarchy.go`, `Go/internal/rbac/rbac.go`

### 2.2 Client / Company / Engagement (B2 partial)

| Field / table | Notes |
|---------------|-------|
| `wm_work_items.client_id` | Existing; still references SmartCA clients |
| `company_id`, `engagement_id` | New columns |
| `work_type`, `period_key`, `fy` | Period uniqueness indexes (company + client-only variants) |
| `wm_engagements` | Retainer: client, optional company, owner CA, services[] |

Corporate GST/ROC create requires `company_id` (server validation).

### 2.3 Ownership triad (B2)

`owner_ca_id`, `tl_id`, `assignee_id` on work items. `assigned_to` kept in sync with assignee for backward compatibility.  
`POST /items/{id}/assign` with slot `owner_ca` \| `tl` \| `assignee`.

### 2.4 Practice statuses & overlays (B3)

Primary status enum (stored in `status` after 007 backfill):

`OPEN`, `DOCUMENT_PENDING`, `DOCUMENT_RECEIVED`, `IN_PROGRESS`, `BLOCKED`, `ON_HOLD`, `READY_FOR_TL_VERIFY`, `TL_REJECTED`, `READY_FOR_CA_VERIFY`, `CA_REJECTED`, `READY_FOR_MANAGER_CLOSE`, `DELIVERED`, `CLOSED`, `CANCELLED`

Legacy map: `todo→OPEN`, `in_progress→IN_PROGRESS`, `blocked→BLOCKED`, `review→READY_FOR_TL_VERIFY`, `completed→CLOSED` if risk=`low` else `READY_FOR_MANAGER_CLOSE`, `cancelled→CANCELLED`.

Overlays (orthogonal): `GSTR1_FILED`, `GSTR3B_FILED`, `ITR_UNDER_REVIEW`, `NOTICE_REPLY_DUE` (+ forward-compat string).

`PATCH` may only move among free operational statuses; gate targets return **409 Conflict**.

### 2.5 Review gates (B3–B4)

| API | Guard |
|-----|-------|
| `POST /items/{id}/transitions` | Legal edges; submit-for-TL by assignee/TL/CA/Manager |
| `POST /items/{id}/verify/tl` | `work.verify.tl`; pass → `READY_FOR_CA_VERIFY`; fail + remarks |
| `POST /items/{id}/verify/ca` | `work.verify.ca`; junior blocked on high risk; med/high → close queue; low(+delegated) → `DELIVERED` |
| `POST /items/{id}/close` | Manager/Partner; `requires_partner_signoff` forces partner perm |
| `POST /items/{id}/reopen` | Reason required |

Every gate writes **transition history + activity + audit + notification** (four shadows) in **one DB transaction** (`ApplyGateWrite`: `FOR UPDATE` + expected-status guard → 409 on conflict).

### 2.6 Intake (B5)

| API | Notes |
|-----|-------|
| `POST /intakes` | Reception (+ Manager/CA who have `intake.create`) |
| `GET /intakes` | Desk / Manager queue |
| `POST /intakes/{id}/approve` | Creates `wm_engagements` link; sets client/company/owner CA |
| `POST /intakes/{id}/reject` | Remarks required |

Intake is **not** a Closed work item.

### 2.7 Checklist (B6)

| API | Notes |
|-----|-------|
| `GET/POST /items/{id}/checklist` | Template/manual items |
| `POST /items/{id}/checklist/{cid}/verify` | pass/fail; remarks required on reject; TL/CA/Manager only |

### 2.8 List / dashboard scope (B2)

| Role | Scope |
|------|-------|
| Partner / Manager | Firm-wide |
| CA / Senior CA | `owner_ca_id` + downline (`Actor.DownlineIDs`) |
| TL | `tl_id` + downline |
| Executors | Assignee only |
| HR / Reception | **Zero** work rows on list (intake is separate) |

Wire `reports_to` → `Actor.DownlineIDs` at auth hydration (handler currently leaves empty unless set by caller/tests) — see gaps.

### 2.9 Risk & delegated close (B3)

`risk_class` (`low`/`medium`/`high`), `delegated_close`, `requires_partner_signoff` on work items.

---

## 3. Migrations

| # | File | Purpose |
|---|------|---------|
| **007** | `Go/migrations/007_practice_core.up.sql` | `wm_engagements`, `wm_intakes`, `wm_checklist_items`, `wm_work_transitions`; alter `wm_work_items`; status CHECK dual-read + **risk-aware** backfill (`completed`→`CLOSED` only if risk=`low`, else `READY_FOR_MANAGER_CLOSE`); period unique indexes |
| **007 down** | `Go/migrations/007_practice_core.down.sql` | Drops Practice Core tables/columns (keeps 006) |
| **008** | `Go/migrations/008_practice_integrity.up.sql` | FKs work/engagement/intake → `clients`/`companies`/`wm_engagements`; `risk_class` CHECK; safety remap for blind CLOSED |

Soft-delete columns preserved. No hard-delete app paths.

**Local apply (2026-07-27):** `007` + `008` recorded in `schema_migrations`. See [DATABASE_P0_REMEDIATION.md](./DATABASE_P0_REMEDIATION.md).

---

## 4. API surface (new / changed)

Base: `/api/v1/work`

| Method | Path | Perm |
|--------|------|------|
| POST | `/items` | `work.create` (was assign-only) |
| POST | `/items/{id}/transitions` | `work.transition` |
| POST | `/items/{id}/verify/tl` | `work.verify.tl` |
| POST | `/items/{id}/verify/ca` | `work.verify.ca` |
| POST | `/items/{id}/close` | `work.close.manager` |
| POST | `/items/{id}/reopen` | `work.reopen` |
| POST | `/items/{id}/assign` | `work.assign` (slot body) |
| GET/POST | `/items/{id}/checklist` | view / edit |
| POST | `/items/{id}/checklist/{cid}/verify` | TL/CA/Manager (service) |
| POST/GET | `/intakes`, approve/reject | intake.* |
| POST/GET | `/engagements` | engagement.create / view |

Existing child soft-log routes retained.

---

## 5. Key Go files

| Path | Role |
|------|------|
| `internal/workmgmt/hierarchy.go` | Roles, normalize, permissions, list scope |
| `internal/workmgmt/transitions.go` | Status machine helpers |
| `internal/workmgmt/practice_service.go` | Gates, intake, checklist, assign slots |
| `internal/workmgmt/service.go` | Create/Update hardened; create≠free complete |
| `internal/workmgmt/models.go` | Triad, engagement, intake, checklist types |
| `internal/workmgmt/memory_store.go` | In-memory Practice Core for tests |
| `internal/workmgmt/postgres_store.go` + `postgres_practice.go` | PG persistence |
| `internal/api/handlers/work.go` | HTTP handlers |
| `internal/api/routes/routes.go` | Route mount |
| `internal/rbac/rbac.go` | Permission constants |
| `internal/workmgmt/practice_core_test.go` | Hierarchy negatives, gates, intake, checklist, scope |

---

## 6. Tests

```text
go test ./internal/workmgmt/...
ok
```

```text
go build ./cmd/api
ok
```

Coverage includes:

- Normalize: Article≠TL, Partner≠Manager, HR/Reception distinct  
- RBAC negatives: HR/Reception create, Article TL verify, Employee close/CA verify  
- Review gates happy path + PATCH CLOSED rejected  
- Intake create → approve/reject  
- Checklist verify/reject remarks  
- Corporate `companyId` required  
- CA downline list scope  

---

## 7. Known gaps vs Architecture backlog

| Item | Status | Reason / defer |
|------|--------|----------------|
| **D5** Practice UAT seed (55 named / 300/100/500) | Deferred | Seed/script ownership; optional load seed remains separate |
| **B9 / v1.1** Calendar generator + T-10/T-5/T-1 jobs | Out of v1 | Architecture explicit |
| Full overlay catalogue (ROC/Notice war room) | Partial | Starter GST/ITR overlays only |
| Auth hydration of `reports_to` → `DownlineIDs` | **Done (BUG-0007)** | `WorkHandler.DownlineFn` + `CollectDownlineIDs`; wmseed/010 backfill |
| OpenAPI / swagger update | Deferred | Handlers live; YAML not regenerated this pass |
| FE Practice boards / IA | Out of scope | Backend team only |
| Partner fee/opinion policy matrix depth | v1.1 | High-risk / partner-flag close only in v1 |
| Senior CA delegated verify nuance | v1.1 | Senior has same verify.ca as CA when Acting Owner not modelled |
| `hierarchy.place` API | Deferred | Permission exists; placement still Manager team/users path |
| Dual-write `practice_status` separate column | Not used | Architecture allowed evolving `status` CHECK; single column after backfill |
| Transactional single DB tx for four shadows | **Done (P0)** | `ApplyGateWrite` / `ApproveIntakeAtomic`: FOR UPDATE + expected-status UPDATE + shadows in one tx; conflict → 409 |
| Client portal / WhatsApp / notices / billing FEE_CHASE | v1.1+ | Non-goals |

---

## 8. Operator notes

1. Apply migrations **007** then **008** after **006** on Postgres (API boot runs `database.Migrate`).  
2. Existing rows are backfilled to practice statuses (risk-aware `completed`).  
3. Clients must stop using Complete via `PATCH status=completed`; use transitions → verify → close.  
4. Do not claim CA practice WM complete until Architecture/Business **Release Gate**.  
5. DB P0 evidence: [DATABASE_P0_REMEDIATION.md](./DATABASE_P0_REMEDIATION.md).

---

*End of Backend Practice Core implementation note.*
