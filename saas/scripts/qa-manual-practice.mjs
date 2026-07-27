/**
 * Team 6 — Adversarial Practice Core + WM manual QA harness.
 * Writes JSON results; does not fix product code.
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const API = process.env.QA_API || 'http://127.0.0.1:8080/api/v1'
const BASE = process.env.QA_BASE || 'http://127.0.0.1:5173'
const PASSWORD = 'SmartCA@2025'
const OUT_DIR = path.resolve('qa-artifacts/qa-manual')
fs.mkdirSync(OUT_DIR, { recursive: true })

const findings = []
function note(id, severity, title, detail) {
  findings.push({ id, severity, title, detail, at: new Date().toISOString() })
  console.log(`[${severity}] ${id}: ${title} — ${detail}`)
}
function pass(id, detail = '') {
  findings.push({ id, severity: 'PASS', title: id, detail, at: new Date().toISOString() })
  console.log(`[PASS] ${id}${detail ? ` — ${detail}` : ''}`)
}
function fail(id, detail = '') {
  findings.push({ id, severity: 'FAIL', title: id, detail, at: new Date().toISOString() })
  console.log(`[FAIL] ${id}${detail ? ` — ${detail}` : ''}`)
}

async function login(identifier) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password: PASSWORD }),
  })
  const json = await res.json().catch(() => ({}))
  return { status: res.status, json, token: json?.data?.token, user: json?.data?.user }
}

async function api(token, method, pathName, body) {
  const res = await fetch(`${API}${pathName}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json = {}
  try { json = JSON.parse(text) } catch { json = { raw: text.slice(0, 500) } }
  return { status: res.status, json, text: text.slice(0, 800) }
}

// Preferred Practice UAT emails (BUG-0012). Demo USR aliases also have portfolios after practiceuatseed.
const accounts = {
  manager: 'manager1@wm.smartca.in',
  ca: 'ca1@wm.smartca.in',
  tl: 'tl1@wm.smartca.in',
  emp: 'emp1@wm.smartca.in',
  partner: 'amit.kumar@smartca.in',
  hr: 'karthik.bhat@smartca.in',
  senior_ca: 'vikram@practice.smartca.in',
  junior_ca: 'aditya@practice.smartca.in',
  accountant: 'ganesh@practice.smartca.in',
  article: 'kunal@practice.smartca.in',
}

const tokens = {}
const users = {}

console.log('=== LOGINS ===')
for (const [role, email] of Object.entries(accounts)) {
  const r = await login(email)
  if (r.status === 200 && r.token) {
    tokens[role] = r.token
    users[role] = r.user
    pass(`login_${role}`, `email=${email} id=${r.user?.id} perms=${(r.user?.permissions||[]).slice(0,8).join(',')}`)
  } else {
    fail(`login_${role}`, `status=${r.status} body=${JSON.stringify(r.json).slice(0,200)}`)
  }
}

// Reception — expect missing
{
  const recCandidates = ['reception@smartca.in', 'reception1@wm.smartca.in', 'front.desk@smartca.in']
  let any = false
  for (const e of recCandidates) {
    const r = await login(e)
    if (r.token) { any = true; tokens.reception = r.token; users.reception = r.user; pass('login_reception', e); break }
  }
  if (!any) note('BUG_CANDIDATE_RECEPTION', 'High', 'No reception seed user', 'Tried ' + recCandidates.join(', '))
}

console.log('\n=== LIST SCOPE ===')
for (const role of ['manager', 'ca', 'tl', 'emp', 'partner', 'hr', 'article', 'accountant', 'junior_ca', 'senior_ca']) {
  if (!tokens[role]) continue
  const r = await api(tokens[role], 'GET', '/work/items?page=1&pageSize=5')
  const total = r.json?.data?.total
  const ok = r.status === 200 && r.json?.success
  if (role === 'hr') {
    // HR should have zero work rows / no work.view
    if (r.status === 403 || total === 0) pass(`list_scope_${role}`, `status=${r.status} total=${total}`)
    else fail(`list_scope_${role}`, `HR should not see works: status=${r.status} total=${total}`)
  } else if (role === 'manager' || role === 'partner') {
    if (ok && total >= 1000) pass(`list_scope_${role}`, `total=${total}`)
    else fail(`list_scope_${role}`, `status=${r.status} total=${total}`)
  } else {
    if (ok) pass(`list_scope_${role}`, `status=${r.status} total=${total}`)
    else fail(`list_scope_${role}`, `status=${r.status} body=${r.text.slice(0,180)}`)
  }
}

console.log('\n=== RBAC NEGATIVES ===')
// Emp cannot create
if (tokens.emp) {
  const r = await api(tokens.emp, 'POST', '/work/items', { title: 'EMP SHOULD FAIL', priority: 'medium' })
  if (r.status === 403) pass('rbac_emp_cannot_create', `403 ok`)
  else fail('rbac_emp_cannot_create', `expected 403 got ${r.status} ${r.text.slice(0,200)}`)
}
// HR cannot create / assign
if (tokens.hr) {
  const c = await api(tokens.hr, 'POST', '/work/items', { title: 'HR SHOULD FAIL', priority: 'medium' })
  if (c.status === 403) pass('rbac_hr_cannot_create', '403')
  else fail('rbac_hr_cannot_create', `expected 403 got ${c.status} ${c.text.slice(0,200)}`)
}
// Article cannot TL verify
if (tokens.article && tokens.manager) {
  // create work in READY_FOR_TL_VERIFY via manager path later
}

console.log('\n=== MANAGER CREATE + GATES ===')
let workId = null
let openWorkId = null
if (tokens.manager) {
  const created = await api(tokens.manager, 'POST', '/work/items', {
    title: 'QA Manual Gate Work',
    description: 'Team6 adversarial',
    priority: 'high',
    riskClass: 'medium',
    workType: 'GSTR3B',
    clientId: 'CLI-0001',
    assignedTo: users.emp?.id || 'WM-EMP-0001',
    assignedToName: users.emp?.fullName || 'Employee 1',
    assigneeRole: 'employee',
    ownerCaId: users.ca?.id || 'WM-CA-0001',
    tlId: users.tl?.id || 'WM-TL-0001',
    assigneeId: users.emp?.id || 'WM-EMP-0001',
  })
  if (created.status === 200 || created.status === 201) {
    pass('mgr_create', `id=${created.json?.data?.id} status=${created.json?.data?.status}`)
    workId = created.json?.data?.id
    openWorkId = workId
  } else {
    fail('mgr_create', `status=${created.status} ${created.text.slice(0,300)}`)
  }
}

if (workId && tokens.manager) {
  // free complete via PATCH must be blocked
  const patchClosed = await api(tokens.manager, 'PATCH', `/work/items/${workId}`, { status: 'CLOSED' })
  if (patchClosed.status === 409 || patchClosed.status === 400) pass('patch_closed_blocked', `status=${patchClosed.status}`)
  else fail('patch_closed_blocked', `expected 409 got ${patchClosed.status} ${patchClosed.text.slice(0,250)}`)

  const patchCompleted = await api(tokens.manager, 'PATCH', `/work/items/${workId}`, { status: 'completed' })
  if (patchCompleted.status === 409 || patchCompleted.status === 400) pass('patch_completed_blocked', `status=${patchCompleted.status}`)
  else fail('patch_completed_blocked', `expected 409 got ${patchCompleted.status} ${patchCompleted.text.slice(0,250)}`)

  // transition OPEN -> IN_PROGRESS
  let t = await api(tokens.manager, 'POST', `/work/items/${workId}/transitions`, { to: 'IN_PROGRESS', remarks: 'start' })
  if (t.status === 200) pass('transition_in_progress', `to=${t.json?.data?.status}`)
  else fail('transition_in_progress', `${t.status} ${t.text.slice(0,250)}`)

  t = await api(tokens.manager, 'POST', `/work/items/${workId}/transitions`, { to: 'READY_FOR_TL_VERIFY', remarks: 'submit' })
  if (t.status === 200) pass('transition_tl_queue', `to=${t.json?.data?.status}`)
  else fail('transition_tl_queue', `${t.status} ${t.text.slice(0,250)}`)

  // Emp cannot TL verify
  if (tokens.emp) {
    const ev = await api(tokens.emp, 'POST', `/work/items/${workId}/verify/tl`, { decision: 'pass' })
    if (ev.status === 403) pass('rbac_emp_cannot_tl_verify', '403')
    else fail('rbac_emp_cannot_tl_verify', `${ev.status} ${ev.text.slice(0,200)}`)
  }
  // Article cannot TL verify
  if (tokens.article) {
    const av = await api(tokens.article, 'POST', `/work/items/${workId}/verify/tl`, { decision: 'pass' })
    if (av.status === 403) pass('rbac_article_cannot_tl_verify', '403')
    else fail('rbac_article_cannot_tl_verify', `${av.status} ${av.text.slice(0,200)}`)
  }
  // HR cannot assign
  if (tokens.hr) {
    const ha = await api(tokens.hr, 'POST', `/work/items/${workId}/assign`, { slot: 'assignee', userId: 'WM-EMP-0002' })
    if (ha.status === 403) pass('rbac_hr_cannot_assign', '403')
    else fail('rbac_hr_cannot_assign', `${ha.status} ${ha.text.slice(0,200)}`)
  }

  // TL verify pass
  if (tokens.tl) {
    const tv = await api(tokens.tl, 'POST', `/work/items/${workId}/verify/tl`, { decision: 'pass', remarks: 'ok' })
    if (tv.status === 200) pass('tl_verify_pass', `status=${tv.json?.data?.status}`)
    else fail('tl_verify_pass', `${tv.status} ${tv.text.slice(0,250)}`)
  }

  // Emp cannot CA verify
  if (tokens.emp) {
    const eca = await api(tokens.emp, 'POST', `/work/items/${workId}/verify/ca`, { decision: 'pass' })
    if (eca.status === 403) pass('rbac_emp_cannot_ca_verify', '403')
    else fail('rbac_emp_cannot_ca_verify', `${eca.status}`)
  }

  // CA verify
  if (tokens.ca) {
    const cv = await api(tokens.ca, 'POST', `/work/items/${workId}/verify/ca`, { decision: 'pass', remarks: 'ca ok' })
    if (cv.status === 200) pass('ca_verify_pass', `status=${cv.json?.data?.status}`)
    else fail('ca_verify_pass', `${cv.status} ${cv.text.slice(0,250)}`)
  }

  // Emp cannot close
  if (tokens.emp) {
    const ec = await api(tokens.emp, 'POST', `/work/items/${workId}/close`, { remarks: 'nope' })
    if (ec.status === 403) pass('rbac_emp_cannot_close', '403')
    else fail('rbac_emp_cannot_close', `${ec.status}`)
  }

  // Manager close
  const cl = await api(tokens.manager, 'POST', `/work/items/${workId}/close`, { remarks: 'closed by QA' })
  if (cl.status === 200) pass('mgr_close', `status=${cl.json?.data?.status}`)
  else fail('mgr_close', `${cl.status} ${cl.text.slice(0,250)}`)

  // Reopen
  const re = await api(tokens.manager, 'POST', `/work/items/${workId}/reopen`, { reason: 'need fix' })
  if (re.status === 200) pass('mgr_reopen', `status=${re.json?.data?.status}`)
  else fail('mgr_reopen', `${re.status} ${re.text.slice(0,250)}`)
}

console.log('\n=== INTAKE ===')
let intakeId = null
// Manager may create intake; reception preferred but missing
if (tokens.manager) {
  const inc = await api(tokens.manager, 'POST', '/work/intakes', {
    contactName: 'QA Client Contact',
    contactPhone: '9999999999',
    contactEmail: 'qa.intake@example.com',
    services: ['GST', 'ITR'],
    notes: 'Team6 intake',
  })
  if (inc.status === 200 || inc.status === 201) {
    pass('intake_create', `id=${inc.json?.data?.id}`)
    intakeId = inc.json?.data?.id
  } else {
    fail('intake_create', `${inc.status} ${inc.text.slice(0,300)}`)
  }
}
if (tokens.emp) {
  const ei = await api(tokens.emp, 'POST', '/work/intakes', { contactName: 'x', services: ['GST'] })
  if (ei.status === 403) pass('rbac_emp_cannot_intake', '403')
  else fail('rbac_emp_cannot_intake', `${ei.status} ${ei.text.slice(0,200)}`)
}
if (tokens.hr) {
  const hi = await api(tokens.hr, 'POST', '/work/intakes', { contactName: 'x', services: ['GST'] })
  // HR typically no intake.create
  if (hi.status === 403) pass('rbac_hr_cannot_intake', '403')
  else note('OBS_HR_INTAKE', 'Medium', 'HR intake create not 403', `${hi.status} ${hi.text.slice(0,200)}`)
}
if (intakeId && tokens.manager) {
  const li = await api(tokens.manager, 'GET', '/work/intakes')
  if (li.status === 200) pass('intake_list', `n=${li.json?.data?.length ?? li.json?.data?.items?.length}`)
  else fail('intake_list', `${li.status}`)

  const ap = await api(tokens.manager, 'POST', `/work/intakes/${intakeId}/approve`, {
    clientId: 'CLI-0001',
    ownerCaId: users.ca?.id || 'WM-CA-0001',
    engagementTitle: 'QA Engagement',
    services: ['GST'],
  })
  if (ap.status === 200) pass('intake_approve', `eng=${ap.json?.data?.engagementId || ap.json?.data?.id}`)
  else fail('intake_approve', `${ap.status} ${ap.text.slice(0,300)}`)
}

// Reject path with new intake
if (tokens.manager) {
  const inc2 = await api(tokens.manager, 'POST', '/work/intakes', {
    contactName: 'Reject Me', contactPhone: '8888888888', services: ['TDS'],
  })
  const id2 = inc2.json?.data?.id
  if (id2) {
    const rj = await api(tokens.manager, 'POST', `/work/intakes/${id2}/reject`, { remarks: 'duplicate' })
    if (rj.status === 200) pass('intake_reject', 'ok')
    else fail('intake_reject', `${rj.status} ${rj.text.slice(0,200)}`)
  }
}

console.log('\n=== CHECKLIST ===')
if (workId && tokens.manager) {
  const add = await api(tokens.manager, 'POST', `/work/items/${workId}/checklist`, { code: 'PAN', label: 'PAN card copy' })
  if (add.status === 200 || add.status === 201) pass('checklist_add', `id=${add.json?.data?.id}`)
  else fail('checklist_add', `${add.status} ${add.text.slice(0,250)}`)
  const cid = add.json?.data?.id
  const list = await api(tokens.manager, 'GET', `/work/items/${workId}/checklist`)
  if (list.status === 200) pass('checklist_list', `n=${(list.json?.data||[]).length}`)
  else fail('checklist_list', `${list.status}`)
  if (cid && tokens.tl) {
    const failV = await api(tokens.tl, 'POST', `/work/items/${workId}/checklist/${cid}/verify`, { decision: 'fail' })
    // remarks required on reject
    if (failV.status === 400 || failV.status === 422) pass('checklist_reject_requires_remarks', `${failV.status}`)
    else if (failV.status === 200) fail('checklist_reject_requires_remarks', `accepted without remarks: ${failV.status}`)
    else note('OBS_CHECKLIST_REJECT', 'Medium', 'Unexpected checklist reject status', `${failV.status} ${failV.text.slice(0,200)}`)

    const okV = await api(tokens.tl, 'POST', `/work/items/${workId}/checklist/${cid}/verify`, { decision: 'pass', remarks: 'verified' })
    if (okV.status === 200) pass('checklist_verify_pass', 'ok')
    else fail('checklist_verify_pass', `${okV.status} ${okV.text.slice(0,200)}`)
  }
  if (cid && tokens.emp) {
    const ev = await api(tokens.emp, 'POST', `/work/items/${workId}/checklist/${cid}/verify`, { decision: 'pass', remarks: 'x' })
    if (ev.status === 403) pass('rbac_emp_cannot_checklist_verify', '403')
    else fail('rbac_emp_cannot_checklist_verify', `${ev.status} ${ev.text.slice(0,200)}`)
  }
}

console.log('\n=== CHILDREN / SOFT DELETE ===')
if (workId && tokens.manager) {
  const kids = [
    ['followups', { followUpDate: '2026-08-15', notes: 'chase', reminder: true }, 'followups'],
    ['calls', { callDate: '2026-08-01', direction: 'outgoing', durationMinutes: 5, personSpokenTo: 'CFO', summary: 'hi' }, 'calls'],
    ['emails', { emailDate: '2026-08-01', subject: 'Docs', toAddr: 'a@b.com', status: 'sent' }, 'emails'],
    ['meetings', { meetingDate: '2026-08-02', participants: ['CA'], discussionNotes: 'plan' }, 'meetings'],
    ['notes', { body: 'note body', format: 'markdown' }, 'notes'],
    ['comments', { body: 'comment @mgr', mentions: [users.manager?.id || 'WM-MGR-0001'] }, 'comments'],
    ['attachments', { fileName: 'a.pdf', contentType: 'application/pdf', sizeBytes: 10, storagePath: '/tmp/a.pdf', kind: 'document' }, 'attachments'],
  ]
  for (const [name, body] of kids) {
    const r = await api(tokens.manager, 'POST', `/work/items/${workId}/${name}`, body)
    if (r.status === 200 || r.status === 201) pass(`child_add_${name}`, `id=${r.json?.data?.id}`)
    else fail(`child_add_${name}`, `${r.status} ${r.text.slice(0,200)}`)
  }
  // soft archive + restore work
  const arch = await api(tokens.manager, 'POST', `/work/items/${workId}/archive`, {})
  if (arch.status === 200) pass('work_archive', 'ok')
  else fail('work_archive', `${arch.status} ${arch.text.slice(0,200)}`)
  const rest = await api(tokens.manager, 'POST', `/work/items/${workId}/restore`, {})
  if (rest.status === 200) pass('work_restore', 'ok')
  else fail('work_restore', `${rest.status} ${rest.text.slice(0,200)}`)
  // hard delete forbidden
  const hard = await api(tokens.manager, 'DELETE', `/work/items/${workId}`)
  if (hard.status === 403 || hard.status === 405 || hard.status === 501) pass('hard_delete_forbidden', `${hard.status}`)
  else fail('hard_delete_forbidden', `expected forbidden got ${hard.status} ${hard.text.slice(0,250)}`)
}

console.log('\n=== ACTIVITY / AUDIT / DASHBOARD / SEARCH ===')
if (workId && tokens.manager) {
  const act = await api(tokens.manager, 'GET', `/work/items/${workId}/activity`)
  if (act.status === 200) pass('activity', `n=${(act.json?.data||[]).length}`)
  else fail('activity', `${act.status}`)
  const aud = await api(tokens.manager, 'GET', `/work/items/${workId}/audit`)
  if (aud.status === 200) pass('audit', `n=${(aud.json?.data||[]).length}`)
  else fail('audit', `${aud.status}`)
}
for (const role of ['manager', 'ca', 'tl', 'emp']) {
  if (!tokens[role]) continue
  const d = await api(tokens[role], 'GET', '/work/dashboard')
  if (d.status === 200) pass(`dashboard_${role}`, JSON.stringify(d.json?.data||{}).slice(0,120))
  else fail(`dashboard_${role}`, `${d.status}`)
  const s = await api(tokens[role], 'GET', '/work/search?q=GST')
  if (s.status === 200) pass(`search_${role}`, `n=${(s.json?.data||[]).length}`)
  else fail(`search_${role}`, `${s.status}`)
}

console.log('\n=== CORPORATE COMPANY_ID ===')
if (tokens.manager) {
  const noCo = await api(tokens.manager, 'POST', '/work/items', {
    title: 'Corporate GST without company',
    priority: 'high',
    workType: 'GSTR1',
    clientId: 'CLI-0001',
    periodKey: '2026-07',
    riskClass: 'medium',
  })
  // Architecture: corporate GST requires company_id
  if (noCo.status === 400 || noCo.status === 422) pass('corporate_requires_company', `${noCo.status}`)
  else fail('corporate_requires_company', `expected 400 got ${noCo.status} ${noCo.text.slice(0,250)}`)
}

console.log('\n=== ENGAGEMENTS ===')
if (tokens.manager) {
  const eg = await api(tokens.manager, 'POST', '/work/engagements', {
    clientId: 'CLI-0001',
    ownerCaId: users.ca?.id || 'WM-CA-0001',
    title: 'QA Retainer',
    services: ['GST', 'ITR'],
  })
  if (eg.status === 200 || eg.status === 201) pass('engagement_create', `id=${eg.json?.data?.id}`)
  else fail('engagement_create', `${eg.status} ${eg.text.slice(0,250)}`)
  const el = await api(tokens.manager, 'GET', '/work/engagements')
  if (el.status === 200) pass('engagement_list', `n=${(el.json?.data||[]).length}`)
  else fail('engagement_list', `${el.status}`)
}

console.log('\n=== ASSIGN SLOT ===')
if (workId && tokens.manager) {
  const as = await api(tokens.manager, 'POST', `/work/items/${workId}/assign`, {
    slot: 'assignee',
    userId: 'WM-EMP-0002',
    userName: 'Employee 2',
    userRole: 'employee',
  })
  if (as.status === 200) pass('assign_slot', 'ok')
  else fail('assign_slot', `${as.status} ${as.text.slice(0,250)}`)
}

console.log('\n=== PERMISSIONS ON LOGIN ===')
for (const [role, u] of Object.entries(users)) {
  const perms = u?.permissions || []
  const hasCreate = perms.includes('work.create')
  const hasAssign = perms.includes('work.assign')
  const hasTl = perms.includes('work.verify.tl')
  const hasCa = perms.includes('work.verify.ca')
  const hasClose = perms.includes('work.close.manager') || perms.includes('work.close.partner')
  pass(`perms_${role}`, `create=${hasCreate} assign=${hasAssign} tl=${hasTl} ca=${hasCa} close=${hasClose} count=${perms.length}`)
  if (role === 'hr' && (hasCreate || hasAssign)) fail(`perms_hr_leak`, `HR has create=${hasCreate} assign=${hasAssign}`)
  if (role === 'emp' && hasCreate) fail(`perms_emp_leak`, 'Employee has work.create')
  if (role === 'article' && hasTl) fail(`perms_article_tl_leak`, 'Article has work.verify.tl')
}

// UI screenshots
console.log('\n=== UI SCREENSHOTS ===')
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await context.newPage()
const uiErrors = []
page.on('pageerror', (e) => uiErrors.push(String(e)))
page.on('console', (m) => { if (m.type() === 'error') uiErrors.push(m.text()) })

async function uiLogin(email) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.locator('input:not([type="checkbox"]):not([type="password"])').first().fill(email)
  await page.locator('input[type="password"]').fill(PASSWORD)
  await page.getByRole('button', { name: /sign in|login/i }).click()
  await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 25000 })
}

const screens = [
  ['/work', 'work_list'],
  ['/work/board', 'work_board'],
  ['/work/intake', 'work_intake'],
  ['/work/dashboard', 'work_dashboard'],
]
try {
  await uiLogin(accounts.manager)
  for (const [route, name] of screens) {
    await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(1500)
    const shot = path.join(OUT_DIR, `manager_${name}.png`)
    await page.screenshot({ path: shot, fullPage: true })
    pass(`ui_${name}`, shot)
    // empty/error signals
    const bodyText = await page.locator('body').innerText()
    if (/something went wrong|error|failed to load|unauthorized/i.test(bodyText) && !/0 works|no work/i.test(bodyText)) {
      note('UI_ERROR_SIGNAL', 'High', `Error-like text on ${route}`, bodyText.slice(0, 200))
    }
  }
  if (workId) {
    await page.goto(`${BASE}/work/${workId}`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(1500)
    const shot = path.join(OUT_DIR, 'manager_work_detail.png')
    await page.screenshot({ path: shot, fullPage: true })
    pass('ui_work_detail', shot)
  }
  // Employee create button should not exist
  await uiLogin(accounts.emp)
  await page.goto(`${BASE}/work`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(1000)
  await page.screenshot({ path: path.join(OUT_DIR, 'emp_work_list.png'), fullPage: true })
  const createBtn = page.getByRole('button', { name: /new work|create|add work/i })
  const createVisible = await createBtn.count().then(async (c) => c > 0 && await createBtn.first().isVisible().catch(() => false))
  if (!createVisible) pass('ui_emp_no_create_button', 'hidden')
  else fail('ui_emp_no_create_button', 'Create button visible for employee')

  // HR should not access work
  await uiLogin(accounts.hr)
  await page.goto(`${BASE}/work`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(1000)
  await page.screenshot({ path: path.join(OUT_DIR, 'hr_work_attempt.png'), fullPage: true })
  const url = page.url()
  if (/unauthorized|login|dashboard/i.test(url) || !(await page.locator('text=/work items|all works/i').count())) {
    pass('ui_hr_work_blocked', `url=${url}`)
  } else {
    fail('ui_hr_work_blocked', `HR reached work UI url=${url}`)
  }
} catch (e) {
  fail('ui_suite', String(e))
}
await browser.close()

if (uiErrors.length) {
  note('UI_CONSOLE_ERRORS', 'Medium', 'Browser console/page errors', uiErrors.slice(0, 10).join(' | '))
}

const summary = {
  pass: findings.filter((f) => f.severity === 'PASS').length,
  fail: findings.filter((f) => f.severity === 'FAIL').length,
  notes: findings.filter((f) => !['PASS', 'FAIL'].includes(f.severity)).length,
  workId,
  findings,
}
fs.writeFileSync(path.join(OUT_DIR, 'results.json'), JSON.stringify(summary, null, 2))
console.log('\n=== SUMMARY ===')
console.log(JSON.stringify({ pass: summary.pass, fail: summary.fail, notes: summary.notes, workId }, null, 2))
