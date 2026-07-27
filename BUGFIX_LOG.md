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
