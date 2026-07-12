import { COLLECTION, getCollection } from '@/db'
import { simulateDelay } from './api'
import type { AuthUser } from '@/types/auth'

export const SettingsService = {
  async getSettings() {
    await simulateDelay()
    const row = getCollection(COLLECTION.settings).findById('SETTINGS-001')
    if (!row) throw new Error('Settings not found')
    const { id: _i, archived: _a, createdAt: _c, updatedAt: _u, ...rest } = row
    return rest
  },

  async getOrganization() {
    await simulateDelay()
    const row = getCollection(COLLECTION.organization).findById('ORG-001')
    if (!row) throw new Error('Organization not found')
    const { id: _i, archived: _a, createdAt: _c, updatedAt: _u, ...rest } = row
    return rest
  },

  async updateOrganization(data: Record<string, unknown>) {
    await simulateDelay(400)
    return getCollection(COLLECTION.organization).update('ORG-001', data)
  },

  async getRoles() {
    await simulateDelay()
    return getCollection(COLLECTION.roles).find()
  },

  async getPermissions() {
    await simulateDelay()
    return getCollection(COLLECTION.permissions).find()
  },

  async getUsers() {
    await simulateDelay()
    return getCollection(COLLECTION.users)
      .find()
      .map((u) => {
        const { password: _, ...rest } = u as { password?: string }
        return rest as unknown as AuthUser
      })
  },

  async updateSettings(section: string, data: Record<string, unknown> | unknown[]) {
    await simulateDelay(400)
    const current = getCollection(COLLECTION.settings).findById('SETTINGS-001') || { id: 'SETTINGS-001' }
    const existing = (current as Record<string, unknown>)[section]
    const merged = Array.isArray(data)
      ? data
      : { ...((typeof existing === 'object' && existing && !Array.isArray(existing) ? existing : {}) as object), ...data }
    return getCollection(COLLECTION.settings).update('SETTINGS-001', {
      ...current,
      [section]: merged,
    })
  },

  async updateUserStatus(userId: string, status: 'active' | 'inactive') {
    await simulateDelay(300)
    return getCollection(COLLECTION.users).update(userId, { status })
  },

  async createUser(data: Partial<AuthUser> & { password?: string; roleId?: string }) {
    await simulateDelay(400)
    const roles = getCollection(COLLECTION.roles).find()
    const role = roles.find((r) => r.id === data.roleId) || roles[0]
    const firstName = data.firstName || 'New'
    const lastName = data.lastName || 'User'
    return getCollection(COLLECTION.users).insert({
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
    await simulateDelay(300)
    if (data.roleId) {
      const role = getCollection(COLLECTION.roles).findById(String(data.roleId))
      if (role) {
        data.role = role.id
        data.roleName = role.name
        data.permissions = role.permissions
      }
    }
    if (data.firstName || data.lastName) {
      const current = getCollection(COLLECTION.users).findById(userId) as AuthUser | null
      const firstName = String(data.firstName || current?.firstName || '')
      const lastName = String(data.lastName || current?.lastName || '')
      data.fullName = `${firstName} ${lastName}`.trim()
    }
    return getCollection(COLLECTION.users).update(userId, data)
  },

  async deleteUser(userId: string) {
    await simulateDelay(200)
    getCollection(COLLECTION.users).delete(userId)
    return { success: true }
  },

  async resetUserPassword(userId: string, password = 'SmartCA@2025') {
    await simulateDelay(200)
    return getCollection(COLLECTION.users).update(userId, { password })
  },

  async createRole(data: { name: string; level?: number; permissions?: string[] }) {
    await simulateDelay(300)
    return getCollection(COLLECTION.roles).insert({
      name: data.name,
      level: data.level || 40,
      permissions: data.permissions || ['dashboard.view'],
      userCount: 0,
    })
  },

  async updateRole(roleId: string, data: Partial<{ name: string; level: number; permissions: string[] }>) {
    await simulateDelay(300)
    const updated = getCollection(COLLECTION.roles).update(roleId, data)
    // sync users with this role
    if (data.permissions) {
      getCollection(COLLECTION.users)
        .find({ filter: { role: roleId }, pageSize: 100000 })
        .forEach((u) => {
          getCollection(COLLECTION.users).update(u.id, {
            permissions: data.permissions,
            roleName: data.name || u.roleName,
          })
        })
    }
    return updated
  },

  async deleteRole(roleId: string) {
    await simulateDelay(200)
    const users = getCollection(COLLECTION.users).count({ filter: { role: roleId } })
    if (users > 0) throw new Error('Reassign users before deleting this role')
    getCollection(COLLECTION.roles).delete(roleId)
    return { success: true }
  },

  async duplicateRole(roleId: string) {
    await simulateDelay(300)
    const role = getCollection(COLLECTION.roles).findById(roleId)
    return getCollection(COLLECTION.roles).duplicate(roleId, {
      name: `${role?.name || 'Role'} (Copy)`,
      userCount: 0,
    })
  },

  async getAuditLogs() {
    await simulateDelay()
    return getCollection(COLLECTION.auditLogs).find()
  },

  async getLoginHistory() {
    await simulateDelay()
    return getCollection(COLLECTION.loginHistory).find()
  },

  async logAudit(action: string, module: string, details: string, userId = '', userName = '') {
    return getCollection(COLLECTION.auditLogs).insert({
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
