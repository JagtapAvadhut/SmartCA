/**
 * Lightweight UI markdown regression checks (no browser).
 * Run: node scripts/ai-markdown-check.mjs
 */
import assert from 'node:assert/strict'

function inlineMd(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
}

function isTableSeparator(line) {
  if (!line) return false
  return /^\s*\|?[\s:-]+\|[\s|:-]*$/.test(line)
}

function splitRow(line) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim())
}

function parseMarkdown(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const out = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (line.startsWith('```')) {
      const buf = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) {
        buf.push(lines[i])
        i++
      }
      out.push({ type: 'code', content: buf.join('\n') })
      i++
      continue
    }
    if (isTableSeparator(lines[i + 1]) && line.includes('|')) {
      const headers = splitRow(line)
      i += 2
      const rows = []
      while (i < lines.length && lines[i].includes('|') && !isTableSeparator(lines[i])) {
        rows.push(splitRow(lines[i]))
        i++
      }
      out.push({ type: 'table', headers, rows })
      continue
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      const items = []
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ''))
        i++
      }
      out.push({ type: 'ol', items })
      continue
    }
    i++
  }
  return out
}

const sample = `## Title
\`\`\`js
const x = 1
\`\`\`
| A | B |
|---|---|
| 1 | 2 |
1. First
2. Second
`

const blocks = parseMarkdown(sample)
assert.ok(blocks.some((b) => b.type === 'code'))
assert.ok(blocks.some((b) => b.type === 'table' && b.headers[0] === 'A'))
assert.ok(blocks.some((b) => b.type === 'ol' && b.items.length === 2))
assert.equal(inlineMd('**bold**'), '<strong>bold</strong>')
console.log('ai-markdown-check: PASS')
