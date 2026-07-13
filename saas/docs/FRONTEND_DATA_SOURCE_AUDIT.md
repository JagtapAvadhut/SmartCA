# Frontend Data Source Audit

**Scope:** `D:\SmartCA\saas\src`  
**Audit date:** 2026-07-12  
**Verdict:** Business data is **API-bound** via `httpClient` → Go REST. There is **no** `FRONTEND_DATA_SOURCE` / `VITE_USE_MOCK` toggle.

---

## 1. Executive summary

| Question | Answer |
|----------|--------|
| Do services use MockDatabase? | **No** |
| Does `getCollection` work? | **No — always throws** |
| Is LocalStorage the business DB? | **No** (UI prefs / token / drafts / undo / integrity audit only) |
| Effective mode | **Always live API** when Go backend is up |
| Overall posture | **FULLY_API_BOUND** for CRUD domains; a few **PARTIALLY_API_BOUND** demo features |

---

## 2. Transport layers

### Production path

```
Page / store → *Service / createCrudService → httpClient.fetch → Go /api/v1
```

### Explicit policy (`api.ts`)

Business data goes through the Go REST API via `httpClient` — never MockDatabase.

### Dead path

```
getCollection / MockDatabase / smart-ca-db:*  →  disabled / unused
```

---

## 3. `getCollection` / seed helpers

**File:** `src/db/seed.ts`

| Helper | Behavior |
|--------|----------|
| `getCollection(name)` | `throw new Error('getCollection(...) is disabled — use the Go REST API...')` return type `never` |
| `initDatabase()` | No-op |
| `resetDatabase()` | **Throws** — instructs caller to use `POST /api/v1/demo/reset` |

`COLLECTION` constants remain for undo/collection keys only — not for reads.

---

## 4. Settings Reset Database (verified)

| Call site | Behavior |
|-----------|----------|
| `SettingsPage.tsx` Reset button | Dynamic import `http` → **`await http.post('/demo/reset')`** → reload |
| `qa/expose.ts` | `resetDatabase: async () => http.post('/demo/reset')` |
| `db/seed.ts` `resetDatabase()` | Still **throws** if called directly |

**Code verification:** the Settings UI uses the correct API. Residual footgun: exported throw helper in `seed.ts` (see `SYSTEM_GAP_ANALYSIS.md` GAP-P1-001).

---

## 5. Service transport table

| Service | httpClient | MockDatabase | Notes |
|---------|:----------:|:------------:|-------|
| Client / Invoice / Payment / Document / Employee / Task / Note / Company | Yes | No | CRUD factory |
| Compliance (+ GST/ITR/TDS/ROC) | Yes | No | |
| AuthService | Yes | No | |
| SettingsService | Yes* | No | `*getLoginHistory` returns `[]` — no HTTP |
| Dashboard / Report / Search | Yes | No | Search also has local nav hits |
| NotificationService | Yes | No | `markAllRead` = N+1 PATCH |
| ChatService | Yes | No | Canned assistant text then PATCH |
| Calendar / Activity | Yes | No | |
| ArchiveService | Yes | No | |
| accountingEngine | Yes | No | I/O via `/accounting/*` |
| analyticsService | Yes | No | |
| reconciliationService | Yes + localStorage meta | No | Integrity audit log only in LS |
| relations.ts | No | No | Intentional no-ops |

Repositories: HTTP-only via `BaseRepository`.

---

## 6. localStorage classification

| Key / pattern | Class | Notes |
|---------------|-------|-------|
| `smart-ca-token` | BROWSER_OWNED | Bearer for API |
| `smart-ca-auth` | BROWSER_OWNED | Zustand auth persist |
| `smart-ca-theme` | BROWSER_OWNED | Theme / language |
| `smart-ca-app` | BROWSER_OWNED | Sidebar collapsed |
| `smart-ca-draft:*` | BROWSER_OWNED | Form drafts |
| `smart-ca-undo-stack` | BROWSER_OWNED | Undo toast stack (restore hits API) |
| `smart-ca-integrity-audit` | BROWSER_OWNED (meta) | Integrity run history — not entities |
| `smart-ca-db:*` | FORBIDDEN business | Engine exists; **not written** by production path |

**sessionStorage:** no usage in `src/`.

---

## 7. Gap bindings (data-source relevant)

| Gap | Evidence | Impact |
|-----|----------|--------|
| Login history empty | `SettingsService.getLoginHistory` → `[]`; no `/login-history` route | UI cannot show seeded loginHistory |
| Document duplicate | Frontend `POST /documents/:id/duplicate`; backend `AllowDuplicate=false` → 400 | Duplicate action broken |
| markAllRead N+1 | `getUnread` then `Promise.all` of PATCH per id | Extra latency under many unread |
| Recycle Bin copy | Page description says LocalStorage | Misleading; code uses Archive API |
| AI canned replies | Hardcoded assistant string in `ChatService.sendMessage` | Demo OK |
| Document mock preview | `generateMockPreview()` client-side | Demo OK |

---

## 8. Domain status summary

| Domain | Status |
|--------|--------|
| Auth, Clients, Companies, Employees, Invoices, Payments, Tasks, Notes, Calendar, Compliance (+subs), Archive, Dashboard, Reports, Accounting I/O, Notifications, Settings org/users/roles, Activities | **FULLY_API_BOUND** |
| Documents (preview), AI (reply text), Search (nav), Settings appearance, integrity audit log, invoice tax prep client-side | **PARTIALLY_API_BOUND** |
| 404 / Unauthorized, theme chrome | **FRONTEND_ONLY** |
| MockDatabase business DB | **Not on production path** |

---

## 9. Stale documentation warning

These files may still describe LocalStorage MockDatabase as the runtime store and should not be treated as current truth without re-verification:

- `docs/ARCHITECTURE.md`
- `docs/DEMO_GUIDE.md`
- `docs/KNOWN_LIMITATIONS.md`
- `docs/reports/*` (historical dumps)

Prefer this audit, `REACT_FRONTEND_INVENTORY.md`, and `saas/README.md`.

---

## 10. Related QA evidence

Browser QA **112/112** and business QA **24/24** against live Go API (`qa-results.json`, `business-qa-results.json`, 2026-07-12) confirm the API-bound path works for covered flows. That evidence is **demo-level**, not a claim that every service method was individually verified.
