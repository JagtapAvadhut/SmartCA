import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

dayjs.extend(relativeTime)

export function formatCurrency(amount: number | null | undefined): string {
  const n = Number(amount)
  if (!Number.isFinite(n)) {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(0)
  }
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n)
}

export function formatNumber(num: number | null | undefined): string {
  const n = Number(num)
  if (!Number.isFinite(n)) return '0'
  return new Intl.NumberFormat('en-IN').format(n)
}

export function formatDate(date: string | Date | null | undefined, format = 'DD MMM YYYY'): string {
  if (date == null || date === '') return '—'
  const d = dayjs(date)
  if (!d.isValid()) return '—'
  return d.format(format)
}

export function formatRelativeTime(date: string | Date | null | undefined): string {
  if (date == null || date === '') return '—'
  const d = dayjs(date)
  if (!d.isValid()) return '—'
  return d.fromNow()
}

export function formatFileSize(bytes: number | null | undefined): string {
  const n = Number(bytes)
  if (!Number.isFinite(n) || n < 0) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export function getInitials(name: string | null | undefined): string {
  if (!name) return '—'
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function truncate(str: string | null | undefined, length: number): string {
  if (!str) return ''
  if (str.length <= length) return str
  return str.slice(0, length) + '...'
}

export function capitalize(str: string | null | undefined): string {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1).replace(/_/g, ' ')
}
