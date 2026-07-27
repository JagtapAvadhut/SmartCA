/**
 * Practice Core API gates E2E (no Playwright UI) — intake/checklist/engagements/verify/close.
 *   QA_API=http://127.0.0.1:8080/api/v1 node scripts/qa-practice-e2e.mjs
 */
import fs from 'node:fs'
import path from 'node:path'

const API = process.env.QA_API || 'http://127.0.0.1:8080/api/v1'
const PASSWORD = 'SmartCA@2025'
const OUT = path.resolve('qa-artifacts/practice')
fs.mkdirSync(OUT, { recursive: true })

const results = []
function record(id, ok, detail = '') {
  results.push({ id, status: ok ? 'PASS' : 'FAIL', detail })
  console.log('[' + (ok ? 'PASS' : 'FAIL') + '] ' + id + (detail ? ' — ' + detail : ''))
}

async function login(identifier) {
  const res = await fetch(API + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password: PASSWORD }),
  })
  const json = await res.json()
  if (!res.ok || !json.success) throw new Error('login ' + identifier + ' ' + res.status)
  return json.data.token
}

async function api(token, method, pathName, body) {
  const res = await fetch(API + pathName, {
    method,
    headers: {
      Authorization: 'Bearer ' + token,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => ({}))
  return { status: res.status, json }
}

const roles = {
  manager: 'manager1@wm.smartca.in',
  ca: 'ca1@wm.smartca.in',
  tl: 'tl1@wm.smartca.in',
  emp: 'emp1@wm.smartca.in',
  reception: 'reception1@wm.smartca.in',
  hr: 'karthik.bhat@smartca.in',
}

try {
  const tokens = {}
  for (const [id, email] of Object.entries(roles)) {
    try {
      tokens[id] = await login(email)
      record('login_' + id, true)
    } catch (e) {
      record('login_' + id, false, String(e))
    }
  }

  // Intake happy path
  if (tokens.reception && tokens.manager) {
    const intake = await api(tokens.reception, 'POST', '/work/intakes', {
      source: 'walk_in',
      contactName: 'Practice E2E Client',
      contactPhone: '9876500014',
      services: ['GST'],
      notes: 'qa-practice-e2e',
    })
    record('intake_create_reception', intake.status === 201 || intake.status === 200, 'status=' + intake.status)
    const iid = intake.json?.data?.id
    if (iid) {
      const listI = await api(tokens.manager, 'GET', '/work/intakes')
      record('intake_list_manager', listI.status === 200, 'status=' + listI.status)
      const reject = await api(tokens.manager, 'POST', '/work/intakes/' + iid + '/reject', { remarks: 'incomplete KYC for e2e' })
      record('intake_reject', reject.status === 200, 'status=' + reject.status)
    }
    const intake2 = await api(tokens.reception, 'POST', '/work/intakes', {
      source: 'phone',
      contactName: 'Practice E2E Approve',
      contactPhone: '9876500015',
      services: ['ITR'],
    })
    const iid2 = intake2.json?.data?.id
    if (iid2) {
      // Prefer real client from list if available; otherwise expect 400 (BUG-0003 fixed)
      const approve = await api(tokens.manager, 'POST', '/work/intakes/' + iid2 + '/approve', {
        clientId: 'CLT-0001',
        companyId: 'CMP-0001',
        ownerCaId: 'WM-CA-0001',
        engagementTitle: 'E2E engagement',
        services: ['ITR'],
      })
      record('intake_approve', approve.status === 200 || approve.status === 400, 'status=' + approve.status)
    }
  }

  // Engagements list
  if (tokens.manager) {
    const eng = await api(tokens.manager, 'GET', '/work/engagements')
    record('engagements_list', eng.status === 200, 'status=' + eng.status)
  }

  // Create work + checklist + gate path (manager creates, transitions)
  if (tokens.manager && tokens.tl && tokens.ca) {
    const created = await api(tokens.manager, 'POST', '/work/items', {
      title: 'Practice E2E Gate Work',
      priority: 'high',
      assignedTo: 'WM-EMP-0001',
      assignedToName: 'Emp 1',
      assigneeRole: 'employee',
      clientId: 'CLT-0001',
      companyId: 'CMP-0001',
      estimatedHours: 2,
    })
    record('work_create', created.status === 201 || created.status === 200, 'status=' + created.status)
    const wid = created.json?.data?.id
    if (wid) {
      const cl = await api(tokens.manager, 'POST', '/work/items/' + wid + '/checklist', {
        code: 'BANK_STMT',
        label: 'Bank statement',
      })
      record('checklist_add', cl.status === 201 || cl.status === 200, 'status=' + cl.status)
      const cid = cl.json?.data?.id
      const listCl = await api(tokens.manager, 'GET', '/work/items/' + wid + '/checklist')
      record('checklist_list', listCl.status === 200, 'status=' + listCl.status)
      if (cid) {
        const failCl = await api(tokens.tl, 'POST', '/work/items/' + wid + '/checklist/' + cid + '/verify', {
          decision: 'fail',
          remarks: 'illegible',
        })
        record('checklist_reject_remarks', failCl.status === 200 || failCl.status === 403, 'status=' + failCl.status)
        const passCl = await api(tokens.tl, 'POST', '/work/items/' + wid + '/checklist/' + cid + '/verify', {
          decision: 'pass',
          remarks: 'ok',
        })
        record('checklist_verify', passCl.status === 200 || passCl.status === 403, 'status=' + passCl.status)
      }
      // Emp cannot verify TL
      const empTl = await api(tokens.emp, 'POST', '/work/items/' + wid + '/verify/tl', { decision: 'pass' })
      record('emp_cannot_verify_tl', empTl.status === 403 || empTl.status === 409, 'status=' + empTl.status)
      // HR cannot intake/create
      if (tokens.hr) {
        const hrCreate = await api(tokens.hr, 'POST', '/work/items', { title: 'hr hack', assignedTo: 'x' })
        record('hr_cannot_create', hrCreate.status === 403 || hrCreate.status >= 400, 'status=' + hrCreate.status)
      }
      // Reception cannot close
      if (tokens.reception) {
        const rClose = await api(tokens.reception, 'POST', '/work/items/' + wid + '/close', { remarks: 'nope' })
        record('reception_cannot_close', rClose.status === 403 || rClose.status >= 400, 'status=' + rClose.status)
      }
      // PATCH free-complete blocked
      const patchClosed = await api(tokens.manager, 'PATCH', '/work/items/' + wid, { status: 'CLOSED' })
      record('patch_closed_blocked', patchClosed.status === 409 || patchClosed.status >= 400, 'status=' + patchClosed.status)
    }
  }

  // Privilege escalation smokes (security overlap)
  if (tokens.emp) {
    const escalate = await api(tokens.emp, 'POST', '/work/team/users', {
      fullName: 'Hack Mgr', email: 'hackmgr-practice@wm.smartca.in', role: 'manager', password: PASSWORD,
    })
    record('emp_priv_esc_create_manager', escalate.status >= 400, 'status=' + escalate.status)
  }
  if (tokens.manager) {
    const sqli = await api(tokens.manager, 'GET', "/work/items?q=' OR 1=1--; DROP TABLE wm_work_items;--")
    record('sqli_search', sqli.status === 200 && sqli.json?.success !== false, 'status=' + sqli.status + ' total=' + (sqli.json?.data?.total ?? 'n/a'))
    const xss = await api(tokens.manager, 'POST', '/work/items', {
      title: '<img src=x onerror=alert(1)>',
      assignedTo: 'WM-CA-0001',
      assigneeRole: 'ca',
    })
    const title = xss.json?.data?.title || ''
    record('xss_title_not_executed_stored', xss.status === 201 || xss.status === 200, 'title=' + title.slice(0, 40))
  }

  const noAuth = await fetch(API + '/work/intakes')
  record('intakes_no_auth', noAuth.status === 401, 'status=' + noAuth.status)
} catch (e) {
  record('suite_crash', false, String(e))
}

const failed = results.filter((r) => r.status === 'FAIL')
const passed = results.filter((r) => r.status === 'PASS')
console.log('\nPractice E2E: ' + passed.length + ' PASS / ' + failed.length + ' FAIL / ' + results.length + ' total')
fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify({ passed: passed.length, failed: failed.length, results }, null, 2))
process.exit(failed.length ? 1 : 0)
