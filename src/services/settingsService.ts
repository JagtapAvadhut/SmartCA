import { http, type PaginatedResult } from './httpClient'
import type { AuthUser } from '@/types/auth'

function stripMeta(row: Record<string, unknown>) {
  const { id: _i, archived: _a, createdAt: _c, updatedAt: _u, ...rest } = row
  return rest
}

export const SettingsService = {
  async getSettings() {
    const row = await http.get<Record<string, unknown>>('/settings')
    return stripMeta(row)
  },

  async getOrganization() {
    const row = await http.get<Record<string, unknown>>('/settings/organization')
    return stripMeta(row)
  },

  async updateOrganization(data: Record<string, unknown>) {
    return http.patch<Record<string, unknown>>('/settings/organization', data)
  },

  async getRoles() {
    const res = await http.get<PaginatedResult<Record<string, unknown>>>('/roles', {
      params: { page: 1, pageSize: 100000 },
    })
    return res.data
  },

  async getPermissions() {
    const res = await http.get<PaginatedResult<Record<string, unknown>>>('/permissions', {
      params: { page: 1, pageSize: 100000 },
    })
    return res.data
  },

  async getUsers() {
    const res = await http.get<PaginatedResult<AuthUser & { password?: string }>>('/users', {
      params: { page: 1, pageSize: 100000 },
    })
    return res.data.map((u) => {
      const { password: _, ...rest } = u
      return rest as AuthUser
    })
  },

  async updateSettings(section: string, data: Record<string, unknown> | unknown[]) {
    const current = await http.get<Record<string, unknown>>('/settings')
    const existing = current[section]
    const merged = Array.isArray(data)
      ? data
      : {
          ...((typeof existing === 'object' && existing && !Array.isArray(existing)
            ? existing
            : {}) as object),
          ...data,
        }
    return http.patch('/settings', { [section]: merged })
  },

  async updateUserStatus(userId: string, status: 'active' | 'inactive') {
    return http.patch(`/users/${userId}`, { status })
  },

  async createUser(data: Partial<AuthUser> & { password?: string; roleId?: string }) {
    const roles = await this.getRoles()
    const role = roles.find((r) => r.id === data.roleId) || roles[0]
    const firstName = data.firstName || 'New'
    const lastName = data.lastName || 'User'
    return http.post('/users', {
      password: data.password || 'SmartCA@2025',
      firstName,
      lastName,
      fullName: `${firstName} ${lastName}`,
      email: data.email || `user${Date.now()}@smartca.in`,
      loginId: data.email || `user${Date.now()}`,
      username: (data.email || 'user').split('@')[0],
      mobile: data.mobile || '',
      designation: data.designation || 'Staff',
      department: data.department || 'General',
      organization: 'Smart CA',
      branch: 'Mumbai HQ',
      role: (role?.id || 'employee') as AuthUser['role'],
      roleName: String(role?.name || 'Employee'),
      permissions: (role?.permissions || []) as AuthUser['permissions'],
      status: 'active',
      profileImage: '',
      avatar: '',
      employeeId: '',
      joiningDate: new Date().toISOString().split('T')[0],
      lastLogin: '',
      themePreference: 'system',
      language: 'en',
      address: '',
      city: '',
      state: '',
      country: 'India',
      pincode: '',
      gstin: '',
      pan: '',
      aadhaar: '',
      bio: '',
      ...data,
    })
  },

  async updateUser(userId: string, data: Record<string, unknown>) {
    if (data.roleId) {
      const roles = await this.getRoles()
      const role = roles.find((r) => r.id === String(data.roleId))
      if (role) {
        data.role = role.id
        data.roleName = role.name
        data.permissions = role.permissions
      }
    }
    if (data.firstName || data.lastName) {
      const current = await http.get<AuthUser>(`/users/${userId}`)
      const firstName = String(data.firstName || current?.firstName || '')
      const lastName = String(data.lastName || current?.lastName || '')
      data.fullName = `${firstName} ${lastName}`.trim()
    }
    return http.patch(`/users/${userId}`, data)
  },

  async deleteUser(userId: string) {
    await http.del(`/users/${userId}`)
    return { success: true }
  },

  async resetUserPassword(userId: string, password = 'SmartCA@2025') {
    return http.patch(`/users/${userId}`, { password })
  },

  async createRole(data: { name: string; level?: number; permissions?: string[] }) {
    return http.post('/roles', {
      name: data.name,
      level: data.level || 40,
      permissions: data.permissions || ['dashboard.view'],
      userCount: 0,
    })
  },

  async updateRole(roleId: string, data: Partial<{ name: string; level: number; permissions: string[] }>) {
    const updated = await http.patch(`/roles/${roleId}`, data)
    if (data.permissions) {
      const users = await this.getUsers()
      await Promise.all(
        users
          .filter((u) => u.role === roleId)
          .map((u) =>
            http.patch(`/users/${u.id}`, {
              permissions: data.permissions,
              roleName: data.name || u.roleName,
            }),
          ),
      )
    }
    return updated
  },

  async deleteRole(roleId: string) {
    const users = await this.getUsers()
    if (users.some((u) => u.role === roleId)) {
      throw new Error('Reassign users before deleting this role')
    }
    await http.del(`/roles/${roleId}`)
    return { success: true }
  },

  async duplicateRole(roleId: string) {
    const role = await http.get<{ name?: string }>(`/roles/${roleId}`)
    // roles may not support /duplicate — clone via create
    return http.post('/roles', {
      ...role,
      id: undefined,
      name: `${role?.name || 'Role'} (Copy)`,
      userCount: 0,
    })
  },

  async getAuditLogs() {
    const res = await http.get<PaginatedResult<Record<string, unknown>>>('/audit-logs', {
      params: { page: 1, pageSize: 100000 },
    })
    return res.data
  },

  async getLoginHistory() {
    // No dedicated login-history route; return empty for UI compatibility
    return [] as Array<Record<string, unknown>>
  },

  async logAudit(action: string, module: string, details: string, userId = '', userName = '') {
    return http.post('/audit-logs', {
      userId,
      userName,
      action,
      module,
      details,
      ip: '127.0.0.1',
      timestamp: new Date().toISOString(),
    })
  },
}
