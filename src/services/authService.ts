import { COLLECTION, getCollection } from '@/db'
import { simulateDelay, setAuthToken } from './api'
import type { AuthUser, LoginCredentials, Session } from '@/types/auth'
import { SESSION_TIMEOUT_MS } from '@/types/auth'
import { ActivityService } from './miscService'

type UserRecord = AuthUser & { password: string }

function generateToken(): string {
  return `sca_${Date.now()}_${Math.random().toString(36).slice(2, 15)}`
}

function sanitizeUser(user: UserRecord): AuthUser {
  const { password: _, ...safe } = user
  return safe as AuthUser
}

export const AuthService = {
  async login(credentials: LoginCredentials): Promise<{ user: AuthUser; token: string; session: Session }> {
    await simulateDelay(600)
    const { identifier, password, rememberMe } = credentials
    const id = identifier.trim().toLowerCase()
    const users = getCollection<UserRecord>(COLLECTION.users).find({ includeArchived: true })
    const user = users.find(
      (u) =>
        u.email.toLowerCase() === id ||
        u.username.toLowerCase() === id ||
        u.loginId.toLowerCase() === id
    )

    if (!user) throw new Error('Invalid email, username, or login ID')
    if (user.password !== password) throw new Error('Incorrect password')
    if (user.status !== 'active') throw new Error('Your account has been deactivated. Contact administrator.')

    const token = generateToken()
    const session: Session = {
      id: `SES-${Date.now()}`,
      userId: user.id,
      token,
      device: navigator.userAgent.includes('Mobile') ? 'Mobile Browser' : 'Desktop Browser',
      ip: '127.0.0.1',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + (rememberMe ? 7 * 86400000 : SESSION_TIMEOUT_MS)).toISOString(),
      active: true,
    }

    getCollection(COLLECTION.users).update(user.id, { lastLogin: new Date().toISOString() } as Partial<UserRecord>)
    getCollection(COLLECTION.loginHistory).insert({
      userId: user.id,
      userName: user.fullName,
      email: user.email,
      success: true,
      ip: '127.0.0.1',
      device: session.device,
      timestamp: new Date().toISOString(),
    })

    setAuthToken(token)
    await ActivityService.log(`${user.fullName} logged in`, 'login', '', '', user.id, user.fullName)
    return { user: sanitizeUser(user), token, session }
  },

  async logout(): Promise<void> {
    await simulateDelay(200)
    setAuthToken(null)
  },

  async forgotPassword(email: string): Promise<{ message: string }> {
    await simulateDelay(800)
    const user = getCollection<UserRecord>(COLLECTION.users)
      .find()
      .find((u) => u.email.toLowerCase() === email.trim().toLowerCase())
    if (!user) throw new Error('No account found with this email address')
    return { message: 'Password reset link has been sent to your email address.' }
  },

  async resetPassword(_token: string, newPassword: string): Promise<{ message: string }> {
    await simulateDelay(600)
    if (newPassword.length < 8) throw new Error('Password must be at least 8 characters')
    return { message: 'Password has been reset successfully. You can now sign in.' }
  },

  async getCurrentUser(userId: string): Promise<AuthUser> {
    await simulateDelay(200)
    const user = getCollection<UserRecord>(COLLECTION.users).findById(userId)
    if (!user) throw new Error('User not found')
    return sanitizeUser(user)
  },

  async getAllUsers() {
    await simulateDelay()
    return getCollection<UserRecord>(COLLECTION.users).find().map(sanitizeUser)
  },

  async updateProfile(userId: string, data: Partial<AuthUser>) {
    await simulateDelay(300)
    const updated = getCollection<UserRecord>(COLLECTION.users).update(userId, data as Partial<UserRecord>)
    return sanitizeUser(updated)
  },

  async getLoginHistory(userId?: string) {
    await simulateDelay()
    const history = getCollection(COLLECTION.loginHistory).find()
    return userId ? history.filter((h) => h.userId === userId) : history
  },

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    await simulateDelay(500)
    const user = getCollection<UserRecord>(COLLECTION.users).findById(userId)
    if (!user) throw new Error('User not found')
    if (user.password !== currentPassword) throw new Error('Current password is incorrect')
    if (newPassword.length < 8) throw new Error('New password must be at least 8 characters')
    getCollection<UserRecord>(COLLECTION.users).update(userId, { password: newPassword })
    return { message: 'Password changed successfully' }
  },
}
