# Changelog

## 1.0.0 — GA (2026-07-21)

### Added
- PostgreSQL persistence (entity BASE TABLES, migrations `001`–`003`)
- Gemini AI via Go (`/api/v1/ai/*`) — key never sent to React
- `POST /api/v1/invoices/repair-financials` integrity repair
- Dashboard birthdays this month from employees
- GA multi-role UAT harness (`Go/scripts/ga_uat.go`)
- Client/company/employee/task/note/role create validation

### Fixed
- Invoice paidAmount vs payment sum seed corruption
- ITR/TDS/ROC NaN tax display
- CA role missing invoices/payments permissions
- Empty client create returning 201
- Demo banner incorrectly claiming in-memory / simulated AI

### Verified (fresh GA gate)
- API e2e 70/70, matrix 58/58, GA UAT 58/58
- Playwright auth/pages/business/clean/UI audits green
- SQL orphans 0, pay mismatches 0

See [docs/reports/GA_FINAL_REPORT.md](./docs/reports/GA_FINAL_REPORT.md).
