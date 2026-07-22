export function exportToCSV<T extends Record<string, unknown>>(
  data: T[],
  filename: string,
  columns?: { key: keyof T; header: string }[]
) {
  const rows = Array.isArray(data) ? data : []
  const keys = columns
    ? columns.map((c) => c.key as string)
    : rows.length
      ? Object.keys(rows[0])
      : []
  const headers = columns ? columns.map((c) => c.header) : keys.length ? keys : ['id']

  const csvContent = [
    headers.join(','),
    ...rows.map((row) =>
      keys
        .map((key) => {
          const val = row[key]
          const str = val == null ? '' : String(val)
          return str.includes(',') || str.includes('"') || str.includes('\n')
            ? `"${str.replace(/"/g, '""')}"`
            : str
        })
        .join(',')
    ),
  ].join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `${filename || 'export'}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(link.href)
}
