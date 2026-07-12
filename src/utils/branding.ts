import { SettingsService } from '@/services/settingsService'

const BRAND_STYLE_ID = 'smart-ca-branding'

/** Apply branding primary color to CSS variables immediately */
export function applyBrandingFromSettings() {
  void SettingsService.getSettings()
    .then((row) => {
      const branding = (row.branding || {}) as { primaryColor?: string; appName?: string }
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
    })
    .catch(() => {
      /* ignore before auth / API ready */
    })
}

/** Session timeout minutes from settings (fallback 30) */
export function getSessionTimeoutMs(): number {
  // Sync callers need a default; settings are loaded async into branding/store.
  return 30 * 60 * 1000
}
