# PostgreSQL Migration Blueprint

**Status:** Planning blueprint (not implemented)  
**Audit date:** 2026-07-12  
**Current store:** `internal/repository/memory.Store`  
**Critical blocker:** Services depend on concrete `*memory.Store` — **no repository interfaces yet** (GAP-P4-001)

---

## 1. Goals

1. Persist Smart CA demo/production data in PostgreSQL with durable transactions.  
2. Preserve HTTP API contracts (`/api/v1/...`) so the React frontend needs minimal change.  
3. Keep money correctness (paise internally) and soft-delete / archive semantics.  
4. Enable multi-instance API hosts behind a load balancer (sessions strategy required).  
5. Allow dual-run / cutover from memory seed → PG.

---

## 2. Non-goals (initial migration)

- Full document object storage (S3) — keep metadata in PG first; blobs later.  
- Rewriting the React app.  
- Perfect 3NF of every nested JSON settings blob on day one (JSONB acceptable).  
- Replacing opaque sessions with JWT in the first cut (optional later).

---

## 3. Critical prerequisite: repository ports

### Today

```
Handler → Service(*memory.Store) → memory methods
```

### Target

```
Handler → Service(ports) → memory.Store  OR  postgres.Store
```

### Suggested interfaces (illustrative)

| Port | Responsibility |
|------|----------------|
| `RecordRepository` | Get/List/Create/Update/Archive/Restore/PermanentDelete per collection |
| `TxRunner` | `WithTx(ctx, func(Tx) error)` with real SQL transaction |
| `SessionRepository` | Create/Find/Revoke opaque sessions |
| `SearchRepository` | Optional specialized search (or keep app-level initially) |
| `UnitOfWork` | Multi-aggregate payment/invoice updates |

**Migration cannot be a drop-in PG store** until services accept interfaces. This is the first engineering milestone.

---

## 4. Proposed schema strategy

### 4.1 Hybrid relational + JSONB

| Table style | Use for |
|-------------|---------|
| Strong relational | clients, invoices, payments, users, roles, sessions — money, FKs, indexes |
| JSONB document | settings, organization branding blobs, chat messages, flexible compliance fields |
| Join / enum tables | permissions, role_permissions, user_permissions |

### 4.2 Soft delete

Mirror memory semantics:

```sql
archived BOOLEAN NOT NULL DEFAULT FALSE,
archived_at TIMESTAMPTZ NULL
```

Partial indexes: `WHERE archived = FALSE` for hot lists.

### 4.3 Money

| Layer | Unit |
|-------|------|
| DB columns | `BIGINT` paise (`amount_paise`, `total_paise`, …) |
| API JSON | float/decimal **rupees** (existing contract) |
| Conversion | `money.FromRupees` / `Rupees()` at repository boundary |

Avoid storing floats for money in PostgreSQL.

### 4.4 Identity

Keep string IDs (`CLT-…`, `INV-…`) as primary keys initially for seed compatibility, **or** introduce UUID PK + keep `public_id` unique. String PKs simplify first cutover from seed JSON.

### 4.5 Example core tables (sketch)

```text
users(id, email, username, password_hash, role, status, permissions JSONB, ...)
sessions(id, user_id, token_hash, device, ip, created_at, expires_at, active)
clients(id, name, ..., outstanding_paise, archived, archived_at, data JSONB)
invoices(id, client_id, ..., total_paise, paid_paise, status, archived, ...)
payments(id, invoice_id, client_id, amount_paise, reference, archived, ...)
journals(id, date, narration, source, source_id, created_at)
journal_lines(journal_id, account, debit_paise, credit_paise)
login_history(...), departments(...), branches(...)  -- expose via API when ready
```

---

## 5. Transaction mapping

| Memory today | PostgreSQL target |
|--------------|-------------------|
| `WithTx` deep-clone rollback | `BEGIN` … `COMMIT` / `ROLLBACK` |
| Payment updates invoice + client | Single SQL tx touching 3 tables |
| Demo reset snapshot | `TRUNCATE` + re-seed in tx; or restore from seed schema |

Concurrency: rely on row locks / serializable where financial races matter (payments already have a Go race test against memory).

---

## 6. Sessions & multi-instance

| Option | Pros | Cons |
|--------|------|------|
| A. Sessions table in PG | Simple; sticky-session free | Extra DB hits |
| B. Redis session store | Fast | New dependency |
| C. JWT access tokens | Stateless | Logout/revoke harder |

**Recommendation:** Option A for first PG cut; hash tokens at rest (`token_hash`).

---

## 7. Seed & demo reset

1. Convert `internal/seed/data/*.json` → SQL migrations or `INSERT` loader.  
2. Keep bcrypt hashing at load (never store plaintext).  
3. `POST /demo/reset` becomes: truncate business tables → reload seed → clear sessions (gated by `DEMO_RESET_ENABLED` + `super_admin`).  
4. Integrity checks become SQL FK constraints **plus** residual app-level validators for money invariants.

---

## 8. Phased rollout

| Phase | Work | Exit criteria |
|-------|------|---------------|
| **P0** | Introduce repository interfaces; adapter wraps `*memory.Store` | All services compile against ports; behavior unchanged |
| **P1** | `postgres` adapter for read-only collections (clients list/get) | Feature flag `STORE=memory\|postgres` |
| **P2** | Write path for clients/invoices/payments with SQL txs | Payment service tests pass against PG testcontainer |
| **P3** | Remaining CRUD collections + archive center | Browser QA 112 + business 24 green on PG |
| **P4** | Sessions in PG; remove process memory for auth | Multi-instance smoke |
| **P5** | OpenAPI complete; drop unused seed-only JSON or wire routes | Contract tests |

---

## 9. Configuration additions (proposed)

```env
STORE_BACKEND=memory|postgres
DATABASE_URL=postgres://...
DB_MAX_CONNS=20
DB_MIGRATE=true
```

Keep existing: `SESSION_TTL`, `DEMO_RESET_ENABLED`, `FRONTEND_ORIGIN`.

---

## 10. Testing strategy

| Layer | Approach |
|-------|----------|
| Unit | money + domain validators unchanged |
| Repository | testcontainers PostgreSQL |
| Service | payment concurrency + financial chain against PG |
| HTTP | existing integration tests with PG store wiring |
| E2E | `npm run qa:business` + `qa:browser` against API on PG |

Do **not** mark routes `VERIFIED_E2E` until dedicated proofs exist; reuse 112/24 as demo regression gates.

---

## 11. Risks

| Risk | Mitigation |
|------|------------|
| `Record` map ↔ typed SQL impedance | Start with JSONB `data` column + extracted indexed fields |
| Incomplete OpenAPI | Finish inventory-driven OpenAPI before external consumers |
| Documents duplicate / loginHistory gaps | Fix contract gaps before or during PG (see `SYSTEM_GAP_ANALYSIS.md`) |
| N+1 markAllRead | Add bulk SQL update |
| Large JSON settings | JSONB + partial updates |

---

## 12. Related docs

- `IN_MEMORY_DATABASE_MODEL.md` — current behavior to preserve  
- `GO_BACKEND_INVENTORY.md`  
- `../../SYSTEM_GAP_ANALYSIS.md` — GAP-P4-001  
- `../../API_CONTRACT_GAP_REPORT.md`  
- `../../CRUD_COMPLETENESS_MATRIX.md`
