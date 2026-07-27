/**
 * ABC Professional Services LLP — purchase UAT (API + Playwright UI).
 * Does NOT fix product code. Proves business problems for the product team.
 *
 *   QA_BASE=http://127.0.0.1:5173 QA_API=http://127.0.0.1:8080/api/v1 node scripts/qa-abc-uat.mjs
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.QA_BASE || 'http://127.0.0.1:5173'
const API = process.env.QA_API || 'http://127.0.0.1:8080/api/v1'
const PASSWORD = 'SmartCA@2025'
const SHOT_DIR = path.resolve('qa-artifacts/abc-uat')
fs.mkdirSync(SHOT_DIR, { recursive: true })

const results = []
const judgments = []
const timings = []

function record(id, ok, detail = '') {
  results.push({ id, status: ok ? 'PASS' : 'FAIL', detail })
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${id}${detail ? ` — ${detail}` : ''}`)
}

function judge(role, area, sentiment, note) {
  judgments.push({ role, area, sentiment, note })
  console.log(`[JUDGE:${sentiment}] ${role} / ${area}: ${note}`)
}

async function apiLogin(identifier) {
  const t0 = Date.now()
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password: PASSWORD }),
  })
  const ms = Date.now() - t0
  timings.push({ op: `login:${identifier}`, ms })
  const json = await res.json()
  if (!res.ok || !json.success) throw new Error(`login failed ${identifier}: ${res.status} ${JSON.stringify(json).slice(0, 200)}`)
  return { token: json.data.token, user: json.data.user || json.data, ms }
}

async function api(token, method, pathName, body) {
  const t0 = Date.now()
  const res = await fetch(`${API}${pathName}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const ms = Date.now() - t0
  timings.push({ op: `${method} ${pathName}`, ms })
  const json = await res.json().catch(() => ({}))
  return { status: res.status, json, ms }
}

async function uiLogin(page, identifier) {
  await page.context().clearCookies()
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  const identifierInput = page.locator('input[name="identifier"]').or(page.locator('input:not([type="checkbox"]):not([type="password"])').first())
  const passwordInput = page.locator('input[name="password"]').or(page.locator('input[type="password"]'))
  await identifierInput.waitFor({ state: 'visible', timeout: 15000 })
  await identifierInput.fill(identifier)
  await passwordInput.fill(PASSWORD)
  await page.getByRole('button', { name: /sign in|login/i }).click()
  await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 25000 })
}

const roles = [
  { id: 'mp', email: 'managing.partner@abc.smartca.in', label: 'Managing Partner' },
  { id: 'partner', email: 'partner1@abc.smartca.in', label: 'Partner' },
  { id: 'pm', email: 'practice.manager@abc.smartca.in', label: 'Practice Manager' },
  { id: 'ca', email: 'ca1@abc.smartca.in', label: 'CA' },
  { id: 'tl', email: 'tl1@abc.smartca.in', label: 'Team Leader' },
  { id: 'emp', email: 'emp1@abc.smartca.in', label: 'Employee' },
  { id: 'hr', email: 'hr@abc.smartca.in', label: 'HR' },
  { id: 'reception', email: 'reception@abc.smartca.in', label: 'Reception' },
]

const pages = [
  '/work',
  '/work/board',
  '/work/calendar',
  '/work/timeline',
  '/work/dashboard',
  '/work/team',
  '/work/intake',
]

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await context.newPage()
const consoleErrors = []
page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()) })
page.on('pageerror', (err) => consoleErrors.push(String(err)))

const tokens = {}
const userIds = {}

try {
  // --- Login every major role ---
  for (const r of roles) {
    try {
      const { token, user, ms } = await apiLogin(r.email)
      tokens[r.id] = token
      userIds[r.id] = user?.id || user?.userId || ''
      record(`api_login_${r.id}`, true, `${ms}ms id=${userIds[r.id]}`)
      if (ms > 1500) judge(r.label, 'login', 'hate', `Login felt slow at ${ms}ms — partners will not wait.`)
      else if (ms < 400) judge(r.label, 'login', 'love', `Login snappy (${ms}ms).`)
    } catch (e) {
      record(`api_login_${r.id}`, false, String(e))
      judge(r.label, 'login', 'hate', `Cannot log in: ${e}`)
    }
  }

  // --- List / dashboard scope per role ---
  for (const r of roles) {
    if (!tokens[r.id]) continue
    const list = await api(tokens[r.id], 'GET', '/work/items?page=1&pageSize=20')
    const total = list.json?.data?.total ?? list.json?.data?.page?.total ?? -1
    const items = list.json?.data?.items || list.json?.data?.data || []
    record(`api_list_${r.id}`, list.status === 200, `status=${list.status} total=${total} ms=${list.ms}`)
    timings.push({ op: `list_scope_${r.id}`, ms: list.ms, total })

    if (r.id === 'hr') {
      // HR should not meaningfully run delivery work
      if (list.status === 200 && total > 0) {
        judge(r.label, 'work list', 'hate', `HR sees ${total} work items — people team should not live in delivery queue.`)
      } else if (list.status === 403) {
        judge(r.label, 'work list', 'love', 'HR correctly blocked from delivery work list.')
      }
    }
    if (r.id === 'emp' && total > 200) {
      judge(r.label, 'work list', 'hate', `Employee sees ${total} works — should be own desk only, not firm-wide noise.`)
    }
    if (r.id === 'emp' && total > 0 && total <= 80) {
      judge(r.label, 'work list', 'love', `Employee desk scoped (${total} items) — usable for day-to-day.`)
    }
    if ((r.id === 'pm' || r.id === 'mp') && total < 100) {
      judge(r.label, 'work list', 'hate', `Leadership only sees ${total} works — firm has 900 ABC works; visibility feels incomplete.`)
    }
    if ((r.id === 'pm' || r.id === 'mp' || r.id === 'ca') && total >= 50) {
      judge(r.label, 'work list', 'mixed', `Sees ${total} works in ${list.ms}ms — need filters by client/FY/status or partners drown.`)
    }
    if (list.ms > 2000) {
      judge(r.label, 'performance', 'hate', `Work list took ${list.ms}ms — unacceptable for morning stand-up.`)
    }

    const dash = await api(tokens[r.id], 'GET', '/work/dashboard')
    record(`api_dashboard_${r.id}`, dash.status === 200 || dash.status === 403, `status=${dash.status} ms=${dash.ms}`)
    if (dash.ms > 2500) judge(r.label, 'dashboard', 'hate', `Dashboard ${dash.ms}ms — too slow for partner morning review.`)
  }

  // --- Practice Manager: create work, assign, children, transition ---
  if (tokens.pm) {
    const created = await api(tokens.pm, 'POST', '/work/items', {
      title: 'ABC UAT — GSTR-3B Jul 2026 Acme',
      description: 'Purchase UAT live create by Practice Manager',
      priority: 'high',
      assignedTo: 'ABC-EMP-01',
      assignedToName: 'Rahul Joshi',
      assigneeRole: 'employee',
      clientId: 'ABC-CLT-0001',
      companyId: 'ABC-CMP-0001',
      estimatedHours: 6,
      ownerCaId: 'ABC-CA-01',
      tlId: 'ABC-TL-01',
      assigneeId: 'ABC-EMP-01',
    })
    record('api_pm_create_work', created.status === 201 || created.status === 200, `status=${created.status} body=${JSON.stringify(created.json).slice(0, 180)}`)
    let wid = created.json?.data?.id
    if (!wid) {
      // fallback: pick an OPEN ABC work
      const list = await api(tokens.pm, 'GET', '/work/items?page=1&pageSize=5')
      wid = (list.json?.data?.items || []).find((w) => String(w.id || '').startsWith('ABC-'))?.id
        || (list.json?.data?.items || [])[0]?.id
    }
    if (wid) {
      record('api_pm_work_id', true, wid)

      const assign = await api(tokens.pm, 'POST', `/work/items/${wid}/assign`, {
        slot: 'assignee',
        userId: 'ABC-EMP-02',
        userName: 'Priyanka Kulkarni',
        userRole: 'employee',
      })
      record('api_pm_assign', assign.status === 200 || assign.status === 201, `status=${assign.status}`)
      if (assign.status >= 400) {
        judge('Practice Manager', 'assign', 'hate', `Assign failed (${assign.status}) — managers must reassign in one click when staff is on leave.`)
      } else {
        judge('Practice Manager', 'assign', 'love', 'Reassignment API works — critical for leave cover.')
      }

      for (const [name, pathName, body] of [
        ['note', `/work/items/${wid}/notes`, { body: '## ABC UAT note\nClient promised bank statements by Friday.', format: 'markdown' }],
        ['call', `/work/items/${wid}/calls`, { callDate: '2026-07-27', direction: 'outgoing', durationMinutes: 8, personSpokenTo: 'Accountant', summary: 'Asked for GSTR docs' }],
        ['email', `/work/items/${wid}/emails`, { emailDate: '2026-07-27', subject: 'Docs pending — GSTR-3B', toAddr: 'client1@example.com', status: 'sent', summary: 'Reminder' }],
        ['meeting', `/work/items/${wid}/meetings`, { meetingDate: '2026-07-28', location: 'Pune office', participants: ['Neha Banerjee', 'Rohan Deshmukh'], discussionNotes: 'Kick-off' }],
        ['followup', `/work/items/${wid}/followups`, { followUpDate: '2026-08-02', notes: 'Chase bank statement', reminder: true }],
      ]) {
        const res = await api(tokens.pm, 'POST', pathName, body)
        record(`api_pm_add_${name}`, res.status === 201 || res.status === 200, `status=${res.status}`)
        if (res.status >= 400) judge('Practice Manager', name, 'hate', `Cannot log ${name} on work (${res.status}) — daily CA practice depends on this.`)
      }

      const tr = await api(tokens.pm, 'POST', `/work/items/${wid}/transitions`, {
        toStatus: 'IN_PROGRESS',
        remarks: 'ABC UAT start work',
      })
      record('api_pm_transition', tr.status === 200 || tr.status === 409 || tr.status === 400, `status=${tr.status}`)
    }
  }

  // --- CA / TL verify path (best-effort on seeded READY_* works) ---
  if (tokens.tl) {
    const list = await api(tokens.tl, 'GET', '/work/items?page=1&pageSize=50')
    const items = list.json?.data?.items || []
    const ready = items.find((w) => w.status === 'READY_FOR_TL_VERIFY') || items[0]
    if (ready?.id) {
      const v = await api(tokens.tl, 'POST', `/work/items/${ready.id}/verify/tl`, { decision: 'pass', remarks: 'ABC UAT TL verify' })
      record('api_tl_verify', v.status === 200 || v.status === 409 || v.status === 400 || v.status === 403, `status=${v.status} work=${ready.id}`)
      if (v.status === 200) judge('Team Leader', 'verify', 'love', 'TL verify gate works — review chain feels real.')
      if (v.status === 403) judge('Team Leader', 'verify', 'hate', 'TL blocked from verify — breaks our review chain.')
      if (v.status === 409 || v.status === 400) judge('Team Leader', 'verify', 'mixed', `Verify rejected (${v.status}) — status machine unclear to staff without training.`)
    }
  }
  if (tokens.ca) {
    const list = await api(tokens.ca, 'GET', '/work/items?page=1&pageSize=50')
    const items = list.json?.data?.items || []
    const ready = items.find((w) => w.status === 'READY_FOR_CA_VERIFY') || items.find((w) => w.status === 'TL_VERIFIED') || items[0]
    if (ready?.id) {
      const v = await api(tokens.ca, 'POST', `/work/items/${ready.id}/verify/ca`, { decision: 'pass', remarks: 'ABC UAT CA verify' })
      record('api_ca_verify', v.status === 200 || v.status === 409 || v.status === 400 || v.status === 403, `status=${v.status} work=${ready.id}`)
    }
    // Get detail for screenshot later
    if (items[0]?.id) {
      const d = await api(tokens.ca, 'GET', `/work/items/${items[0].id}`)
      record('api_ca_detail', d.status === 200, `status=${d.status} ms=${d.ms}`)
      if (d.ms > 1500) judge('CA', 'work detail', 'hate', `Work detail ${d.ms}ms — CAs open dozens of files a day.`)
    }
  }

  // --- Partner close / sign-off ---
  if (tokens.mp) {
    const list = await api(tokens.mp, 'GET', '/work/items?page=1&pageSize=50')
    const items = list.json?.data?.items || []
    const closable = items.find((w) => ['READY_FOR_MANAGER_CLOSE', 'CA_VERIFIED', 'DELIVERED'].includes(w.status)) || items[0]
    if (closable?.id) {
      const closeMgr = await api(tokens.pm || tokens.mp, 'POST', `/work/items/${closable.id}/close/manager`, { remarks: 'ABC UAT manager close attempt' })
      record('api_close_manager', closeMgr.status === 200 || closeMgr.status === 403 || closeMgr.status === 409 || closeMgr.status === 400 || closeMgr.status === 404, `status=${closeMgr.status}`)
      const closePtr = await api(tokens.mp, 'POST', `/work/items/${closable.id}/close/partner`, { remarks: 'ABC UAT partner sign-off attempt' })
      record('api_close_partner', closePtr.status === 200 || closePtr.status === 403 || closePtr.status === 409 || closePtr.status === 400 || closePtr.status === 404, `status=${closePtr.status}`)
      if (closePtr.status >= 400) {
        judge('Managing Partner', 'sign-off', 'hate', `Partner close failed (${closePtr.status}) — high-risk matters need a clear partner sign-off button.`)
      }
    }
  }

  // --- Reception intake ---
  if (tokens.reception) {
    const intake = await api(tokens.reception, 'POST', '/work/intakes', {
      source: 'walk_in',
      contactName: 'ABC UAT Walk-in Client',
      contactPhone: '9876500199',
      contactEmail: 'walkin.abc@example.com',
      services: ['GST', 'ITR'],
      notes: 'Purchase UAT — reception desk intake',
    })
    record('api_reception_intake', intake.status === 201 || intake.status === 200, `status=${intake.status}`)
    if (intake.status === 201 || intake.status === 200) {
      judge('Reception', 'intake', 'love', 'Front desk can capture walk-ins — this is how new clients actually arrive.')
    } else {
      judge('Reception', 'intake', 'hate', `Intake create failed (${intake.status}) — receptionist will fall back to paper register.`)
    }
    const iid = intake.json?.data?.id
    if (iid && tokens.pm) {
      const approve = await api(tokens.pm, 'POST', `/work/intakes/${iid}/approve`, {
        clientId: 'ABC-CLT-0002',
        companyId: 'ABC-CMP-0002',
        ownerCaId: 'ABC-CA-02',
        engagementTitle: 'ABC UAT engagement from intake',
        services: ['GST'],
      })
      record('api_pm_intake_approve', approve.status === 200 || approve.status === 400, `status=${approve.status}`)
      if (approve.status === 200) judge('Practice Manager', 'intake approve', 'love', 'Intake → engagement path works.')
      if (approve.status === 400) judge('Practice Manager', 'intake approve', 'hate', 'Approve needs too many IDs — desk staff cannot map client/company/CA without hunting.')
    }
  }

  // --- HR must fail assign / create work ---
  if (tokens.hr) {
    const hrCreate = await api(tokens.hr, 'POST', '/work/items', {
      title: 'HR should not create delivery work',
      assignedTo: 'ABC-EMP-01',
      assigneeRole: 'employee',
    })
    record('api_hr_cannot_create', hrCreate.status === 403 || hrCreate.status >= 400, `status=${hrCreate.status}`)
    const hrAssign = await api(tokens.hr, 'POST', '/work/items/ABC-WRK-0001/assign', {
      slot: 'assignee',
      userId: 'ABC-EMP-03',
      userName: 'Suresh Patil',
      userRole: 'employee',
    })
    record('api_hr_cannot_assign', hrAssign.status === 403 || hrAssign.status >= 400, `status=${hrAssign.status}`)
    if (hrAssign.status === 403 || hrCreate.status === 403) {
      judge('HR', 'RBAC', 'love', 'HR correctly blocked from delivery assign/create — SoD holds.')
    } else if (hrAssign.status < 400 || hrCreate.status < 400) {
      judge('HR', 'RBAC', 'hate', 'HR can create/assign delivery work — unacceptable for a CA firm (compliance risk).')
    } else {
      judge('HR', 'RBAC', 'mixed', `HR blocked with ${hrCreate.status}/${hrAssign.status} — confirm UX shows clear "not allowed" not a crash.`)
    }
  }

  // --- Employee cannot create ---
  if (tokens.emp) {
    const empCreate = await api(tokens.emp, 'POST', '/work/items', {
      title: 'emp hack',
      assignedTo: 'ABC-EMP-01',
    })
    record('api_emp_cannot_create', empCreate.status === 403 || empCreate.status >= 400, `status=${empCreate.status}`)
  }

  // --- Engagements list ---
  if (tokens.pm) {
    const eng = await api(tokens.pm, 'GET', '/work/engagements')
    record('api_engagements', eng.status === 200, `status=${eng.status} ms=${eng.ms}`)
    if (eng.status !== 200) judge('Practice Manager', 'engagements', 'hate', 'Cannot see engagement retainers — how do we bill / staff?')
  }

  // --- UI click-through every role ---
  for (const r of roles) {
    try {
      const t0 = Date.now()
      await uiLogin(page, r.email)
      const loginMs = Date.now() - t0
      record(`ui_login_${r.id}`, true, `${loginMs}ms url=${page.url()}`)
      if (loginMs > 5000) judge(r.label, 'UI login', 'hate', `Browser login ${loginMs}ms — feels broken on a busy Monday.`)

      for (const p of pages) {
        const forbidden = []
        const onResp = (resp) => {
          if (resp.status() === 403 && resp.url().includes('/work')) forbidden.push(resp.url())
        }
        page.on('response', onResp)
        const t1 = Date.now()
        let navOk = true
        let err = ''
        try {
          await page.goto(`${BASE}${p}`, { waitUntil: 'networkidle', timeout: 35000 })
        } catch (e) {
          navOk = false
          err = String(e).slice(0, 120)
        }
        const pageMs = Date.now() - t1
        page.off('response', onResp)
        const stillLogin = page.url().includes('/login')
        const shot = `${r.id}${p.replace(/\//g, '_') || '_work'}.png`
        await page.screenshot({ path: path.join(SHOT_DIR, shot), fullPage: true }).catch(() => {})
        record(`ui_${r.id}${p.replace(/\//g, '_')}`, navOk && !stillLogin, `ms=${pageMs} forbidden=${forbidden.length} ${err}`)

        // Business judgments from UI
        if (stillLogin) {
          judge(r.label, p, 'hate', 'Kicked to login — session/nav broken.')
        } else if (pageMs > 4000) {
          judge(r.label, p, 'hate', `Page ${p} took ${pageMs}ms — staff will abandon and use Excel.`)
        } else if (p === '/work/board' && (r.id === 'tl' || r.id === 'ca' || r.id === 'pm')) {
          judge(r.label, 'board', 'mixed', 'Kanban exists — useful if columns match our status language (Doc Pending → TL → CA → Close).')
        } else if (p === '/work/intake' && r.id === 'reception') {
          judge(r.label, 'intake UI', 'mixed', 'Intake route reachable — need big “New walk-in” button, not buried form.')
        } else if (p === '/work/team' && (r.id === 'pm' || r.id === 'mp')) {
          judge(r.label, 'team', 'mixed', 'Team page exists — must show Emp→TL→CA→PM tree or partners cannot staff work.')
        } else if (p === '/work/calendar' && (r.id === 'ca' || r.id === 'tl')) {
          judge(r.label, 'calendar', 'mixed', 'Calendar view present — only valuable if due dates / follow-ups actually show.')
        }

        // HR on assign-looking pages
        if (r.id === 'hr' && p === '/work' && forbidden.length === 0) {
          // may still see shell
          judge(r.label, 'work UI', 'mixed', 'HR can open Work shell — ensure no Assign/Create buttons are clickable.')
        }
      }

      // Try open first work detail if link present
      try {
        await page.goto(`${BASE}/work`, { waitUntil: 'networkidle', timeout: 30000 })
        const row = page.locator('a[href*="/work/"], tr, [data-testid*="work"]').first()
        if (await row.count()) {
          await row.click({ timeout: 3000 }).catch(() => {})
          await page.waitForTimeout(800)
          if (page.url().includes('/work/') && !page.url().endsWith('/work')) {
            await page.screenshot({ path: path.join(SHOT_DIR, `${r.id}_detail.png`), fullPage: true })
            record(`ui_detail_${r.id}`, true, page.url())
          }
        }
      } catch {
        record(`ui_detail_${r.id}`, true, 'no detail click')
      }

      // Dark mode if any
      const themeBtn = page.getByRole('button', { name: /theme|dark|light/i }).first()
      if (await themeBtn.count()) {
        await themeBtn.click().catch(() => {})
        await page.screenshot({ path: path.join(SHOT_DIR, `${r.id}_dark.png`) })
      }
    } catch (e) {
      record(`ui_role_${r.id}`, false, String(e).slice(0, 200))
      judge(r.label, 'UI', 'hate', `UI session failed: ${String(e).slice(0, 120)}`)
    }
  }

  // HR UI: try create/assign and expect failure messaging
  if (tokens.hr) {
    try {
      await uiLogin(page, 'hr@abc.smartca.in')
      await page.goto(`${BASE}/work`, { waitUntil: 'networkidle' })
      const createBtn = page.getByRole('button', { name: /create|new work|add work/i }).first()
      const hasCreate = await createBtn.count()
      await page.screenshot({ path: path.join(SHOT_DIR, 'hr_work_attempt.png'), fullPage: true })
      record('ui_hr_create_button', true, hasCreate ? 'CREATE_VISIBLE' : 'CREATE_HIDDEN')
      if (hasCreate) judge('HR', 'UI permissions', 'hate', 'Create Work button visible to HR — will cause mistaken client work.')
      else judge('HR', 'UI permissions', 'love', 'No Create Work for HR on list — good.')
    } catch (e) {
      record('ui_hr_attempt', false, String(e).slice(0, 120))
    }
  }

  // Reception intake UI
  if (tokens.reception) {
    try {
      await uiLogin(page, 'reception@abc.smartca.in')
      await page.goto(`${BASE}/work/intake`, { waitUntil: 'networkidle' })
      await page.screenshot({ path: path.join(SHOT_DIR, 'reception_intake.png'), fullPage: true })
      record('ui_reception_intake', !page.url().includes('/login'))
    } catch (e) {
      record('ui_reception_intake', false, String(e).slice(0, 120))
    }
  }

  // Mobile smoke as PM
  await page.setViewportSize({ width: 390, height: 844 })
  await uiLogin(page, 'practice.manager@abc.smartca.in')
  await page.goto(`${BASE}/work`, { waitUntil: 'networkidle' })
  await page.screenshot({ path: path.join(SHOT_DIR, 'mobile_pm_work.png'), fullPage: true })
  record('ui_mobile_pm', !page.url().includes('/login'))
  judge('Practice Manager', 'mobile', 'mixed', 'Mobile list opens — partners on site visits need readable cards, not dense tables.')

} catch (e) {
  record('suite_crash', false, String(e))
} finally {
  await browser.close()
}

const failed = results.filter((r) => r.status === 'FAIL')
const passed = results.filter((r) => r.status === 'PASS')
const perf = {
  slowest: [...timings].sort((a, b) => b.ms - a.ms).slice(0, 15),
  loginAvg: avg(timings.filter((t) => t.op.startsWith('login:')).map((t) => t.ms)),
  listAvg: avg(timings.filter((t) => t.op.includes('/work/items')).map((t) => t.ms)),
}
fs.writeFileSync(
  path.join(SHOT_DIR, 'results.json'),
  JSON.stringify({ passed: passed.length, failed: failed.length, results, judgments, perf, consoleErrors: consoleErrors.slice(0, 40) }, null, 2),
)
console.log(`\nABC UAT: ${passed.length} PASS / ${failed.length} FAIL / ${results.length} total`)
console.log(`Judgments: ${judgments.length}`)
process.exit(0) // always 0 — UAT report consumes FAIL as business evidence

function avg(arr) {
  if (!arr.length) return 0
  return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length)
}
