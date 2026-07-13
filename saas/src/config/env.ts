export const APP_NAME = import.meta.env.VITE_APP_NAME || 'Smart CA'
/**
 * API base URL baked at build time.
 * Native: http://localhost:8080/api/v1
 * Docker (same-origin nginx proxy): /api/v1
 */
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1'
