import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto('http://localhost:5173/login')
await page.evaluate(() => localStorage.clear())
await page.goto('http://localhost:5173/login')
await page.locator('input[name="identifier"]').fill('rajesh.sharma@smartca.in')
await page.locator('input[name="password"]').fill('SmartCA@2025')
await page.getByRole('button', { name: /sign in/i }).click()
await page.waitForURL((u) => !u.pathname.includes('login'))
await page.goto('http://localhost:5173/clients')
await page.getByRole('button', { name: /Add Client/i }).click()
await page.waitForTimeout(500)

const unique = Date.now().toString().slice(-6)
const pan = `QACLI${unique.slice(0, 4)}Z`
const gstin = `27${pan}1Z5`
console.log({ unique, pan, gstin, panLen: pan.length, gstinLen: gstin.length })

async function fill(label, val) {
  const byLabel = page.getByLabel(label, { exact: false })
  const c = await byLabel.count()
  console.log('fill', label, 'count', c)
  if (c) {
    await byLabel.first().fill(val)
    return
  }
  // Input component: label + input without htmlFor always?
  const block = page.locator('div.w-full').filter({ has: page.locator('label', { hasText: new RegExp(`^${label}`) }) }).first()
  const input = block.locator('input, textarea, select').first()
  console.log('  fallback', await input.count())
  await input.fill(val)
}

await fill('Client Name', `QA Client ${unique}`)
await fill('Contact Person', 'QA Contact')
await fill('Email', `qa.${unique}@example.com`)
await fill('Phone', '9876543210')
await fill('PAN', pan)
await fill('GSTIN', gstin)
await fill('City', 'Mumbai')
await fill('State', 'Maharashtra')

const typeSel = page.locator('select[name="type"]')
if (await typeSel.count()) await typeSel.selectOption('company')
const statusSel = page.locator('select[name="status"]')
if (await statusSel.count()) await statusSel.selectOption('active')

// dump values
const values = await page.evaluate(() => {
  return [...document.querySelectorAll('[role=dialog] input, [role=dialog] select, [role=dialog] textarea')].map((el) => ({
    name: el.getAttribute('name'),
    value: el.value,
  }))
})
console.log('form values', values)

await page.getByRole('button', { name: /Create Client/i }).click()
await page.waitForTimeout(2000)
const errs = await page.locator('[role=dialog] .text-red-500, [role=dialog] p.text-xs').allTextContents()
console.log('errors', errs)
console.log('toast', await page.locator('div').filter({ hasText: /Client created|failed|required|Invalid/i }).first().textContent().catch(() => 'none'))
console.log('client visible', await page.getByText(`QA Client ${unique}`).count())
console.log('dialog count', await page.locator('[role=dialog]').count())
await page.screenshot({ path: 'qa-client-debug.png', fullPage: true })
await browser.close()
