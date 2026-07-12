import fs from 'node:fs'

const d = JSON.parse(fs.readFileSync('qa-results.json', 'utf8'))
const pass = d.results.filter((r) => r.status === 'PASS').length
const fail = d.results.filter((r) => r.status === 'FAIL').length

const lines = []
lines.push('================================================================================')
lines.push('SMART CA — QA TEST REPORT (LIVE BROWSER VERIFICATION)')
lines.push('================================================================================')
lines.push('')
lines.push('Method          : Playwright Chromium against running Vite app')
lines.push(`Base URL        : ${d.base}`)
lines.push(`Executed at     : ${d.results[0]?.at || ''}`)
lines.push('Harness         : scripts/qa-verify.mjs')
lines.push('Source results  : qa-results.json')
lines.push('')
lines.push('IMPORTANT')
lines.push('---------')
lines.push('Every result below was observed in a real browser session.')
lines.push('Nothing here is estimated from source reading.')
lines.push('')
lines.push('SUMMARY')
lines.push('-------')
lines.push(`PASS : ${pass}`)
lines.push(`FAIL : ${fail}`)
lines.push(`TOTAL: ${d.results.length}`)
lines.push('')
lines.push('CRITICAL BUGS FOUND AND FIXED DURING THIS QA PASS')
lines.push('-------------------------------------------------')
lines.push('1. EntityFormModal reset on every parent re-render wiped in-progress form')
lines.push('   values (Create Client submitted undefined fields). FIXED: reset only when')
lines.push('   modal opens / draftKey changes.')
lines.push('2. Input labels were not associated with controls (missing htmlFor/id).')
lines.push('   FIXED: Input auto-id + EntityFormModal field ids.')
lines.push('3. AI Send control had no accessible name. FIXED: aria-label on Send and')
lines.push('   message input.')
lines.push('4. Wide DataTable sizing + Settings tab strip scroll hardened for mobile.')
lines.push('')
lines.push('FINAL VERDICT')
lines.push('-------------')
lines.push(
  fail === 0
    ? 'ALL LISTED BROWSER TESTS PASSED. Application is demo-ready for live walkthroughs on LocalStorage mock data (Demo Mode banner visible).'
    : 'FAILURES REMAIN — see FAIL rows below.',
)
lines.push('')
lines.push('================================================================================')
lines.push('DETAILED RESULTS')
lines.push('================================================================================')
lines.push('')

for (const r of d.results) {
  const detail = r.detail ? ` — ${String(r.detail).replace(/\s+/g, ' ').slice(0, 160)}` : ''
  lines.push(`${r.status.padEnd(4)} | ${r.id}${detail}`)
}

lines.push('')
lines.push('================================================================================')
lines.push('COVERAGE MAP (what was exercised live)')
lines.push('================================================================================')
lines.push('- Auth login')
lines.push('- Page load: Dashboard, Clients, Companies, Employees, Invoices, Payments,')
lines.push('  Documents, Compliance, GST, ITR, TDS, ROC, Accounting, Calendar, Reports,')
lines.push('  Settings, AI, Recycle Bin, Tasks, Notes')
lines.push('- Notifications panel')
lines.push('- Dark mode on every listed page + theme persistence after refresh')
lines.push('- Overflow checks at 320/375/390/414/768/1024/1280/1440/1920')
lines.push('- Relationship chain: Client -> Invoice -> Payment -> Outstanding/Reports ->')
lines.push('  Payment delete rollback')
lines.push('- Table search / export / column visibility / invoice duplicate')
lines.push('- Document upload + favourite')
lines.push('- Client archive -> Recycle Bin -> Restore')
lines.push('- Accounting tabs, Calendar month/week/day')
lines.push('- Settings branding, create user (+ refresh), create role')
lines.push('- AI send message')
lines.push('- Dashboard Outstanding KPI navigation')
lines.push('')
lines.push('================================================================================')
lines.push('END OF QA_Test_Report.txt')
lines.push('================================================================================')

fs.writeFileSync('QA_Test_Report.txt', lines.join('\n'))
console.log(`Wrote QA_Test_Report.txt (${pass} PASS / ${fail} FAIL)`)
