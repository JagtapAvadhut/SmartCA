import { http, setAuthToken, type PaginatedResult } from './httpClient'
import type { AuthUser, LoginCredentials, Session } from '@/types/auth'

export const AuthService = {
  async login(
    credentials: LoginCredentials,
  ): Promise<{ user: AuthUser; token: string; session: Session }> {
    const device = navigator.userAgent.includes('Mobile') ? 'Mobile Browser' : 'Desktop Browser'
    const result = await http.post<{ user: AuthUser; token: string; session: Session }>(
      '/auth/login',
      {
        identifier: credentials.identifier,
        password: credentials.password,
        rememberMe: !!credentials.rememberMe,
        device,
      },
      { skipAuthRedirect: true },
    )
    setAuthToken(result.token)
    return result
  },

  async logout(): Promise<void> {
    try {
      await http.post('/auth/logout')
    } catch {
      /* ignore — always clear local token */
    }
    setAuthToken(null)
  },

  async forgotPassword(email: string): Promise<{ message: string }> {
    return http.post<{ message: string }>(
      '/auth/forgot-password',
      { email },
      { skipAuthRedirect: true },
    )
  },

  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    return http.post<{ message: string }>(
      '/auth/reset-password',
      { token, newPassword },
      { skipAuthRedirect: true },
    )
  },

  async getCurrentUser(_userId?: string): Promise<AuthUser> {
    return http.get<AuthUser>('/auth/me')
  },

  async getAllUsers(): Promise<AuthUser[]> {
    const res = await http.get<{ data: AuthUser[]; total: number }>('/users', {
      params: { page: 1, pageSize: 100000 },
    })
    return Array.isArray(res) ? (res as unknown as AuthUser[]) : res.data
  },

  async updateProfile(userId: string, data: Partial<AuthUser>) {
    return http.patch<AuthUser>(`/users/${userId}`, data)
  },

  async getLoginHistory(userId?: string) {
    const res = await http.get<PaginatedResult<Record<string, unknown>>>('/login-history', {
      params: { page: 1, pageSize: 200 },
    })
    const rows = res.data || []
    if (!userId) return rows
    return rows.filter((h) => h.userId === userId)
  },

  async changePassword(_userId: string, currentPassword: string, newPassword: string) {
    return http.post<{ message: string }>('/auth/change-password', {
      currentPassword,
      newPassword,
    })
  },
}
