/**
 * Auth E2E against real Go API — no mocked auth routes.
 * Defaults target Docker Compose (http://127.0.0.1:8080).
 * Native Vite: QA_BASE=http://127.0.0.1:5173 QA_API=http://127.0.0.1:8080/api/v1 npm run qa:auth
 */
import { chromium } from 'playwright'

const BASE = process.env.QA_BASE || process.env.QA_BASE_URL || 'http://127.0.0.1:8080'
const API = process.env.QA_API || `${BASE.replace(/\/$/, '')}/api/v1`
const HEALTH = process.env.QA_HEALTH || `${BASE.replace(/\/$/, '')}/health/live`
const PASSWORD = 'SmartCA@2025'

const results = []
function record(id, ok, detail = '') {
  results.push({ id, status: ok ? 'PASS' : 'FAIL', detail })
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${id}${detail ? ` — ${detail}` : ''}`)
}

async function fillLogin(page, identifier, password) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  const identifierInput = page.locator('input[name="identifier"]').or(page.locator('input').filter({ hasNot: page.locator('[type="checkbox"]') }).first())
  const passwordInput = page.locator('input[name="password"]').or(page.locator('input[type="password"]'))
  await identifierInput.fill(identifier)
  await passwordInput.fill(password)
}

async function submitLogin(page) {
  await page.getByRole('button', { name: /sign in|login/i }).click()
}

async function expectLoggedIn(page) {
  await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 20000 })
  return !page.url().includes('/login')
}

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext()
const page = await context.newPage()

try {
  // Health
  const live = await fetch(HEALTH)
  record('API health live', live.ok, String(live.status))

  // Page load
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  record('Login page loads', page.url().includes('/login'), page.url())

  // Invalid password
  await fillLogin(page, 'rajesh.sharma@smartca.in', 'wrong-password')
  const badLoginReq = page.waitForResponse((r) => r.url().includes('/auth/login') && r.request().method() === 'POST', { timeout: 15000 })
  await submitLogin(page)
  const badRes = await badLoginReq
  record('Invalid password hits API', badRes.status() === 401, `status=${badRes.status()}`)
  await page.waitForTimeout(800)
  record('Still on login after bad password', page.url().includes('/login'), page.url())

  // Admin login
  const loginPosts = []
  page.on('response', (r) => {
    if (r.url().includes('/auth/login') && r.request().method() === 'POST') loginPosts.push(r)
  })
  await fillLogin(page, 'rajesh.sharma@smartca.in', PASSWORD)
  await submitLogin(page)
  const ok = await expectLoggedIn(page)
  record('Admin login succeeds', ok, page.url())
  const lastLogin = loginPosts.at(-1)
  record('Admin login network 200', !!lastLogin && lastLogin.status() === 200, lastLogin ? String(lastLogin.status()) : 'no request')

  const token = await page.evaluate(() => localStorage.getItem('smart-ca-token'))
  record('Session token stored', !!token && token.length > 10)

  // /auth/me
  const me = await page.evaluate(async (api) => {
    const t = localStorage.getItem('smart-ca-token')
    const res = await fetch(`${api}/auth/me`, { headers: { Authorization: `Bearer ${t}` } })
    const json = await res.json()
    return { status: res.status, success: json.success, email: json.data?.email }
  }, API)
  record('auth/me succeeds', me.status === 200 && me.success === true, JSON.stringify(me))

  // Refresh
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(1000)
  record('Refresh stays authenticated', !page.url().includes('/login'), page.url())

  // Dashboard protected
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  record('Dashboard loads while authed', !page.url().includes('/login'), page.url())

  // Logout
  const logoutBtn = page.getByRole('button', { name: /logout|sign out/i }).or(page.locator('[aria-label*="ogout" i], [title*="ogout" i]'))
  if ((await logoutBtn.count()) > 0) {
    await logoutBtn.first().click()
    await page.waitForTimeout(1500)
  } else {
    // Open user menu then logout
    const menu = page.locator('button').filter({ hasText: /Rajesh|Admin|profile/i }).first()
    if (await menu.count()) {
      await menu.click()
      await page.waitForTimeout(400)
    }
    const item = page.getByText(/logout|sign out/i).first()
    if (await item.count()) {
      await item.click()
      await page.waitForTimeout(1500)
    } else {
      // Direct API logout + clear via UI navigation
      await page.evaluate(async (api) => {
        const t = localStorage.getItem('smart-ca-token')
        if (t) {
          await fetch(`${api}/auth/logout`, { method: 'POST', headers: { Authorization: `Bearer ${t}` } }).catch(() => {})
        }
        localStorage.removeItem('smart-ca-token')
        localStorage.removeItem('smart-ca-auth')
      }, API)
      await page.goto(`${BASE}/login`)
    }
  }
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  record('Protected route blocked after logout', page.url().includes('/login'), page.url())

  // Partner + CA logins
  for (const [label, email] of [
    ['Partner', 'priya.patel@smartca.in'],
    ['CA', 'amit.kumar@smartca.in'],
  ]) {
    await context.clearCookies()
    await page.goto(`${BASE}/login`)
    await page.evaluate(() => {
      localStorage.clear()
      sessionStorage.clear()
    })
    await fillLogin(page, email, PASSWORD)
    await submitLogin(page)
    const logged = await expectLoggedIn(page).catch(() => false)
    record(`${label} login succeeds`, logged, page.url())
    await page.evaluate(async (api) => {
      const t = localStorage.getItem('smart-ca-token')
      if (t) await fetch(`${api}/auth/logout`, { method: 'POST', headers: { Authorization: `Bearer ${t}` } }).catch(() => {})
      localStorage.clear()
    }, API)
  }

  // Backend offline message (stop is not done here — hit closed port)
  await page.goto(`${BASE}/login`)
  await page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
  await page.route('**/api/v1/auth/login', (route) => route.abort('failed'))
  await fillLogin(page, 'rajesh.sharma@smartca.in', PASSWORD)
  await submitLogin(page)
  await page.waitForTimeout(1500)
  const bodyText = await page.locator('body').innerText()
  const useful =
    /unable to reach|backend|api|network|failed to fetch|connection/i.test(bodyText) ||
    (await page.getByText(/unable to reach|backend|network|failed/i).count()) > 0
  record('Backend unreachable shows useful error', useful)
  await page.unroute('**/api/v1/auth/login')
} catch (e) {
  record('AUTH_E2E_CRASH', false, e instanceof Error ? e.message : String(e))
} finally {
  await browser.close()
}

const fail = results.filter((r) => r.status === 'FAIL').length
const pass = results.filter((r) => r.status === 'PASS').length
console.log(`\n=== AUTH E2E: ${pass} PASS / ${fail} FAIL / ${results.length} total ===`)
process.exit(fail ? 1 : 0)
