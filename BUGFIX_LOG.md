# Bugfix log

## BUG-0001 — Partner sign-off required for close

- **Status:** FIXED-PENDING-QA
- **Root cause:** `CloseWork` treated Manager as an allowed closer when `requiresPartnerSignoff` was set (`role != Partner && role != Manager`), and Manager inherited `work.close.partner` via `AllPermissions()`.
- **Fix:** Enforce Partner-only close when the flag is set; strip `PermClosePartner` from Manager's default permission set. Added `TestCloseWork_RequiresPartnerSignoff_BlocksManager`.
- **Tests:** `go test ./internal/workmgmt/...` PASS
