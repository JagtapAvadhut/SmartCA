import { COLLECTION, getCollection } from '@/db'

const BRAND_STYLE_ID = 'smart-ca-branding'

/** Apply branding primary color to CSS variables immediately */
export function applyBrandingFromSettings() {
  try {
    const row = getCollection(COLLECTION.settings).findById('SETTINGS-001') as Record<string, unknown> | null
    const branding = (row?.branding || {}) as { primaryColor?: string; appName?: string }
    const color = branding.primaryColor || '#4f46e5'
    let style = document.getElementById(BRAND_STYLE_ID) as HTMLStyleElement | null
    if (!style) {
      style = document.createElement('style')
      style.id = BRAND_STYLE_ID
      document.head.appendChild(style)
    }
    style.textContent = `
      :root {
        --color-primary-600: ${color};
        --color-primary-500: ${color};
        --brand-primary: ${color};
      }
      .bg-primary-600 { background-color: ${color} !important; }
      .text-primary-600, .text-primary-700 { color: ${color} !important; }
      .border-primary-500, .border-primary-600 { border-color: ${color} !important; }
      .bg-primary-50 { background-color: color-mix(in srgb, ${color} 12%, white) !important; }
      .dark .bg-primary-50, .dark .bg-primary-900\\/30 {
        background-color: color-mix(in srgb, ${color} 22%, transparent) !important;
      }
    `
    if (branding.appName) {
      document.title = `${branding.appName} - Practice Management`
    }
  } catch {
    // ignore before DB init
  }
}

/** Session timeout minutes from settings (fallback 30) */
export function getSessionTimeoutMs(): number {
  try {
    const row = getCollection(COLLECTION.settings).findById('SETTINGS-001') as Record<string, unknown> | null
    const security = (row?.security || {}) as { sessionTimeout?: number }
    const minutes = Number(security.sessionTimeout || 30)
    return Math.max(5, minutes) * 60 * 1000
  } catch {
    return 30 * 60 * 1000
  }
}
