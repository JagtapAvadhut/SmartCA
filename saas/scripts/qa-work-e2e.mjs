/**
 * Enterprise Work Management UI + API E2E (Playwright).
 * Targets local Vite + Go API (no Docker).
 *
 *   QA_BASE=http://127.0.0.1:5173 QA_API=http://127.0.0.1:8080/api/v1 node scripts/qa-work-e2e.mjs
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.QA_BASE || 'http://127.0.0.1:5173'
const API = process.env.QA_API || 'http://127.0.0.1:8080/api/v1'
const PASSWORD = 'SmartCA@2025'
const SHOT_DIR = path.resolve('qa-artifacts/work')
fs.mkdirSync(SHOT_DIR, { recursive: true })

const results = []
function record(id, ok, detail = '') {
  results.push({ id, status: ok ? 'PASS' : 'FAIL', detail })
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${id}${detail ? ` — ${detail}` : ''}`)
}

async function apiLogin(identifier) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password: PASSWORD }),
  })
  const json = await res.json()
  if (!res.ok || !json.success) throw new Error(`login failed ${identifier}: ${res.status}`)
  return json.data.token
}

async function api(token, method, pathName, body) {
  const res = await fetch(`${API}${pathName}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => ({}))
  return { status: res.status, json }
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
  await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 20000 })
}

const roles = [
  { id: 'manager', email: 'manager1@wm.smartca.in' },
  { id: 'ca', email: 'ca1@wm.smartca.in' },
  { id: 'tl', email: 'tl1@wm.smartca.in' },
  { id: 'emp', email: 'emp1@wm.smartca.in' },
]

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await context.newPage()
const consoleErrors = []
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text())
})
page.on('pageerror', (err) => consoleErrors.push(String(err)))

try {
  // --- API role matrix ---
  const tokens = {}
  for (const r of roles) {
    try {
      tokens[r.id] = await apiLogin(r.email)
      record(`api_login_${r.id}`, true)
    } catch (e) {
      record(`api_login_${r.id}`, false, String(e))
    }
  }

  for (const r of roles) {
    if (!tokens[r.id]) continue
    const list = await api(tokens[r.id], 'GET', '/work/items?page=1&pageSize=5')
    const scoped =
      r.id === 'manager' ? list.json?.data?.total >= 5000 :
      r.id === 'emp' ? list.json?.data?.total > 0 && list.json?.data?.total < 500 :
      list.json?.data?.total > 0 && list.json?.data?.total < 5000
    record(`api_list_${r.id}`, list.status === 200 && list.json.success && scoped, `status=${list.status} total=${list.json?.data?.total}`)
    const dash = await api(tokens[r.id], 'GET', '/work/dashboard')
    record(`api_dashboard_${r.id}`, dash.status === 200 && dash.json.success, `status=${dash.status}`)
    const search = await api(tokens[r.id], 'GET', '/work/search?q=GST')
    record(`api_search_${r.id}`, search.status === 200 && search.json.success, `status=${search.status}`)
  }

  // Manager create / assign / children / soft-delete restore
  if (tokens.manager) {
    const created = await api(tokens.manager, 'POST', '/work/items', {
      title: 'QA E2E Work Item',
      description: 'Playwright validation',
      priority: 'high',
      assignedTo: 'WM-CA-0001',
      assignedToName: 'CA 1',
      assigneeRole: 'ca',
      estimatedHours: 4,
    })
    record('api_mgr_create', created.status === 201 || created.status === 200, `status=${created.status}`)
    const wid = created.json?.data?.id
    if (wid) {
      const fu = await api(tokens.manager, 'POST', `/work/items/${wid}/followups`, {
        followUpDate: '2026-08-15',
        notes: 'remind client',
        reminder: true,
      })
      record('api_add_followup', fu.status === 201 || fu.status === 200, `status=${fu.status}`)
      const fuid = fu.json?.data?.id
      if (fuid) {
        const upd = await api(tokens.manager, 'PATCH', `/work/items/${wid}/followups/${fuid}`, {
          notes: 'updated reminder',
          followUpDate: '2026-08-16',
          reminder: true,
        })
        record('api_update_followup', upd.status === 200, `status=${upd.status}`)
        const arch = await api(tokens.manager, 'POST', `/work/followups/${fuid}/archive`, {})
        record('api_archive_followup', arch.status === 200, `status=${arch.status}`)
        const rest = await api(tokens.manager, 'POST', `/work/followups/${fuid}/restore`, {})
        record('api_restore_followup', rest.status === 200, `status=${rest.status}`)
      }
      for (const [name, pathName, body] of [
        ['call', `/work/items/${wid}/calls`, { callDate: '2026-08-01', direction: 'outgoing', durationMinutes: 12, personSpokenTo: 'CFO', summary: 'discuss' }],
        ['email', `/work/items/${wid}/emails`, { emailDate: '2026-08-01', subject: 'Docs', toAddr: 'a@b.com,c@d.com', status: 'sent' }],
        ['meeting', `/work/items/${wid}/meetings`, { meetingDate: '2026-08-02', participants: ['CA 1', 'Client'], discussionNotes: 'plan' }],
        ['note', `/work/items/${wid}/notes`, { body: '## Markdown note\n- item', format: 'markdown' }],
        ['comment', `/work/items/${wid}/comments`, { body: 'Looks good @manager1', mentions: ['WM-MGR-0001'] }],
        ['attachment', `/work/items/${wid}/attachments`, { fileName: 'proof.pdf', contentType: 'application/pdf', sizeBytes: 1024, storagePath: '/tmp/proof.pdf', kind: 'document' }],
      ]) {
        const res = await api(tokens.manager, 'POST', pathName, body)
        record(`api_add_${name}`, res.status === 201 || res.status === 200, `status=${res.status}`)
      }
      const act = await api(tokens.manager, 'GET', `/work/items/${wid}/activity`)
      record('api_activity', act.status === 200 && (act.json?.data?.length ?? 0) > 0, `n=${act.json?.data?.length}`)
      const aud = await api(tokens.manager, 'GET', `/work/items/${wid}/audit`)
      record('api_audit', aud.status === 200 && (aud.json?.data?.length ?? 0) > 0, `n=${aud.json?.data?.length}`)
      const archW = await api(tokens.manager, 'POST', `/work/items/${wid}/archive`, {})
      record('api_archive_work', archW.status === 200, `status=${archW.status}`)
      const restW = await api(tokens.manager, 'POST', `/work/items/${wid}/restore`, {})
      record('api_restore_work', restW.status === 200, `status=${restW.status}`)
      const hard = await api(tokens.manager, 'DELETE', `/work/items/${wid}`)
      record('api_hard_delete_forbidden', hard.status >= 400, `status=${hard.status}`)
    }
  }

  // Negatives
  if (tokens.emp) {
    const create = await api(tokens.emp, 'POST', '/work/items', {
      title: 'hack',
      assignedTo: 'x',
      assignedToRole: 'employee',
    })
    record('api_emp_cannot_create', create.status === 403 || create.status === 401 || create.status >= 400, `status=${create.status}`)
    const team = await api(tokens.emp, 'POST', '/work/team/users', {
      fullName: 'Hack',
      email: 'hack@wm.smartca.in',
      role: 'manager',
      password: PASSWORD,
    })
    record('api_emp_cannot_create_user', team.status >= 400, `status=${team.status}`)
  }
  if (tokens.tl) {
    const escalate = await api(tokens.tl, 'POST', '/work/team/users', {
      fullName: 'Bad Manager',
      email: 'badmgr@wm.smartca.in',
      role: 'manager',
      password: PASSWORD,
    })
    record('api_tl_cannot_create_manager', escalate.status >= 400, `status=${escalate.status}`)
  }

  const noAuth = await fetch(`${API}/work/items`)
  record('api_no_auth', noAuth.status === 401, `status=${noAuth.status}`)
  const badTok = await fetch(`${API}/work/items`, { headers: { Authorization: 'Bearer expired.token' } })
  record('api_bad_token', badTok.status === 401, `status=${badTok.status}`)
  if (tokens.manager) {
    const sqli = await api(tokens.manager, 'GET', "/work/items?q=' OR 1=1--")
    record('api_sqli_smoke', sqli.status === 200, `status=${sqli.status}`)
    const xss = await api(tokens.manager, 'POST', '/work/items', {
      title: '<script>alert(1)</script>',
      assignedTo: 'WM-CA-0001',
      assigneeRole: 'ca',
    })
    record('api_xss_title_stored', xss.status === 201 || xss.status === 200, `status=${xss.status}`)
  }

  // Performance smoke
  if (tokens.manager) {
    const t0 = Date.now()
    await api(tokens.manager, 'GET', '/work/items?page=1&pageSize=50')
    const listMs = Date.now() - t0
    record('perf_list_50', listMs < 3000, `${listMs}ms`)
    const t1 = Date.now()
    await api(tokens.manager, 'GET', '/work/dashboard')
    const dashMs = Date.now() - t1
    record('perf_dashboard', dashMs < 3000, `${dashMs}ms`)
    const t2 = Date.now()
    await api(tokens.manager, 'GET', '/work/search?q=work')
    const searchMs = Date.now() - t2
    record('perf_search', searchMs < 3000, `${searchMs}ms`)
  }

  // Concurrency: parallel reassign-ish updates
  if (tokens.manager && tokens.ca) {
    const list = await api(tokens.manager, 'GET', '/work/items?page=1&pageSize=1')
    const wid = list.json?.data?.items?.[0]?.id
    if (wid) {
      const resultsC = await Promise.all(
        Array.from({ length: 5 }, (_, i) =>
          api(tokens.manager, 'PATCH', `/work/items/${wid}`, {
            description: `concurrent-${i}-${Date.now()}`,
            completionPct: (i + 1) * 10,
          }),
        ),
      )
      const okN = resultsC.filter((r) => r.status === 200).length
      record('concurrency_parallel_patch', okN === 5, `ok=${okN}`)
    }
  }

  // --- UI pages per role ---
  const pages = [
    '/work',
    '/work/board',
    '/work/calendar',
    '/work/timeline',
    '/work/dashboard',
    '/work/team',
  ]
  for (const r of roles) {
    try {
      await uiLogin(page, r.email)
      record(`ui_login_${r.id}`, true, page.url())
      for (const p of pages) {
        const workForbidden = []
        const onResp = (r) => {
          if (r.status() === 403 && r.url().includes('/work/')) workForbidden.push(r.url())
        }
        page.on('response', onResp)
        await page.goto(`${BASE}${p}`, { waitUntil: 'networkidle', timeout: 30000 })
        page.off('response', onResp)
        const titleOk = !page.url().includes('/login')
        await page.screenshot({ path: path.join(SHOT_DIR, `${r.id}${p.replace(/\//g, '_') || '_work'}.png`), fullPage: true })
        record(`ui_${r.id}${p.replace(/\//g, '_') || '_list'}`, titleOk && workForbidden.length === 0, workForbidden.slice(0, 2).join(' | '))
      }
      // dark mode toggle if present
      const themeBtn = page.getByRole('button', { name: /theme|dark|light/i }).first()
      if (await themeBtn.count()) {
        await themeBtn.click().catch(() => {})
        await page.screenshot({ path: path.join(SHOT_DIR, `${r.id}_dark.png`) })
        record(`ui_theme_${r.id}`, true)
      } else {
        record(`ui_theme_${r.id}`, true, 'no theme toggle found')
      }
    } catch (e) {
      record(`ui_role_${r.id}`, false, String(e))
    }
  }

  // Responsive
  await page.setViewportSize({ width: 390, height: 844 })
  await uiLogin(page, 'manager1@wm.smartca.in')
  await page.goto(`${BASE}/work`, { waitUntil: 'networkidle' })
  await page.screenshot({ path: path.join(SHOT_DIR, 'mobile_work.png'), fullPage: true })
  record('ui_mobile_work', !page.url().includes('/login'))
} catch (e) {
  record('suite_crash', false, String(e))
} finally {
  await browser.close()
}

const failed = results.filter((r) => r.status === 'FAIL')
const passed = results.filter((r) => r.status === 'PASS')
console.log(`\nWork E2E: ${passed.length} PASS / ${failed.length} FAIL / ${results.length} total`)
fs.writeFileSync(path.join(SHOT_DIR, 'results.json'), JSON.stringify({ passed: passed.length, failed: failed.length, results }, null, 2))
process.exit(failed.length ? 1 : 0)
