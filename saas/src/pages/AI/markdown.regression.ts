/**
 * AI regression helpers for Docker / Node-free validation scripts.
 * Run inside the web image is not required — Go unit tests cover backend;
 * this file documents browser expectations and can be imported by future Vitest.
 */
import { parseMarkdown } from './markdown'

export function assertMarkdownFixtures() {
  const md = [
    '# Heading',
    '',
    'Paragraph with **bold** and `code`.',
    '',
    '- item one',
    '- item two',
    '',
    '1. first',
    '2. second',
    '',
    '| A | B |',
    '| --- | --- |',
    '| 1 | 2 |',
    '',
    '```ts',
    'const x = 1',
    '```',
  ].join('\n')
  const blocks = parseMarkdown(md)
  const types = blocks.map((b) => b.type)
  if (!types.includes('h') || !types.includes('p') || !types.includes('ul') || !types.includes('ol') || !types.includes('table') || !types.includes('code')) {
    throw new Error(`markdown regression failed: ${types.join(',')}`)
  }
  return true
}
