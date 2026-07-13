export function exportToCSV<T extends Record<string, unknown>>(
  data: T[],
  filename: string,
  columns?: { key: keyof T; header: string }[]
) {
  if (!data.length) return

  const keys = columns
    ? columns.map((c) => c.key as string)
    : Object.keys(data[0])
  const headers = columns ? columns.map((c) => c.header) : keys

  const csvContent = [
    headers.join(','),
    ...data.map((row) =>
      keys
        .map((key) => {
          const val = row[key]
          const str = val == null ? '' : String(val)
          return str.includes(',') ? `"${str}"` : str
        })
        .join(',')
    ),
  ].join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `${filename}.csv`
  link.click()
  URL.revokeObjectURL(link.href)
}
