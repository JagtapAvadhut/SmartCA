# PRACTICE UAT REPORT — ABC Professional Services LLP

**Product under evaluation:** SmartCA (local purchase UAT)  
**Firm:** ABC Professional Services LLP  
**Dates:** 27 July 2026  
**Environments used:** API `http://127.0.0.1:8080`, Vite `http://127.0.0.1:5173`, Postgres `smartca`  
**Password (all ABC users):** `SmartCA@2025`  
**Evidence:** `saas/qa-artifacts/abc-uat/` (screenshots + `results.json`)  
**Seeder:** `Go/cmd/abcfirmseed`  

> **Explicit statement:** No application / product code was fixed in this UAT. Problems below were **proven by using the product** (API + browser). Seed data for firm setup is allowed and was used. Findings are for the product team.

---

## 1. Firm setup summary

We stood up **ABC Professional Services LLP** as a realistic mid-size practice for purchase evaluation.

| Item | Result |
|------|--------|
| Users | **50** (`ABC-*` / `@abc.smartca.in`) |
| Clients | **100** |
| Companies | **475** (1–10 per client; entity types include Pvt Ltd, LLP, Partnership, Proprietorship, Trust, NGO, Individual) |
| Engagements | **200** (GST, TDS, ITR, ROC, Accounting, Payroll, Audit, Incorporation, Compliance, Notices, Appeals) |
| Works | **900** (~6 months of mixed statuses) |
| Intakes | **40** |
| Child ops (notes/calls/emails/meetings/follow-ups/comments/attachments/activity) | **~8,300** |
| WM / PRACTICE seeds | **Untouched** (377 WM users, 57 PRACTICE users still present) |

### Headcount (exactly 50)

| Role | Count | Notes |
|------|------:|-------|
| Managing Partner | 1 | Vikram Malhotra |
| Equity Partners | 2 | Sign-off lane under MP |
| Practice Manager | 1 | Neha Banerjee |
| HR Manager | 1 | Priya Chauhan |
| Reception | 1 | Fatima Qureshi (intake) |
| Chartered Accountants | 5 | |
| Team Leaders | 8 | |
| Employees | 31 | **Trimmed from requested 35** so firm stays at 50 **including** reception |

**Hierarchy (verified in DB):** Employee → one TL → one CA → Practice Manager → Managing Partner. Partners report to Managing Partner for sign-off (not in the day-to-day delivery chain).

### Key login emails

| Role | Email |
|------|-------|
| Managing Partner | `managing.partner@abc.smartca.in` |
| Partner | `partner1@abc.smartca.in`, `partner2@abc.smartca.in` |
| Practice Manager | `practice.manager@abc.smartca.in` |
| CA | `ca1@abc.smartca.in` … `ca5@abc.smartca.in` |
| Team Leader | `tl1@abc.smartca.in` … `tl8@abc.smartca.in` |
| Employee | `emp1@abc.smartca.in` … `emp31@abc.smartca.in` |
| HR | `hr@abc.smartca.in` |
| Reception | `reception@abc.smartca.in` |

**Run seeder again (idempotent wipe of ABC only):**

```bash
cd Go && go run ./cmd/abcfirmseed
```

**UAT script (API + Playwright screenshots):**

```bash
cd saas && set QA_BASE=http://127.0.0.1:5173&& set QA_API=http://127.0.0.1:8080/api/v1&& node scripts/qa-abc-uat.mjs
```

**UAT result snapshot:** 117 PASS / 1 FAIL (HR list correctly 403) — treated as business evidence, not a product “fix” pass/fail.

---

## 2. Things users loved

1. **Login is fast** (API ~70–220 ms). Partners will not abandon at the password screen.
2. **Intake desk is real.** Reception (`reception@abc.smartca.in`) created a walk-in; Practice Manager approved into client/company/engagement. This matches how clients actually arrive at a CA office.
3. **HR cannot run delivery.** Create/assign work returns 403; Work UI shows Access Denied for Priya (HR). Separation of duties holds — we would not buy a tool that lets HR reassign GST filings.
4. **Reassignment works.** Practice Manager reassigned a live work to another employee in one API call — critical when staff is on leave.
5. **Day-to-day logging works.** Note, call, email, meeting, follow-up all succeeded on a newly created work. This is the paperless diary we want.
6. **TL → CA verify chain works.** TL verify then CA verify succeeded on a seeded `READY_FOR_*` matter. The review idea is sound.
7. **Ownership column exists** (CA / TL / Assignee). Conceptually correct for a CA firm — we think in triad ownership, not a single “assignee.”
8. **Status language exists** beyond Todo/Doing (Document Pending, Ready for TL/CA verify, Awaiting Close). That is how we run files.
9. **Employee create is blocked** (403). Juniors cannot invent firm-wide matters.
10. **List/dashboard API latency is good** when scoped (often &lt;50 ms). Speed is not the main complaint — clarity and tenancy are.

---

## 3. Things users hated

1. **No firm isolation.** Managing Partner / Practice Manager work list total ≈ **6,583** — demo WM + PRACTICE + ABC mixed. We refuse to operate our LLP inside someone else’s queue.
2. **Dashboard is not “our firm.”** Manager dashboard showed **5,607 pending**, **2,399 overdue**, dept totals in the thousands — clearly multi-tenant demo bleed, not ABC’s book.
3. **Ownership shows IDs** (`ABC-CA-01`, `ABC-TL-01`) instead of names. Staff do not speak in seed codes.
4. **Status badges truncate and confuse** (“READY FOR GST MON…”, “DOCUMEN… GST MON”). Overlay/work-type appears fused into status — partners cannot read the board at a glance.
5. **XSS / junk titles visible** in the All Work list (`&lt;script&gt;alert…`). Even if from prior QA, a purchase UAT environment showing this destroys trust.
6. **“Team” is not a team.** `/work/team` is a **Create user** form (“Team Provisioning”), not an org chart, capacity view, or Emp→TL→CA tree. We cannot staff from this screen.
7. **Partner sign-off UX is unclear.** Wrong close paths 404’d in our first attempts; real close is a single `/close` — there is no obvious **Partner Sign-off** vs **Manager Close** button language for high-risk matters.
8. **Browser login felt slow** (~5.4 s first Managing Partner session). API is fine; the SPA login path feels heavy for Monday morning.
9. **Clicking a work row often lands on Board**, not a proper file detail. Opening a client file should feel like opening a dossier.
10. **Dev banner always on** (“PostgreSQL… Gemini…”). Looks unfinished for a paying CA firm.
11. **Duplicate search boxes** on All Work (“Search work…” and another “Search…”). Noise.
12. **Reception has total=0 on work list** while intake works — front desk cannot see “what did we convert today?” without hunting.
13. **Employee vs TL counts nearly identical** (112 vs 113). Either employees see the whole TL desk or scoping is wrong — both are bad for accountability.
14. **Kanban columns feel too coarse** (Todo / Doing / Verification / Done) vs our real gates (Doc Pending → TL → CA → Manager Close). Board and list speak different dialects.
15. **Pagination copy** (“200 results · Page 1 of 20”) while API total is thousands — partners do not know which number to trust.

---

## 4. Missing workflows

| # | Missing workflow | Why it matters |
|---|------------------|----------------|
| 1 | Firm / practice tenancy switch or hard isolation | Multi-firm DB is unusable for purchase |
| 2 | Period close pack (GSTR-1/3B month lock, ITR AY lock) | Filing seasons are period-driven |
| 3 | Document request → client portal chase → mark received | 90% of GST delay is docs |
| 4 | Notice / appeal tracker with due dates & hearing diary | High risk, partner-visible |
| 5 | Partner sign-off queue (matters flagged `requires_partner_signoff`) | SoD for audit / high-risk |
| 6 | Leave cover / temporary reassignment wizard | Every April–July |
| 7 | Billing link: engagement → WIP hours → invoice | We will not run Ops without money |
| 8 | Client-group rollup (100 clients / 475 companies) | Family groups & holding structures |
| 9 | Capacity planning (works per TL/Emp vs due dates) | Prevent silent overload |
| 10 | Reopen with reason + partner visibility | Closed files reopen after notices |
| 11 | Bulk period generation (all GST clients × month) | Manual create does not scale |
| 12 | Checklist templates by work type (GSTR3B, AOC-4, Tax Audit) | Quality without reinventing |
| 13 | Escalation when stuck in DOCUMENT_PENDING &gt; N days | Managers need exception lists |
| 14 | Reception “today’s walk-ins → conversion” report | Front desk KPI |
| 15 | HR placement → reports-to assignment without delivery rights | HR’s real job in this product |

---

## 5. Confusing UI

- Status vs overlay vs work type mashed into one badge.
- Ownership IDs instead of people.
- Team page = user create form (wrong mental model).
- Two Work “Dashboard” entries (sidebar + in-module) plus global Dashboard.
- Board columns do not match Practice Core subtitle (“TL → CA → Manager Close”).
- All Work shows demo XSS titles next to real ABC clients — looks compromised.
- Filter row clutter (status / priority / department / dual search / columns / export).
- Intake cards are tall and repetitive; hard to scan 40+ walk-ins.
- Mobile list opens but remains dense-table oriented — site-visit unfriendly.
- Green engineering banner competes with real work.

---

## 6. Missing / uneven permissions

| Observation | Verdict |
|-------------|---------|
| HR cannot create/assign work (403) + Access Denied UI | **Good — keep** |
| Employee cannot create work | **Good — keep** |
| Reception can intake; cannot usefully see converted work | **Gap** |
| Partner / MP see entire multi-seed universe | **Critical gap (tenancy)** |
| No distinct Partner Sign-off permission surface in UI | **Gap** |
| HR still has Clients/Companies in sidebar shell | **Confusing — HR needs people tools, not client master by default** |
| TL/Emp got 403 on some intake API calls while UI still opens Intake | **Inconsistent shell vs API** |

---

## 7. Workflow bottlenecks

1. **Doc Pending swamp** — without chase automation, board fills and nobody knows who owns the client call.
2. **Verify queues** — TL/CA verify works in API, but UI does not scream “your queue (12)” the way Outlook does for partners.
3. **Close path discoverability** — close exists (`POST /work/items/{id}/close`) but partner vs manager language is weak; first UAT attempts hit 404 on guessed partner routes.
4. **No firm filter** — every leadership review starts by drowning in 6k+ rows.
5. **Staffing** — cannot see who is free; Team page only creates users.
6. **Period work creation** — creating one GSTR-3B at a time will never survive a 100-client GST portfolio.
7. **Detail navigation** — file open often fails to feel like a dossier (row click → board). Extra clicks kill adoption.

---

## 8. Performance observations

| Path | Observation |
|------|-------------|
| API login | Excellent (~70–220 ms) |
| API list/dashboard | Excellent when called (often &lt;50 ms; TL list spike ~152 ms still OK) |
| Browser login (first MP) | **~5.4 s** — feels broken despite fast API |
| UI page navigations | ~0.7–1.1 s each — acceptable but not “instant” |
| Leadership list of 6.5k | Fast bytes, **slow cognition** — performance problem is information architecture |
| Board with huge columns | Scroll fatigue; needs WIP limits / swimlanes by CA |

API speed is a strength. Product clarity is the bottleneck.

---

## 9. Recommended improvements (executive)

1. **Hard tenancy:** ABC users see only ABC data. Non-negotiable for purchase.
2. **People, not IDs** everywhere (CA/TL/Assignee names + avatar).
3. **Rewrite Team** into hierarchy + capacity; move “Create user” to Admin/HR.
4. **Align Board columns** to Practice Core statuses (or map them explicitly).
5. **Partner Sign-off queue** with clear buttons and audit trail.
6. **Document chase workflow** tied to DOCUMENT_PENDING.
7. **Period generators** for GST/TDS/Payroll.
8. **Remove QA junk / XSS titles** from any shared demo DB before customer UAT.
9. **Kill the engineering banner** in customer builds.
10. **One-click open dossier** from list/board/calendar.

---

## 10. Top 100 enhancements (prioritized)

### P0 — Must fix before we would buy / pilot with live clients (1–35)

1. **P0** Enforce firm/tenant isolation so ABC never sees WM/PRACTICE rows.  
2. **P0** Scope dashboards to the signed-in firm only.  
3. **P0** Show person names (not `ABC-CA-01`) in ownership columns.  
4. **P0** Fix status badge truncation; separate status vs overlay vs work type.  
5. **P0** Sanitize/forbid script-like titles in UI (XSS hygiene).  
6. **P0** One-click open Work Detail dossier from list row.  
7. **P0** Align Kanban columns to TL → CA → Manager Close gates.  
8. **P0** Partner Sign-off queue for `requires_partner_signoff`.  
9. **P0** Clear Manager Close vs Partner Close actions in UI.  
10. **P0** Document request + reminder workflow for DOCUMENT_PENDING.  
11. **P0** “My verify queue” badge for TL and CA.  
12. **P0** Exception list: overdue + blocked + doc-pending &gt; N days.  
13. **P0** Bulk create GST period works for selected clients/companies.  
14. **P0** Checklist templates per work type before TL verify.  
15. **P0** Replace Team Provisioning-as-home with org hierarchy view.  
16. **P0** Capacity strip: open works / overdue per Emp and TL.  
17. **P0** Leave-cover reassignment wizard (multi-select works).  
18. **P0** Client group / family rollup across companies.  
19. **P0** Engagement retainer calendar (what is in-scope this FY).  
20. **P0** Notice & appeal matter type with hearing date field.  
21. **P0** Remove engineering “Gemini/PostgreSQL” banner from customer UI.  
22. **P0** Fix duplicate search inputs on All Work.  
23. **P0** Honest pagination (total count matches API total).  
24. **P0** Reception “converted today” view after intake approve.  
25. **P0** Tighten employee list scope to **assignee = me** only.  
26. **P0** Ensure TL scope = team downline, not peer noise.  
27. **P0** CA scope default = my portfolio (owner_ca), with optional firm view for PM.  
28. **P0** Hide Work Create from roles that API-forbid it (consistent shell).  
29. **P0** Intake approve UX: pick client/company/CA by name search, not raw IDs.  
30. **P0** Soft-delete/archive hygiene so junk QA works do not pollute partner views.  
31. **P0** Audit trail visible on detail (“who verified / who closed”).  
32. **P0** Mandatory remarks on reopen.  
33. **P0** Period key uniqueness errors shown in plain Hindi/English business language.  
34. **P0** Mobile-readable work cards for managers on client visits.  
35. **P0** Export CSV that matches **filtered** firm view (not whole DB).  

### P1 — Needed for serious practice rollout (36–75)

36. **P1** WIP hours on work → weekly timesheet.  
37. **P1** Engagement → invoice draft bridge.  
38. **P1** Fee estimate vs actual hours variance.  
39. **P1** Client portal link for document upload.  
40. **P1** WhatsApp/email chase templates from follow-up.  
41. **P1** Call log → next follow-up one click.  
42. **P1** Meeting notes → action items assigned.  
43. **P1** Email log with multiple To/Cc validation already partially there — surface in UI clearly.  
44. **P1** Attachment virus/size policy messaging.  
45. **P1** FY / AY filter sticky across list/board/calendar.  
46. **P1** Department swimlanes on board.  
47. **P1** Risk flag visual (high-risk border) on cards.  
48. **P1** Partner dashboard: only high-risk + awaiting sign-off.  
49. **P1** Practice Manager dashboard: bottlenecks by CA.  
50. **P1** TL dashboard: team SLA aging.  
51. **P1** Employee “my day” (due today + follow-ups).  
52. **P1** Calendar shows follow-ups and due dates together.  
53. **P1** Timeline that is actually a file history, not a gimmick.  
54. **P1** Saved filters (“My GST Doc Pending”).  
55. **P1** Column chooser defaults sane for CA vs Emp.  
56. **P1** Keyboard shortcuts for verify pass/fail.  
57. **P1** Bulk status transition with SoD checks.  
58. **P1** Checklist fail requires remarks (enforce in UI).  
59. **P1** Template library: ROC AOC-4, Tax Audit, TDS Q, GSTR-3B.  
60. **P1** Auto-spawn next month GST work on close of prior period.  
61. **P1** Company entity-type drives allowed work types.  
62. **P1** Individual clients default to ITR/TDS, not ROC.  
63. **P1** Trust/NGO compliance packs.  
64. **P1** Incorporation checklist pack.  
65. **P1** Payroll month pack (ESI/PF/PT).  
66. **P1** Accounting WIP (MIS) separate from compliance filings.  
67. **P1** Delegated close visibility when manager delegates.  
68. **P1** Notifications that name the client, not only work id.  
69. **P1** Digest email 8:00 AM IST for queues.  
70. **P1** In-app notification preferences by role.  
71. **P1** HR module: joiners with PENDING_PLACEMENT → place under TL.  
72. **P1** HR cannot see client financial docs (confirm data ACLs).  
73. **P1** Reception role home = Intake first, not empty All Work.  
74. **P1** Global Cmd+K results scoped to firm + role.  
75. **P1** Reduce SPA login time to &lt;2 s on warm cache.  

### P2 — Differentiation / polish (76–100)

76. **P2** Dark mode that preserves status colour meaning.  
77. **P2** Partner iPad review mode (large approve/reject).  
78. **P2** Multilingual UI (EN/HI) for staff.  
79. **P2** IST-first date pickers everywhere.  
80. **P2** PAN/GSTIN validation on client/company.  
81. **P2** DIN/DSC expiry reminders for ROC.  
82. **P2** DSC inventory register.  
83. **P2** Bank audit confirmation tracker.  
84. **P2** UDIN logging hook for attestations.  
85. **P2** Peer review pack export.  
86. **P2** Conflict check when onboarding related parties.  
87. **P2** Independence flags for audit clients.  
88. **P2** Matter profitability heat map.  
89. **P2** Client NPS / feedback after delivery.  
90. **P2** SLA policies configurable per engagement.  
91. **P2** Board WIP limits per column.  
92. **P2** Drag-and-drop assign with hierarchy validation.  
93. **P2** Smart suggestions: next owner based on last period.  
94. **P2** Duplicate work detector (same company+period+type).  
95. **P2** Offline-friendly mobile for call notes.  
96. **P2** Printable working-paper pack PDF.  
97. **P2** Watermark exports with firm name.  
98. **P2** Training sandbox separate from ABC production tenant.  
99. **P2** In-product guided tour for TL verify / CA verify.  
100. **P2** Quarterly “practice health” score for Managing Partner.  

---

## 11. Role-by-role verdict (purchase lens)

| Role | Would they use it daily? | Notes |
|------|--------------------------|-------|
| Managing Partner | **Not yet** | Drowns in 6k+ cross-firm works; no clean sign-off queue |
| Partner | **Not yet** | Same isolation issue; sign-off UX unclear |
| Practice Manager | **Almost** | Create/assign/children/intake approve work; needs firm scope + staffing |
| CA | **Promising** | Verify works; portfolio size OK if names/filters improve |
| Team Leader | **Promising** | Verify gate real; board must match statuses |
| Employee | **Caution** | Scope may be too wide vs personal desk |
| HR | **Correctly limited** | Access Denied on Work — good; needs people home instead |
| Reception | **Yes for intake** | Intake desk is the star; needs conversion follow-through |

---

## 12. Evidence index

| Artifact | Path |
|----------|------|
| Seeder | `Go/cmd/abcfirmseed/` (`main.go`, `roster.go`) |
| UAT script | `saas/scripts/qa-abc-uat.mjs` |
| Screenshots + results | `saas/qa-artifacts/abc-uat/` |
| This report | `PRACTICE_UAT_REPORT.md` |

Representative screenshots reviewed: `pm_work.png`, `pm_work_dashboard.png`, `pm_work_board.png`, `pm_work_team.png`, `reception_intake.png`, `hr_work.png` / `hr_work_attempt.png`, plus full role matrix (`mp_*`, `partner_*`, `ca_*`, `tl_*`, `emp_*`, `reception_*`, `mobile_pm_work.png`).

---

## 13. Closing statement (ABC Professional Services LLP)

SmartCA’s **Practice Core idea is directionally right**: intake → ownership triad → TL/CA verify → manager close, with notes/calls/emails that match how a CA office actually works. HR SoD is respected. API speed is good.

We **cannot pilot live client data** until **firm isolation**, **human-readable ownership**, **status clarity**, **real team/capacity views**, and **partner sign-off / document-chase workflows** are productized. The gaps above are business blockers proven in UAT — not theoretical engineering notes.

**No product code was fixed in this engagement.** Seeded firm data + manual/API/Playwright UAT only.

— ABC Professional Services LLP (Purchase UAT)
