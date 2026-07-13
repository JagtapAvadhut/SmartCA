# Architecture

## Overview

Smart CA is a single-page application (SPA). All durable demo state is stored in the browser via a LocalStorage-backed **MockDatabase**. Domain rules live in **services**; pages talk to services (and React Query), not directly to raw LocalStorage keys.

```
Browser UI
  â†’ React Router pages + layout
  â†’ Components / forms / tables
  â†’ Zustand (auth, theme, app chrome, notifications)
  â†’ TanStack Query (async service calls + cache invalidation)
  â†’ Services (CRUD factories, relations, analytics, accounting, reconciliation)
  â†’ Repositories / getCollection()
  â†’ MockDatabase
  â†’ localStorage[`smart-ca-db:<collection>`]
```

## Why this shape

- **UI stays replaceable:** pages depend on service APIs that look like future HTTP clients.
- **Rules are centralized:** invoice paid amounts, outstanding, and journal derivation are not duplicated across every button handler.
- **Seed vs runtime:** `src/mock/*.json` only initializes empty/version-mismatched DBs; runtime mutations never rewrite those files.

## MockDatabase

Location: `src/db/`

Capabilities used by the app:

- insert / update / delete
- archive / restore
- duplicate
- search, filter, sort, pagination
- versioned seed (`DB_VERSION`)

Collections are named via `COLLECTION` in `src/db/seed.ts`.

## Services and relations

Important modules:

| Service | Role |
|---------|------|
| `*Service` CRUD facades | Entity operations |
| `relations.ts` | Payment â†’ invoice status/`paidAmount`/`remainingAmount` â†’ client financials |
| `analyticsService.ts` | Live dashboard & reports |
| `accountingEngine.ts` | System journals from invoices/payments + manual balanced journals |
| `reconciliationService.ts` | Integrity check + repair derived fields |

Money helpers: `src/utils/money.ts`. Multi-entity LocalStorage rollback: `src/utils/transaction.ts`.

## Auth and RBAC

- `AuthService` validates against seeded users (plaintext demo passwords).
- Zustand `smart-ca-auth` holds session.
- `ProtectedRoute` + `ROUTE_PERMISSIONS` gate pages.
- Navigation in `src/constants/navigation.ts` is filtered by permissions.

## Routing

`src/routes/index.tsx` uses React Router with **lazy-loaded** page chunks.

## Future backend integration

Replace repository/collection calls inside services with HTTP. Keep:

- Zod schemas
- page-level React Query keys
- RBAC permission names
- DTO shapes in `src/types`

LocalStorage MockDatabase can remain as an offline/demo adapter behind the same interfaces.

## Dev QA surface

In development, `src/qa/expose.ts` attaches `window.__SMART_CA_QA__` after init so Playwright business tests can call services with exact assertions.
