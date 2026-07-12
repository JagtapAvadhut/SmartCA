/**
 * Deterministic business-logic QA.
 * Asserts EXACT expected values via window.__SMART_CA_QA__ (not "value changed").
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.QA_BASE_URL || 'http://localhost:5173'
const OUT = path.resolve('business-qa-results.json')

const results = []

function record(testName, input, expected, actual, status, detail = '') {
  const row = { testName, input, expected, actual, status, detail, at: new Date().toISOString() }
  results.push(row)
  console.log(`[${status}] ${testName}${detail ? ' — ' + detail : ''}`)
  if (status === 'FAIL') {
    console.log('  expected:', JSON.stringify(expected))
    console.log('  actual  :', JSON.stringify(actual))
  }
}

function eq(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < 0.001
  return JSON.stringify(a) === JSON.stringify(b)
}

async function login(page) {
  await page.goto(`${BASE}/login`)
  await page.evaluate(() => localStorage.clear())
  await page.goto(`${BASE}/login`)
  await page.locator('input[name="identifier"]').fill('rajesh.sharma@smartca.in')
  await page.locator('input[name="password"]').fill('SmartCA@2025')
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL((u) => !u.pathname.includes('login'))
  await page.waitForFunction(() => !!window.__SMART_CA_QA__, null, { timeout: 15000 })
}

async function qa(page, fn, arg) {
  return page.evaluate(fn, arg)
}

async function run() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await login(page)

  // Fresh books for isolation: repair derived, then run scenario on NEW client only (don't wipe entire DB —
  // resetDatabase would break auth). We isolate by unique client and delta outstanding.
  const stamp = Date.now().toString().slice(-6)
  const pan = `QABIZ${stamp.slice(0, 4)}Z`
  const gstin = `27${pan}1Z5`

  // ---------- SCENARIO 1: Exact outstanding chain ----------
  const s1 = await qa(page, async () => {
    const api = window.__SMART_CA_QA__
    const before = api.readOutstanding()
    const client = await api.ClientService.create({
      name: `BizQA Client ${Date.now().toString().slice(-6)}`,
      contactPerson: 'Biz QA',
      email: `bizqa.${Date.now()}@example.com`,
      phone: '9876543210',
      pan: `QA${String(Date.now()).slice(-7)}Z`.slice(0, 10).replace(/[^A-Z0-9]/g, 'A'),
      gstin: '',
      type: 'company',
      status: 'active',
      city: 'Mumbai',
      state: 'Maharashtra',
    })
    // fix pan/gstin properly after create if needed - recreate with valid
    return { beforeDash: before.dashboard, clientId: client.id, clientOutstanding: client.outstanding }
  }).catch((e) => ({ error: e.message }))

  // Create with valid PAN via evaluate carefully
  const scenario = await qa(page, async ({ stamp, pan, gstin }) => {
    const api = window.__SMART_CA_QA__
    const beforeDash = api.computeDashboard().kpis.outstanding.value

    const client = await api.ClientService.create({
      name: `BizQA Client ${stamp}`,
      contactPerson: 'Biz QA',
      email: `bizqa.${stamp}@example.com`,
      phone: '9876543210',
      pan,
      gstin,
      type: 'company',
      status: 'active',
      city: 'Mumbai',
      state: 'Maharashtra',
    })

    const afterClient = api.getClient(client.id)
    const dashAfterClient = api.computeDashboard().kpis.outstanding.value

    // Invoice total EXACTLY 100000 (explicit tax breakdown, no auto GST bump)
    const inv = await api.InvoiceService.create({
      clientId: client.id,
      clientName: client.name,
      subtotal: 100000,
      cgst: 0,
      sgst: 0,
      igst: 0,
      total: 100000,
      status: 'sent',
      paidAmount: 0,
    })

    const inv1 = api.getInvoice(inv.id)
    const clientAfterInv = api.getClient(client.id)
    const dashAfterInv = api.computeDashboard().kpis.outstanding.value

    const pay1 = await api.PaymentService.create({
      clientId: client.id,
      clientName: client.name,
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      amount: 30000,
      status: 'completed',
      reference: `BIZ-P1-${stamp}`,
      method: 'upi',
      paymentDate: new Date().toISOString().split('T')[0],
    })

    const invAfterP1 = api.getInvoice(inv.id)
    const clientAfterP1 = api.getClient(client.id)
    const dashAfterP1 = api.computeDashboard().kpis.outstanding.value

    const pay2 = await api.PaymentService.create({
      clientId: client.id,
      clientName: client.name,
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      amount: 70000,
      status: 'completed',
      reference: `BIZ-P2-${stamp}`,
      method: 'neft',
      paymentDate: new Date().toISOString().split('T')[0],
    })

    const invAfterP2 = api.getInvoice(inv.id)
    const clientAfterP2 = api.getClient(client.id)
    const dashAfterP2 = api.computeDashboard().kpis.outstanding.value

    await api.PaymentService.delete(pay2.id)
    const invAfterDelP2 = api.getInvoice(inv.id)
    const clientAfterDelP2 = api.getClient(client.id)
    const dashAfterDelP2 = api.computeDashboard().kpis.outstanding.value

    await api.PaymentService.delete(pay1.id)
    const invAfterDelP1 = api.getInvoice(inv.id)
    const clientAfterDelP1 = api.getClient(client.id)
    const dashAfterDelP1 = api.computeDashboard().kpis.outstanding.value

    await api.InvoiceService.delete(inv.id)
    const clientAfterDelInv = api.getClient(client.id)
    const dashAfterDelInv = api.computeDashboard().kpis.outstanding.value

    return {
      beforeDash,
      dashAfterClient,
      clientId: client.id,
      afterClientOutstanding: afterClient?.outstanding,
      inv: { id: inv.id, total: inv1?.total, paid: inv1?.paidAmount, rem: inv1?.remainingAmount, status: inv1?.status },
      clientAfterInv: clientAfterInv?.outstanding,
      dashAfterInv,
      invAfterP1: { paid: invAfterP1?.paidAmount, rem: invAfterP1?.remainingAmount, status: invAfterP1?.status },
      clientAfterP1: clientAfterP1?.outstanding,
      dashAfterP1,
      invAfterP2: { paid: invAfterP2?.paidAmount, rem: invAfterP2?.remainingAmount, status: invAfterP2?.status },
      clientAfterP2: clientAfterP2?.outstanding,
      dashAfterP2,
      invAfterDelP2: { paid: invAfterDelP2?.paidAmount, rem: invAfterDelP2?.remainingAmount, status: invAfterDelP2?.status },
      clientAfterDelP2: clientAfterDelP2?.outstanding,
      dashAfterDelP2,
      invAfterDelP1: { paid: invAfterDelP1?.paidAmount, rem: invAfterDelP1?.remainingAmount, status: invAfterDelP1?.status },
      clientAfterDelP1: clientAfterDelP1?.outstanding,
      dashAfterDelP1,
      clientAfterDelInv: clientAfterDelInv?.outstanding,
      dashAfterDelInv,
      pay1Id: pay1.id,
      pay2Id: pay2.id,
    }
  }, { stamp, pan, gstin })

  // Assertions with EXACT deltas
  record(
    'S1 client create outstanding=0',
    { pan, gstin },
    0,
    scenario.afterClientOutstanding,
    eq(scenario.afterClientOutstanding, 0) ? 'PASS' : 'FAIL',
  )
  record(
    'S1 invoice create total=100000 paid=0 status=sent',
    { total: 100000 },
    { total: 100000, paid: 0, rem: 100000, status: 'sent' },
    scenario.inv,
    eq(scenario.inv?.total, 100000) && eq(scenario.inv?.paid, 0) && eq(scenario.inv?.rem, 100000) && scenario.inv?.status === 'sent'
      ? 'PASS'
      : 'FAIL',
  )
  record(
    'S1 client outstanding after invoice = 100000',
    {},
    100000,
    scenario.clientAfterInv,
    eq(scenario.clientAfterInv, 100000) ? 'PASS' : 'FAIL',
  )
  record(
    'S1 dashboard outstanding +100000 exactly',
    { before: scenario.beforeDash },
    scenario.beforeDash + 100000,
    scenario.dashAfterInv,
    eq(scenario.dashAfterInv, scenario.beforeDash + 100000) ? 'PASS' : 'FAIL',
  )
  record(
    'S1 payment 30000 → paid=30000 rem=70000 status=partially_paid',
    { amount: 30000 },
    { paid: 30000, rem: 70000, status: 'partially_paid' },
    scenario.invAfterP1,
    eq(scenario.invAfterP1?.paid, 30000) && eq(scenario.invAfterP1?.rem, 70000) && scenario.invAfterP1?.status === 'partially_paid'
      ? 'PASS'
      : 'FAIL',
  )
  record(
    'S1 client outstanding after P1 = 70000',
    {},
    70000,
    scenario.clientAfterP1,
    eq(scenario.clientAfterP1, 70000) ? 'PASS' : 'FAIL',
  )
  record(
    'S1 dashboard outstanding -30000 from post-invoice',
    {},
    scenario.dashAfterInv - 30000,
    scenario.dashAfterP1,
    eq(scenario.dashAfterP1, scenario.dashAfterInv - 30000) ? 'PASS' : 'FAIL',
  )
  record(
    'S1 payment 70000 → paid=100000 rem=0 status=paid',
    { amount: 70000 },
    { paid: 100000, rem: 0, status: 'paid' },
    scenario.invAfterP2,
    eq(scenario.invAfterP2?.paid, 100000) && eq(scenario.invAfterP2?.rem, 0) && scenario.invAfterP2?.status === 'paid'
      ? 'PASS'
      : 'FAIL',
  )
  record(
    'S1 client outstanding after full pay = 0',
    {},
    0,
    scenario.clientAfterP2,
    eq(scenario.clientAfterP2, 0) ? 'PASS' : 'FAIL',
  )
  record(
    'S1 delete P2 → partially_paid rem=70000',
    {},
    { paid: 30000, rem: 70000, status: 'partially_paid' },
    scenario.invAfterDelP2,
    eq(scenario.invAfterDelP2?.paid, 30000) && eq(scenario.invAfterDelP2?.rem, 70000) && scenario.invAfterDelP2?.status === 'partially_paid'
      ? 'PASS'
      : 'FAIL',
  )
  record(
    'S1 delete P1 → sent rem=100000',
    {},
    { paid: 0, rem: 100000, status: 'sent' },
    scenario.invAfterDelP1,
    eq(scenario.invAfterDelP1?.paid, 0) && eq(scenario.invAfterDelP1?.rem, 100000) && scenario.invAfterDelP1?.status === 'sent'
      ? 'PASS'
      : 'FAIL',
  )
  record(
    'S1 delete invoice → client outstanding 0',
    {},
    0,
    scenario.clientAfterDelInv,
    eq(scenario.clientAfterDelInv, 0) ? 'PASS' : 'FAIL',
  )
  record(
    'S1 delete invoice → dashboard restored to baseline',
    { before: scenario.beforeDash },
    scenario.beforeDash,
    scenario.dashAfterDelInv,
    eq(scenario.dashAfterDelInv, scenario.beforeDash) ? 'PASS' : 'FAIL',
  )

  // ---------- PAYMENT VALIDATION ----------
  const val = await qa(page, async ({ stamp, pan, gstin }) => {
    const api = window.__SMART_CA_QA__
    const client = await api.ClientService.create({
      name: `Val Client ${stamp}`,
      contactPerson: 'V',
      email: `val.${stamp}@example.com`,
      phone: '9876543210',
      pan: pan.replace('BIZ', 'VAL').slice(0, 10),
      gstin: gstin.replace('QABIZ', 'QAVAL').slice(0, 15),
      type: 'company',
      status: 'active',
      city: 'Pune',
      state: 'Maharashtra',
    })
    // may fail pan - use unique
    return client
  }, { stamp: stamp + '1', pan: `QAVAL${stamp.slice(0, 4)}Z`, gstin: `27QAVAL${stamp.slice(0, 4)}Z1Z5` }).catch((e) => ({ error: e.message }))

  const validations = await qa(page, async () => {
    const api = window.__SMART_CA_QA__
    const stamp = Date.now().toString().slice(-6)
    const pan = `QAVLD${stamp.slice(0, 4)}Z`
    const gstin = `27${pan}1Z5`
    const client = await api.ClientService.create({
      name: `Val ${stamp}`,
      contactPerson: 'V',
      email: `vald.${stamp}@example.com`,
      phone: '9876543210',
      pan,
      gstin,
      type: 'individual',
      status: 'active',
      city: 'Pune',
      state: 'Maharashtra',
    })
    const inv = await api.InvoiceService.create({
      clientId: client.id,
      clientName: client.name,
      subtotal: 10000,
      cgst: 0,
      sgst: 0,
      total: 10000,
      status: 'sent',
    })
    const results = {}
    try {
      await api.PaymentService.create({
        clientId: client.id, clientName: client.name, invoiceId: inv.id, invoiceNumber: inv.invoiceNumber,
        amount: 0, status: 'completed', reference: `Z-${stamp}`, method: 'cash', paymentDate: '2026-07-12',
      })
      results.zero = 'ALLOWED'
    } catch (e) {
      results.zero = e.message
    }
    try {
      await api.PaymentService.create({
        clientId: client.id, clientName: client.name, invoiceId: inv.id, invoiceNumber: inv.invoiceNumber,
        amount: -5, status: 'completed', reference: `N-${stamp}`, method: 'cash', paymentDate: '2026-07-12',
      })
      results.negative = 'ALLOWED'
    } catch (e) {
      results.negative = e.message
    }
    try {
      await api.PaymentService.create({
        clientId: client.id, clientName: client.name, invoiceId: inv.id, invoiceNumber: inv.invoiceNumber,
        amount: 15000, status: 'completed', reference: `O-${stamp}`, method: 'cash', paymentDate: '2026-07-12',
      })
      results.overpay = 'ALLOWED'
    } catch (e) {
      results.overpay = e.message
    }
    const okPay = await api.PaymentService.create({
      clientId: client.id, clientName: client.name, invoiceId: inv.id, invoiceNumber: inv.invoiceNumber,
      amount: 4000, status: 'completed', reference: `OK-${stamp}`, method: 'cash', paymentDate: '2026-07-12',
    })
    try {
      await api.PaymentService.create({
        clientId: client.id, clientName: client.name, invoiceId: inv.id, invoiceNumber: inv.invoiceNumber,
        amount: 1000, status: 'completed', reference: `OK-${stamp}`, method: 'cash', paymentDate: '2026-07-12',
      })
      results.dupRef = 'ALLOWED'
    } catch (e) {
      results.dupRef = e.message
    }
    // edit payment amount
    await api.PaymentService.update(okPay.id, { amount: 2500 })
    const afterEdit = api.getInvoice(inv.id)
    results.afterEditPaid = afterEdit.paidAmount
    results.afterEditRem = afterEdit.remainingAmount
    results.afterEditStatus = afterEdit.status
    return results
  })

  record('V1 reject zero payment', {}, true, /greater than zero|must be greater/i.test(validations.zero), /greater than zero|must be greater/i.test(validations.zero) ? 'PASS' : 'FAIL', validations.zero)
  record('V2 reject negative payment', {}, true, /greater than zero|negative|must be greater/i.test(validations.negative), /greater than zero|negative|must be greater/i.test(validations.negative) ? 'PASS' : 'FAIL', validations.negative)
  record('V3 reject overpay', {}, true, /exceeds remaining/i.test(validations.overpay), /exceeds remaining/i.test(validations.overpay) ? 'PASS' : 'FAIL', validations.overpay)
  record('V4 reject duplicate reference', {}, true, /duplicate/i.test(validations.dupRef), /duplicate/i.test(validations.dupRef) ? 'PASS' : 'FAIL', validations.dupRef)
  record(
    'V5 edit payment amount recalculates invoice',
    { newAmount: 2500 },
    { paid: 2500, rem: 7500, status: 'partially_paid' },
    { paid: validations.afterEditPaid, rem: validations.afterEditRem, status: validations.afterEditStatus },
    eq(validations.afterEditPaid, 2500) && eq(validations.afterEditRem, 7500) && validations.afterEditStatus === 'partially_paid'
      ? 'PASS'
      : 'FAIL',
  )

  // ---------- ACCOUNTING ----------
  const acct = await qa(page, async () => {
    const api = window.__SMART_CA_QA__
    const stamp = Date.now().toString().slice(-6)
    const pan = `QAACC${stamp.slice(0, 4)}Z`
    const gstin = `27${pan}1Z5`
    const client = await api.ClientService.create({
      name: `Acct ${stamp}`, contactPerson: 'A', email: `acc.${stamp}@example.com`, phone: '9876543210',
      pan, gstin, type: 'company', status: 'active', city: 'Delhi', state: 'Delhi',
    })
    const inv = await api.InvoiceService.create({
      clientId: client.id, clientName: client.name, subtotal: 50000, cgst: 0, sgst: 0, total: 50000, status: 'sent',
    })
    await api.PaymentService.create({
      clientId: client.id, clientName: client.name, invoiceId: inv.id, invoiceNumber: inv.invoiceNumber,
      amount: 20000, status: 'completed', reference: `ACC-${stamp}`, method: 'neft', paymentDate: '2026-07-12',
    })
    let unbalanced = null
    try {
      api.postManualJournal({
        date: '2026-07-12',
        narration: 'Unbalanced test',
        lines: [
          { account: 'Bank', debit: 100, credit: 0 },
          { account: 'Cash', debit: 0, credit: 50 },
        ],
      })
      unbalanced = 'ALLOWED'
    } catch (e) {
      unbalanced = e.message
    }
    const balanced = api.postManualJournal({
      date: '2026-07-12',
      narration: `Balanced ${stamp}`,
      lines: [
        { account: 'Office Expense', debit: 1000, credit: 0 },
        { account: 'Bank', debit: 0, credit: 1000 },
      ],
    })
    const snap = api.getAccountingSnapshot()
    return {
      unbalanced,
      balancedId: balanced.id,
      trialBalanced: snap.trial.balanced,
      trialDebit: snap.trial.totalDebit,
      trialCredit: snap.trial.totalCredit,
      pnlRevenue: snap.pnl.revenue,
      assets: snap.balance.assets,
      liabilities: snap.balance.liabilities,
      equity: snap.balance.equity,
      sheetBalanced: snap.balance.balanced,
    }
  })

  record('A1 reject unbalanced journal', {}, true, /unbalanced/i.test(acct.unbalanced), /unbalanced/i.test(acct.unbalanced) ? 'PASS' : 'FAIL', acct.unbalanced)
  record('A2 trial balance Debit=Credit', {}, true, acct.trialBalanced && eq(acct.trialDebit, acct.trialCredit), acct.trialBalanced ? 'PASS' : 'FAIL', `D=${acct.trialDebit} C=${acct.trialCredit}`)
  record('A3 balance sheet A=L+E', {}, true, acct.sheetBalanced && eq(acct.assets, acct.liabilities + acct.equity), acct.sheetBalanced ? 'PASS' : 'FAIL', `A=${acct.assets} L=${acct.liabilities} E=${acct.equity}`)
  record('A4 P&L revenue includes professional fees', {}, true, acct.pnlRevenue >= 50000, acct.pnlRevenue >= 50000 ? 'PASS' : 'FAIL', `revenue=${acct.pnlRevenue}`)

  // ---------- INTEGRITY REPAIR ----------
  const integ = await qa(page, async () => {
    const api = window.__SMART_CA_QA__
    const before = api.runDataIntegrityCheck()
    const repair = api.repairDerivedData()
    const after = api.runDataIntegrityCheck()
    return {
      beforeErrors: before.errorCount,
      afterErrors: after.errorCount,
      repaired: repair.repaired,
      categories: after.issues.filter((i) => i.severity === 'error').map((i) => i.category).slice(0, 10),
    }
  })

  record(
    'I1 repairDerivedData reduces/stabilizes integrity errors',
    {},
    true,
    integ.afterErrors <= integ.beforeErrors,
    integ.afterErrors <= integ.beforeErrors ? 'PASS' : 'FAIL',
    `before=${integ.beforeErrors} after=${integ.afterErrors} repaired=${integ.repaired} leftover=${integ.categories.join(',')}`,
  )

  // ---------- TAX FORMULA ----------
  const tax = await qa(page, async () => {
    const api = window.__SMART_CA_QA__
    const stamp = Date.now().toString().slice(-6)
    const pan = `QATAX${stamp.slice(0, 4)}Z`
    const gstin = `27${pan}1Z5`
    const client = await api.ClientService.create({
      name: `Tax ${stamp}`, contactPerson: 'T', email: `tax.${stamp}@example.com`, phone: '9876543210',
      pan, gstin, type: 'company', status: 'active', city: 'Mumbai', state: 'Maharashtra',
    })
    const inv = await api.InvoiceService.create({
      clientId: client.id, clientName: client.name, subtotal: 10000, status: 'sent',
    })
    const row = api.getInvoice(inv.id)
    return { subtotal: row.subtotal, cgst: row.cgst, sgst: row.sgst, total: row.total }
  })

  record(
    'T1 GST 18% on subtotal 10000 → total 11800',
    { subtotal: 10000 },
    { cgst: 900, sgst: 900, total: 11800 },
    { cgst: tax.cgst, sgst: tax.sgst, total: tax.total },
    eq(tax.cgst, 900) && eq(tax.sgst, 900) && eq(tax.total, 11800) ? 'PASS' : 'FAIL',
  )

  await browser.close()

  const pass = results.filter((r) => r.status === 'PASS').length
  const fail = results.filter((r) => r.status === 'FAIL').length
  fs.writeFileSync(OUT, JSON.stringify({ results, pass, fail }, null, 2))
  console.log(`\n=== BUSINESS QA: ${pass} PASS / ${fail} FAIL / ${results.length} total ===`)
  process.exit(fail ? 2 : 0)
}

run().catch((e) => {
  console.error(e)
  fs.writeFileSync(OUT, JSON.stringify({ results, fatal: e.message }, null, 2))
  process.exit(1)
})
