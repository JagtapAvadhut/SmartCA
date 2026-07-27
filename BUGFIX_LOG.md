# Bugfix log

## BUG-0001 — Partner sign-off required for close

- **Status:** FIXED-PENDING-QA
- **Root cause:** `CloseWork` treated Manager as an allowed closer when `requiresPartnerSignoff` was set (`role != Partner && role != Manager`), and Manager inherited `work.close.partner` via `AllPermissions()`.
- **Fix:** Enforce Partner-only close when the flag is set; strip `PermClosePartner` from Manager's default permission set. Added `TestCloseWork_RequiresPartnerSignoff_BlocksManager`.
- **Tests:** `go test ./internal/workmgmt/...` PASS

## BUG-0002 — Segregation of duties on TL/CA verify gates

- **Status:** FIXED-PENDING-QA
- **Root cause:** Manager inherited `work.verify.tl` and `work.verify.ca` via `AllPermissions()` / hierarchy grants, so one Manager could alone advance `READY_FOR_TL_VERIFY` → `READY_FOR_CA_VERIFY` → `READY_FOR_MANAGER_CLOSE`.
- **Fix:** Strip both verify permissions from Manager defaults; hard-deny Manager on `VerifyTL`/`VerifyCA` (even with stale grants); reject CA verify when the actor is the same as the TL-pass verifier. Added `TestVerifyGates_SoD_ManagerAndSameActorCannotBoth`.
- **Tests:** `go test ./internal/workmgmt/...` PASS

## BUG-0003 — Invalid clientId on intake approve / engagement create → 500

- **Status:** FIXED-PENDING-QA
- **Root cause:** Postgres FK violations (`23503` on `fk_wm_eng_client` / `fk_wm_intake_client`) from `ApproveIntakeAtomic` / `CreateEngagement` were not mapped; service wrapped them as Internal / handlers treated raw errors as unexpected 500.
- **Fix:** `mapFKViolation` maps client/company/engagement FK constraints to `BadRequest`; `ApproveIntake` and `CreateEngagement` return the mapped AppError. Added `TestCreateEngagement_InvalidClientID_NotInternal` and `TestApproveIntake_InvalidClientID_NotInternal`.
- **Tests:** `go test ./internal/workmgmt/...` PASS

## BUG-0004 — Duplicate period work returns 500 not conflict

- **Status:** FIXED-PENDING-QA
- **Root cause:** Postgres unique violations (`23505` on `uq_wm_work_company_period` / `uq_wm_work_client_period`) from `CreateWork` were wrapped as Internal 500.
- **Fix:** `mapUniqueViolation` maps period unique indexes to `Conflict` (409); `CreateWork` returns mapped AppError via `mapGateErr`. Added `TestCreateWork_DuplicatePeriod_Conflict`.
- **Tests:** `go test ./internal/workmgmt/...` PASS

## BUG-0005 — Alok 55-user Practice UAT seed missing

- **Status:** FIXED-PENDING-QA
- **Root cause:** Only `wmseed` (5k load) existed; Architecture D5 / BC-P0-13 Practice UAT seed (55 named Alok org) was never shipped.
- **Fix:** New seeder `Go/cmd/practiceuatseed` — idempotent wipe of `PRACTICE-*` / `@practice.smartca.in` only; 55 named users with `reportsTo` hierarchy + 2 PENDING_PLACEMENT; 300 clients / 100 companies / 120 engagements / 500 practice works / 15 intakes. Password `SmartCA@2025` (same bcrypt as wmseed). Roster smoke test in `cmd/practiceuatseed`.
- **Run:** `cd Go && go run ./cmd/practiceuatseed` (DB defaults: smartca / yourpassword).
- **Verify:** Alok/Nitesh/Mukesh `fullName` counts > 0 via psql after seed.
- **Tests:** `go test ./cmd/practiceuatseed/ ./internal/workmgmt/...` PASS

## BUG-0006 — Ownership triad empty on nearly all works

- **Status:** FIXED-PENDING-QA
- **Root cause:** `wmseed` inserted only `assigned_by`/`assigned_to`; Practice Core triad columns (`owner_ca_id`/`tl_id`/`assignee_id`) from 007 were never backfilled. `CreateWork` only auto-set owner when actor was CA and tl when actor was TL.
- **Fix:** Additive migration `009_ownership_triad_backfill` (H0 assignee sync; H1 role-aware from assigner/assignee; H2 engagement owner; H3 WM-* pool heuristic `WM-CA-((n-1)%20)+1` / `WM-TL-((n-1)%50)+1`). `wmseed` now writes triad on insert. `ApplyOwnershipTriadDefaults` + `CreateWork` derive triad from actor/assignee roles when empty. PRACTICE-* already had triad (no seeder change).
- **Local verify:** before `triad_missing=5006` / `with_triad=510`; after `triad_missing=0` / `with_triad=5516`.
- **Tests:** `go test ./internal/workmgmt/...` PASS (`TestCreateWork_PopulatesOwnershipTriad`)

## BUG-0007 — WM hierarchy has no reports_to; DownlineIDs not hydrated

- **Status:** FIXED-PENDING-QA
- **Root cause:** `wmseed` omitted `reportsTo`/`reports_to`; `actorFrom` never populated `Actor.DownlineIDs`, so CA/TL list scope was portfolio/team only (empty downline).
- **Fix:** Migration `010_wm_reports_to_backfill` + `wmseed` Manager→CA→TL→Emp tree; `WorkHandler.DownlineFn` loads user reports edges and `CollectDownlineIDs` hydrates actor; CreateTeamUser sets reports_to to creator. Unit tests in `downline_scope_test.go`.
- **Local verify:** WM `with_reports_to=370` / 375; sample CA→MGR, TL→CA, Emp→TL.
- **Tests:** `go test ./internal/workmgmt/...` PASS

## BUG-0008 — Auth login omits Practice Core permission strings

- **Status:** FIXED-PENDING-QA
- **Root cause:** Seeded `user.data.permissions` still held classic WM grants; login/`/auth/me` returned that JSON as-is while API gates fell back to `PermissionsForRole`.
- **Fix:** `sanitizeUser` merges `workmgmt.PermissionsForRole(NormalizeHierarchyRole(role))` into the returned permissions (login + session/`/auth/me`). Manager SoD unchanged (no verify.tl/ca / close.partner). `wmseed` seeds via `PermissionsForRole`; FE manager hierarchy list aligned.
- **Verify:** Login manager → payload includes `work.transition`, `work.close.manager`, `intake.*`; employee → includes `work.transition` but not assign/close/intake.approve.
- **Tests:** `go test ./internal/app/services/ -run TestLogin_MergesPracticeCorePermissions` PASS; `go test ./internal/workmgmt/...` PASS
