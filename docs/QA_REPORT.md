# QA report

This document summarizes **verified** automated QA for Smart CA v1.0 Demo Release.
Results were produced by running the projectâ€™s Playwright harnesses against a local Vite server â€” not by estimating from source review.

## Environment

| Item | Value |
|------|--------|
| App | Smart CA (Vite + React) |
| Base URL | `http://localhost:5173` |
| Harnesses | `scripts/qa-verify.mjs`, `scripts/qa-business.mjs` |
| npm scripts | `npm run qa:browser`, `npm run qa:business` |

## Summary

| Suite | Command | PASS | FAIL | Total | Exit |
|-------|---------|------|------|-------|------|
| Browser regression | `npm run qa:browser` | **99** | **0** | 99 | 0 |
| Business logic (exact values) | `npm run qa:business` | **24** | **0** | 24 | 0 |
| Production build | `npm run build` | â€” | â€” | â€” | 0 |

Re-verified during release packaging: business suite **24/24 PASS**; `npm run build` **PASS**.

## Browser suite coverage (`qa-verify.mjs`)

Observed behaviours include:

- Login
- Page loads for Dashboard, Clients, Companies, Employees, Invoices, Payments, Documents, Compliance, GST, ITR, TDS, ROC, Accounting, Calendar, Reports, Settings, AI, Recycle Bin, Tasks, Notes
- Notifications panel
- Dark mode on each listed route + theme persistence after refresh
- Overflow checks at viewports 320â€“1920 (dashboard/clients/settings)
- Client â†’ Invoice â†’ Payment â†’ outstanding movement â†’ payment delete
- Table search / export / column visibility / invoice duplicate
- Document upload + favourite
- Client archive â†’ Recycle Bin â†’ restore
- Accounting tabs; Calendar month/week/day
- Settings branding, create user (+ refresh), create role
- AI send; Dashboard Outstanding navigation
- No critical `pageerror` events

### Bugs found and fixed during browser QA

1. Entity form reset on every parent re-render wiped in-progress values â€” fixed.
2. Input labels lacked `htmlFor`/`id` association â€” fixed.
3. AI Send lacked accessible name â€” fixed.
4. Mobile table/settings scroll containers hardened.

## Business logic suite (`qa-business.mjs`)

PASS requires **exact** expected numeric/status values (not merely â€œchangedâ€).

Highlights:

- Deterministic Client â†’ Invoice â‚¹100,000 â†’ Pay â‚¹30,000 / â‚¹70,000 â†’ delete payments â†’ delete invoice, with exact dashboard deltas
- Reject zero / negative / over-balance payments; duplicate references
- Edit payment recalculates invoice `paidAmount` / `remainingAmount` / `partially_paid`
- Unbalanced journal rejected; Trial Balance Debit = Credit; Assets = Liabilities + Equity
- Integrity repair reduced seeded mismatches (example run: 192 errors â†’ 0)
- Default GST: subtotal 10,000 â†’ CGST 900 + SGST 900 â†’ total 11,800

### Prior â€œsuspicious outstandingâ€ explanation

An earlier UI test used subtotal â‚¹10,000 (GST-inclusive total â‚¹11,800) and payment â‚¹5,000 against a large seeded baseline. Arithmetic matched `baseline + 11800 âˆ’ 5000` and `baseline + 11800` after delete. The suite now asserts exact expected values.

## How to reproduce

```bash
npm run dev
# other terminal:
npm run qa:business
npm run qa:browser
npm run build
```

Raw machine JSON outputs (`qa-results.json`, `business-qa-results.json`) are gitignored. Historical full-text dumps also live under `docs/reports/`.
