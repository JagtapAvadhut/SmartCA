import { useMemo } from 'react'
import toast from 'react-hot-toast'

type Block =
  | { type: 'p' | 'h' | 'code'; content: string; lang?: string }
  | { type: 'ul' | 'ol'; items: string[] }
  | { type: 'table'; headers: string[]; rows: string[][] }

export function SimpleMarkdown({ text }: { text: string }) {
  const blocks = useMemo(() => parseMarkdown(text), [text])
  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {blocks.map((b, i) => {
        switch (b.type) {
          case 'code':
            return (
              <div key={i} className="relative group">
                <pre className="overflow-x-auto rounded-xl bg-gray-900 text-gray-100 p-3 text-xs">
                  <code>{b.content}</code>
                </pre>
                <button
                  type="button"
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-xs bg-white/10 hover:bg-white/20 text-white px-2 py-1 rounded"
                  onClick={() => {
                    void navigator.clipboard.writeText(b.content)
                    toast.success('Copied')
                  }}
                >
                  Copy
                </button>
              </div>
            )
          case 'ul':
            return (
              <ul key={i} className="list-disc pl-5 space-y-1">
                {b.items.map((it, j) => (
                  <li key={j} dangerouslySetInnerHTML={{ __html: inlineMd(it) }} />
                ))}
              </ul>
            )
          case 'ol':
            return (
              <ol key={i} className="list-decimal pl-5 space-y-1">
                {b.items.map((it, j) => (
                  <li key={j} dangerouslySetInnerHTML={{ __html: inlineMd(it) }} />
                ))}
              </ol>
            )
          case 'table':
            return (
              <div key={i} className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-100 dark:bg-gray-800">
                    <tr>
                      {b.headers.map((h, j) => (
                        <th key={j} className="px-3 py-2 text-left font-semibold" dangerouslySetInnerHTML={{ __html: inlineMd(h) }} />
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((row, ri) => (
                      <tr key={ri} className="border-t border-gray-100 dark:border-gray-800">
                        {row.map((cell, ci) => (
                          <td key={ci} className="px-3 py-2" dangerouslySetInnerHTML={{ __html: inlineMd(cell) }} />
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          case 'h':
            return <h3 key={i} className="font-semibold text-base mt-2" dangerouslySetInnerHTML={{ __html: inlineMd(b.content) }} />
          case 'p':
          default:
            return <p key={i} dangerouslySetInnerHTML={{ __html: inlineMd(b.type === 'p' ? b.content : '') }} />
        }
      })}
    </div>
  )
}

function inlineMd(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 text-xs">$1</code>')
}

export function parseMarkdown(text: string): Block[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const out: Block[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim()
      const buf: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) {
        buf.push(lines[i])
        i++
      }
      out.push({ type: 'code', content: buf.join('\n'), lang })
      i++
      continue
    }
    if (/^#{1,3}\s+/.test(line)) {
      out.push({ type: 'h', content: line.replace(/^#{1,3}\s+/, '') })
      i++
      continue
    }
    if (isTableSeparator(lines[i + 1]) && line.includes('|')) {
      const headers = splitRow(line)
      i += 2
      const rows: string[][] = []
      while (i < lines.length && lines[i].includes('|') && !isTableSeparator(lines[i])) {
        rows.push(splitRow(lines[i]))
        i++
      }
      out.push({ type: 'table', headers, rows })
      continue
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ''))
        i++
      }
      out.push({ type: 'ul', items })
      continue
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ''))
        i++
      }
      out.push({ type: 'ol', items })
      continue
    }
    if (line.trim() === '') {
      i++
      continue
    }
    const buf = [line]
    i++
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].startsWith('```') &&
      !/^#{1,3}\s+/.test(lines[i]) &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !(lines[i].includes('|') && isTableSeparator(lines[i + 1]))
    ) {
      buf.push(lines[i])
      i++
    }
    out.push({ type: 'p', content: buf.join(' ') })
  }
  return out
}

function splitRow(line: string) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim())
}

function isTableSeparator(line?: string) {
  if (!line) return false
  return /^\s*\|?[\s:-]+\|[\s|:-]*$/.test(line)
}
