/**
 * Capture real, fully-loaded screenshots of the running application for the
 * repository README (docs/screenshots/). No mock/demo data beyond the seeded
 * PostgreSQL data; no sensitive PII.
 *
 * Requires the Go API (native, PostgreSQL-backed) and the Vite dev server to
 * already be running:
 *   cd Go   && go run ./cmd/api
 *   cd saas && npm run dev
 *
 * Usage:
 *   node scripts/capture-screenshots.mjs
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BASE = process.env.QA_BASE_URL || 'http://localhost:5173'
// Always resolve relative to the repo root (saas/scripts/.. /.. /docs/screenshots),
// regardless of the shell's current working directory.
const OUT = path.resolve(__dirname, '../../docs/screenshots')
const DESKTOP = { width: 1440, height: 900 }
const TABLET = { width: 834, height: 1194 }
const MOBILE = { width: 390, height: 844 }

fs.mkdirSync(OUT, { recursive: true })

async function shot(page, name) {
  const file = path.join(OUT, `${name}.png`)
  await page.screenshot({ path: file, fullPage: false })
  console.log('saved', file)
}

/** Wait until the page is idle and no skeleton/loading placeholders remain. */
async function settle(page, timeout = 15000) {
  await page.waitForLoadState('networkidle', { timeout }).catch(() => {})
  try {
    await page.waitForFunction(
      () => document.querySelectorAll('.animate-pulse, [aria-busy="true"]').length === 0,
      { timeout },
    )
  } catch {
    // continue — some pages legitimately keep a pulsing badge; visual check happens after.
  }
  await page.waitForTimeout(500)
}

async function goto(page, pathname) {
  await page.goto(`${BASE}${pathname}`, { waitUntil: 'domcontentloaded' })
  await settle(page)
}

async function run() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: DESKTOP })

  // ---- Login (unauthenticated) ----
  await page.goto(`${BASE}/login`)
  await page.evaluate(() => localStorage.clear())
  await page.goto(`${BASE}/login`)
  await settle(page)
  await shot(page, 'login')

  await page.locator('input[name="identifier"]').fill('rajesh.sharma@smartca.in')
  await page.locator('input[name="password"]').fill('SmartCA@2025')
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 15000 })
  await settle(page)

  // Force Light theme for the main feature screenshots (consistent, README-friendly).
  await page.getByRole('button', { name: /theme/i }).click()
  await page.getByRole('button', { name: /^Light$/i }).click()
  await page.waitForTimeout(3400) // let the "theme applied" toast auto-dismiss

  // ---- Core pages (light mode) ----
  const pages = [
    ['/', 'dashboard'],
    ['/clients', 'clients'],
    ['/companies', 'companies'],
    ['/invoices', 'invoices'],
    ['/payments', 'payments'],
    ['/compliance', 'compliance'],
    ['/compliance/gst', 'gst'],
    ['/compliance/itr', 'itr'],
    ['/compliance/tds', 'tds'],
    ['/compliance/roc', 'roc'],
    ['/accounting', 'accounting'],
    ['/reports', 'reports'],
    ['/documents', 'documents'],
    ['/calendar', 'calendar'],
    ['/tasks', 'tasks'],
    ['/employees', 'employees'],
    ['/ai', 'ai-assistant'],
    ['/settings', 'settings'],
  ]

  for (const [route, name] of pages) {
    await goto(page, route)
    await shot(page, name)
  }

  // ---- Light mode explicit shot (dashboard, already in Light from above) ----
  await goto(page, '/')
  await shot(page, 'light-mode')

  // ---- Dark mode explicit shot (dashboard, theme menu forced to Dark) ----
  await page.getByRole('button', { name: /theme/i }).click()
  await page.getByRole('button', { name: /^Dark$/i }).click()
  await page.waitForTimeout(3400) // let the "theme applied" toast auto-dismiss
  await shot(page, 'dark-mode')

  // Back to light for consistent responsive captures below.
  await page.getByRole('button', { name: /theme/i }).click()
  await page.getByRole('button', { name: /^Light$/i }).click()
  await page.waitForTimeout(3400)

  // ---- Responsive: tablet ----
  await page.setViewportSize(TABLET)
  await goto(page, '/')
  await shot(page, 'responsive-tablet')

  // ---- Responsive: mobile ----
  await page.setViewportSize(MOBILE)
  await goto(page, '/')
  await shot(page, 'responsive-mobile')

  await browser.close()
  console.log(`Screenshots complete -> ${OUT}`)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
