/**
 * Capture demo screenshots for README (no sensitive PII beyond mock demo data).
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.QA_BASE_URL || 'http://localhost:5173'
const OUT = path.resolve('docs/screenshots')

fs.mkdirSync(OUT, { recursive: true })

async function shot(page, name, fullPage = false) {
  const file = path.join(OUT, `${name}.png`)
  await page.screenshot({ path: file, fullPage })
  console.log('saved', file)
}

async function run() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

  await page.goto(`${BASE}/login`)
  await page.evaluate(() => localStorage.clear())
  await page.goto(`${BASE}/login`)
  await page.waitForTimeout(600)
  await shot(page, '01-login')

  await page.locator('input[name="identifier"]').fill('rajesh.sharma@smartca.in')
  await page.locator('input[name="password"]').fill('SmartCA@2025')
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL((u) => !u.pathname.includes('login'))
  await page.waitForTimeout(1200)
  await shot(page, '02-dashboard')

  await page.goto(`${BASE}/clients`)
  await page.waitForTimeout(800)
  await shot(page, '03-clients')

  const firstLink = page.locator('a[href^="/clients/"], button[title="View"]').first()
  if (await firstLink.count()) {
    await firstLink.click()
    await page.waitForTimeout(1000)
    await shot(page, '04-client-details')
  } else {
    // fallback navigate first row view if link exists in table
    await page.goto(`${BASE}/clients`)
    await page.waitForTimeout(500)
    const viewBtn = page.getByRole('button', { name: /view/i }).first()
    if (await viewBtn.count()) {
      await viewBtn.click()
      await page.waitForTimeout(1000)
    }
    await shot(page, '04-client-details')
  }

  await page.goto(`${BASE}/documents`)
  await page.waitForTimeout(800)
  await shot(page, '05-documents')

  await page.goto(`${BASE}/calendar`)
  await page.waitForTimeout(800)
  await shot(page, '06-calendar')

  await page.goto(`${BASE}/accounting`)
  await page.waitForTimeout(800)
  await shot(page, '07-accounting')

  await page.goto(`${BASE}/reports`)
  await page.waitForTimeout(1000)
  await shot(page, '08-reports')

  await page.goto(`${BASE}/settings`)
  await page.waitForTimeout(800)
  await shot(page, '09-settings')

  await page.goto(`${BASE}/settings?tab=notifications`)
  await page.waitForTimeout(600)
  await page.getByRole('button', { name: /^Notifications$/i }).click().catch(() => {})
  await page.waitForTimeout(500)
  const firstSwitch = page.getByRole('switch').first()
  if (await firstSwitch.count()) {
    if ((await firstSwitch.getAttribute('aria-checked')) === 'true') await firstSwitch.click()
    await page.waitForTimeout(200)
    await shot(page, '11-switch-light-off')
    await firstSwitch.click()
    await page.waitForTimeout(200)
    await shot(page, '12-switch-light-on')
  }

  await page.getByRole('button', { name: /theme/i }).click()
  await page.getByRole('button', { name: /^Dark$/i }).click()
  await page.waitForTimeout(500)
  await page.goto(`${BASE}/settings?tab=notifications`)
  await page.waitForTimeout(600)
  await page.getByRole('button', { name: /^Notifications$/i }).click().catch(() => {})
  await page.waitForTimeout(400)
  const darkSwitch = page.getByRole('switch').first()
  if (await darkSwitch.count()) {
    if ((await darkSwitch.getAttribute('aria-checked')) === 'true') await darkSwitch.click()
    await page.waitForTimeout(200)
    await shot(page, '13-switch-dark-off')
    await darkSwitch.click()
    await page.waitForTimeout(200)
    await shot(page, '14-switch-dark-on')
  }

  await page.goto(`${BASE}/`)
  await page.waitForTimeout(800)
  await shot(page, '10-dashboard-dark')

  await browser.close()
  console.log('Screenshots complete')
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
