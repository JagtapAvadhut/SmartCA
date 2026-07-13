# In-Memory Database Model

**Package:** `internal/repository/memory`  
**Entity type:** `models.Record` (`map[string]any`)  
**Audit date:** 2026-07-12  

This document describes the **demo/dev** persistence model used by the Smart CA Go backend. It is not a production database.

---

## 1. Design goals

| Goal | Approach |
|------|----------|
| Frontend field parity | Flexible JSON maps (`Record`) instead of rigid structs |
| Deterministic demos | Embedded seed JSON + integrity validation |
| Safe concurrency | Single `RWMutex`; deep-clone on read |
| Multi-entity writes | `WithTx` full-state snapshot rollback |
| Soft delete / Recycle Bin | `archived` / `archivedAt` flags + archive center APIs |
| Reset demos | `Snapshot` + `Reset` from seed |

---

## 2. Core types

### `models.Record`

```go
type Record map[string]any
```

Helpers: `ID()`, `Clone()`, `GetString`, `GetFloat`, `GetBool`, `Set`.

There are **no** typed Client/Invoice/Payment structs in the domain layer. Services interpret known keys (e.g. `clientId`, `total`, `paidAmount`) at runtime.

### `models.Query` / `PageResult`

List operations support `page`, `pageSize`, `search`, `status`, `sortBy`, `sortDir`, and return paginated clones.

### Runtime auth session (`memory.Session`)

Separate from the seeded `sessions` **collection**:

| Field | Role |
|-------|------|
| ID | `SES-…` |
| UserID | Link to users collection |
| Token | Opaque bearer |
| Device / IP | Audit metadata |
| CreatedAt / ExpiresAt / Active | TTL + revoke |

---

## 3. Store structure

```go
type Store struct {
    mu       sync.RWMutex
    txDepth  int
    data     map[string]map[string]models.Record  // collection → id → record
    order    map[string][]string                  // insertion / list order
    sessions map[string]Session                   // runtime auth (by session id)
}
```

### Concurrency rules

1. **Reads** take `RLock` (unless inside `WithTx`) and return **deep clones**.  
2. **Writes** take exclusive `Lock`.  
3. **`WithTx`** holds the write lock for the whole function; on start it deep-clones `data`, `order`, and `sessions`; on error it restores the snapshot.  
4. Nested store methods see `txDepth > 0` and **do not re-acquire** the mutex (deadlock avoidance).  
5. Only one writer/`WithTx` runs at a time; readers may proceed when no write lock is held.

### Soft delete

- `Archive` / `Delete` (soft): set `archived=true`, `archivedAt=…`  
- Queries exclude archived by default (also treat `status=="archived"`)  
- `Restore` clears flags  
- `PermanentDelete` removes the record  

---

## 4. Collections (28)

| Collection | ID prefix | Typical use |
|------------|-----------|-------------|
| clients | `CLT-` | Practice clients + outstanding |
| companies | `CMP-` | Linked companies |
| employees | `EMP-` | Staff |
| invoices | `INV-` | Billing |
| payments | `PAY-` | Receipts against invoices |
| documents | `DOC-` | Document metadata (no blob store) |
| tasks | `TSK-` | Work items |
| gst / itr / tds / roc / compliance | `GST-` / `ITR-` / `TDS-` / `ROC-` / `CMPL-` | Compliance trackers |
| notifications | `NTF-` | In-app notifications |
| activities | `ACT-` | Activity feed |
| calendar | `CAL-` | Events (HTTP: `/calendar-events`) |
| users | `USR-` | Auth identities + permissions array |
| roles | `ROLE-` | Role definitions |
| permissions | `PERM-` | Permission catalog |
| organization | `ORG-` | Singleton firm profile |
| settings | `SET-` | Singleton app settings |
| auditLogs | `AUD-` | Audit trail |
| loginHistory | `LH-` | Login events (seeded; written on login; **no list API**) |
| chat | `CHAT-` | AI chat sessions |
| departments | `DEPT-` | Seeded only |
| branches | `BR-` | Seeded only |
| notes | `NOTE-` | Sticky notes |
| journals | `JNL-` | Accounting journals |
| sessions | `SES-` | **Seed documentation only** — not Bearer runtime sessions |

---

## 5. Seed model

**Loader:** `internal/seed/seed.go` with `//go:embed data/*.json`

### Load pipeline

1. Parse JSON arrays (chat uses `sessions` array inside file)  
2. `hashUserPasswords` — bcrypt cost 10; **delete** plaintext `password`  
3. Append deterministic `notes` (2)  
4. Ensure `journals` slice exists (empty)  
5. `store.Reset(seed)`  
6. `ValidateIntegrity` — FK-like checks across invoices/payments/companies/compliance/docs/tasks/users/notes  

### Integrity rules (high level)

- Invoices reference existing `clientId` / `createdBy`  
- Payments reference `invoiceId` / `clientId`  
- Companies / compliance modules / documents / tasks reference `clientId`  
- Users must not retain plaintext password without hash  
- Notes must have `id`  
- Collects **all** issues before failing  

### Seed counts

See `GO_BACKEND_INVENTORY.md` §6 (clients 120, companies 60, employees 25, invoices 150, payments 120, …).

Demo user passwords: see seed / local demo docs (not repeated here).

### Unused embedded JSON

Present under `seed/data/` but **not** mapped in `collectionFiles`:  
`activityLogs`, `cities`, `countries`, `states`, `menu`, `modules`, `sidebar`, `preferences`, `theme`, `reports`, `dashboard`.

---

## 6. Money in the store

- Records store monetary fields as **JSON numbers in rupees** (frontend parity).  
- Services convert to `money.Paise` for arithmetic, then write rupees back.  
- Invoice tax: `ComputeInvoiceTax` (18%, CGST/SGST or IGST).  
- Payment create/update/delete recalculates invoice `paidAmount`, `remainingAmount`, status, and client outstanding **inside `WithTx`**.

---

## 7. Transactional patterns

| Flow | Uses `WithTx`? | Why |
|------|:--------------:|-----|
| Payment create/update/delete/archive | Yes | Multi-record financial consistency |
| Invoice create/update affecting client | Yes | Outstanding sync |
| Generic CRUD single record | No | Single collection write under Lock |
| Demo reset | Snapshot + `Reset` | Restore deterministic seed; clears auth sessions |

`WithTx` is **process-local** snapshot rollback — not WAL, not MVCC, not durable.

---

## 8. Limits of this model

| Limit | Implication |
|-------|-------------|
| Process memory only | Restart loses unseeded mutations unless re-seeded |
| Single-node | No horizontal scale; one writer at a time for tx |
| Full snapshot rollback | Large heaps make `WithTx` expensive under huge datasets |
| Map entities | Weak compile-time safety; typos in keys are runtime bugs |
| No SQL | Reporting/search are Go loops over collections |
| Seeded ≠ exposed | loginHistory / departments / branches lack HTTP |

For production persistence, see `POSTGRESQL_MIGRATION_BLUEPRINT.md`.

---

## 9. Related docs

- `GO_BACKEND_INVENTORY.md`
- `POSTGRESQL_MIGRATION_BLUEPRINT.md`
- `../../SYSTEM_GAP_ANALYSIS.md` (GAP-P4 repository interfaces)
