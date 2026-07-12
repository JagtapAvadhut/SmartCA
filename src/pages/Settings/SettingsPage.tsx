import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Building2, Users, Shield, Palette, Bell, Mail, MessageSquare, Key,
  Lock, User, Activity, Globe, Sun, Monitor, Moon, Copy, Trash2, Plus, Pencil, KeyRound,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { SettingsService } from '@/services/settingsService'
import { AuthService } from '@/services/authService'
import { runDataIntegrityCheck, repairDerivedData, getIntegrityAuditLog } from '@/services/reconciliationService'
import { useAuth } from '@/hooks/useAuth'
import { useThemeStore } from '@/store'
import { PageHeader, Card, CardTitle, Input, Button, Badge, Modal, SwitchField } from '@/components/common'
import { formatRelativeTime, cn } from '@/utils'
import { applyBrandingFromSettings } from '@/utils/branding'
import type { Permission, ThemeMode } from '@/types/auth'

const ALL_PERMISSIONS: Permission[] = [
  'dashboard.view',
  'clients.view', 'clients.create', 'clients.edit', 'clients.delete',
  'companies.view', 'companies.create', 'companies.edit',
  'compliance.view', 'compliance.create', 'compliance.edit', 'compliance.delete',
  'gst.view', 'itr.view', 'tds.view', 'roc.view',
  'accounting.view',
  'invoices.view', 'invoices.create', 'invoices.edit', 'invoices.delete',
  'payments.view', 'payments.create',
  'documents.view', 'documents.upload', 'documents.delete',
  'tasks.view', 'tasks.create', 'tasks.edit', 'tasks.delete',
  'reports.view', 'reports.export',
  'employees.view', 'employees.create', 'employees.edit',
  'ai.view',
  'settings.view', 'settings.edit', 'settings.users', 'settings.roles',
  'settings.security', 'settings.branding', 'settings.api',
]

const TABS = [
  { id: 'organization', label: 'Organization', icon: Building2 },
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'password', label: 'Password', icon: Lock },
  { id: 'users', label: 'Users', icon: Users, permission: 'settings.users' },
  { id: 'roles', label: 'Roles', icon: Shield, permission: 'settings.roles' },
  { id: 'branding', label: 'Branding', icon: Palette, permission: 'settings.branding' },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'email', label: 'Email', icon: Mail },
  { id: 'sms', label: 'SMS', icon: MessageSquare },
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
  { id: 'security', label: 'Security', icon: Shield, permission: 'settings.security' },
  { id: 'api', label: 'API Keys', icon: Key, permission: 'settings.api' },
  { id: 'integrity', label: 'Data Integrity', icon: Activity, permission: 'settings.view' },
  { id: 'appearance', label: 'Appearance', icon: Sun },
  { id: 'activity', label: 'Activity Logs', icon: Activity },
]

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((d) => d.newPassword === d.confirmPassword, { message: 'Passwords do not match', path: ['confirmPassword'] })

type SettingsShape = {
  branding?: { appName?: string; primaryColor?: string; logo?: string; favicon?: string }
  notifications?: {
    inApp?: { enabled?: boolean; sound?: boolean }
    email?: { enabled?: boolean }
    sms?: { enabled?: boolean }
    whatsapp?: { enabled?: boolean }
  }
  email?: { smtpHost?: string; smtpPort?: string; fromEmail?: string; fromName?: string }
  sms?: { provider?: string; senderId?: string; apiKey?: string }
  whatsapp?: { businessNumber?: string; apiToken?: string }
  security?: { twoFactor?: boolean; sessionTimeout?: number; passwordPolicy?: string }
  apiKeys?: Array<{ id: string; name: string; key: string; createdAt: string }>
}

export default function SettingsPage() {
  const [params, setParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState(params.get('tab') || 'organization')
  const { user, permissions, updateUser } = useAuth()
  const { mode, setMode, language, setLanguage } = useThemeStore()
  const queryClient = useQueryClient()

  useEffect(() => {
    const tab = params.get('tab')
    if (tab) setActiveTab(tab)
  }, [params])

  const selectTab = (id: string) => {
    setActiveTab(id)
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('tab', id)
      return next
    }, { replace: true })
  }

  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: () => SettingsService.getSettings() })
  const { data: org } = useQuery({ queryKey: ['organization'], queryFn: () => SettingsService.getOrganization() })
  const { data: users } = useQuery({ queryKey: ['settings-users'], queryFn: () => SettingsService.getUsers(), enabled: activeTab === 'users' })
  const { data: auditLogs } = useQuery({ queryKey: ['audit-logs'], queryFn: () => SettingsService.getAuditLogs(), enabled: activeTab === 'activity' })

  const [orgForm, setOrgForm] = useState<Record<string, string>>({})
  const [profileForm, setProfileForm] = useState<Record<string, string>>({})
  const [brandingForm, setBrandingForm] = useState({ appName: 'Smart CA', primaryColor: '#4f46e5' })
  const [emailForm, setEmailForm] = useState({ smtpHost: '', smtpPort: '587', fromEmail: '', fromName: '' })
  const [smsForm, setSmsForm] = useState({ provider: 'msg91', senderId: '', apiKey: '' })
  const [whatsappForm, setWhatsappForm] = useState({ businessNumber: '', apiToken: '' })
  const [apiKeys, setApiKeys] = useState<Array<{ id: string; name: string; key: string; createdAt: string }>>([])
  const [userModal, setUserModal] = useState<'create' | 'edit' | null>(null)
  const [editingUser, setEditingUser] = useState<{
    id: string; firstName: string; lastName: string; email: string; mobile: string
    designation: string; department: string; roleId: string; status: string; profileImage: string
  } | null>(null)
  const [userForm, setUserForm] = useState({
    firstName: '', lastName: '', email: '', mobile: '', designation: 'Staff',
    department: 'General', roleId: '', password: 'SmartCA@2025', profileImage: '',
  })
  const [userSearch, setUserSearch] = useState('')
  const [userStatusFilter, setUserStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [roleModal, setRoleModal] = useState<'create' | 'edit' | null>(null)
  const [editingRole, setEditingRole] = useState<{ id: string; name: string; level: number; permissions: string[] } | null>(null)
  const [roleForm, setRoleForm] = useState({ name: '', level: 40, permissions: ['dashboard.view'] as string[] })
  const [integrityReport, setIntegrityReport] = useState<Awaited<ReturnType<typeof runDataIntegrityCheck>> | null>(null)

  const { data: roles } = useQuery({
    queryKey: ['roles'],
    queryFn: () => SettingsService.getRoles(),
    enabled: activeTab === 'roles' || activeTab === 'users' || !!userModal || !!roleModal,
  })

  const orgData = org as Record<string, unknown> | undefined
  const settingsData = settings as SettingsShape | undefined
  const rolesData = (roles || []) as Array<{ id: string; name: string; userCount: number; level: number; permissions: string[] }>
  const rolesOptions = rolesData
  const auditData = (auditLogs || []) as Array<{ id: string; userName: string; details: string; action: string; module: string; timestamp: string }>

  const filteredUsers = useMemo(() => {
    const list = users || []
    return list.filter((u) => {
      const q = userSearch.toLowerCase()
      const matchQ = !q || u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (u.roleName || '').toLowerCase().includes(q)
      const matchS = userStatusFilter === 'all' || u.status === userStatusFilter
      return matchQ && matchS
    })
  }, [users, userSearch, userStatusFilter])

  useEffect(() => {
    if (!settingsData) return
    if (settingsData.branding) {
      setBrandingForm({
        appName: settingsData.branding.appName || 'Smart CA',
        primaryColor: settingsData.branding.primaryColor || '#4f46e5',
      })
    }
    if (settingsData.email) {
      setEmailForm({
        smtpHost: settingsData.email.smtpHost || '',
        smtpPort: String(settingsData.email.smtpPort || '587'),
        fromEmail: settingsData.email.fromEmail || '',
        fromName: settingsData.email.fromName || '',
      })
    }
    if (settingsData.sms) {
      setSmsForm({
        provider: settingsData.sms.provider || 'msg91',
        senderId: settingsData.sms.senderId || '',
        apiKey: settingsData.sms.apiKey || '',
      })
    }
    if (settingsData.whatsapp) {
      setWhatsappForm({
        businessNumber: settingsData.whatsapp.businessNumber || '',
        apiToken: settingsData.whatsapp.apiToken || '',
      })
    }
    if (settingsData.apiKeys) setApiKeys(settingsData.apiKeys)
  }, [settingsData])

  const passwordForm = useForm({ resolver: zodResolver(passwordSchema) })

  const saveSection = useMutation({
    mutationFn: ({ section, data }: { section: string; data: Record<string, unknown> | unknown[] }) =>
      SettingsService.updateSettings(section, data),
    onSuccess: (_d, vars) => {
      toast.success(`${vars.section} settings saved`)
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      if (vars.section === 'branding') applyBrandingFromSettings()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const refreshUsersRoles = () => {
    queryClient.invalidateQueries({ queryKey: ['settings-users'] })
    queryClient.invalidateQueries({ queryKey: ['roles'] })
  }

  const openCreateUser = () => {
    setEditingUser(null)
    setUserForm({
      firstName: '', lastName: '', email: '', mobile: '', designation: 'Staff',
      department: 'General', roleId: rolesOptions[0]?.id || 'employee', password: 'SmartCA@2025', profileImage: '',
    })
    setUserModal('create')
  }

  const openEditUser = (u: {
    id: string; firstName: string; lastName: string; email: string; mobile?: string
    designation?: string; department?: string; role: string; status: string
    profileImage?: string; avatar?: string
  }) => {
    setEditingUser({
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      mobile: u.mobile || '',
      designation: u.designation || '',
      department: u.department || '',
      roleId: u.role,
      status: u.status,
      profileImage: u.profileImage || u.avatar || '',
    })
    setUserForm({
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      mobile: u.mobile || '',
      designation: u.designation || 'Staff',
      department: u.department || 'General',
      roleId: u.role,
      password: '',
      profileImage: u.profileImage || u.avatar || '',
    })
    setUserModal('edit')
  }

  const saveUser = async () => {
    try {
      if (!userForm.firstName.trim() || !userForm.email.trim()) {
        toast.error('Name and email are required')
        return
      }
      if (userModal === 'create') {
        await SettingsService.createUser({
          firstName: userForm.firstName,
          lastName: userForm.lastName,
          email: userForm.email,
          mobile: userForm.mobile,
          designation: userForm.designation,
          department: userForm.department,
          roleId: userForm.roleId,
          password: userForm.password || 'SmartCA@2025',
          profileImage: userForm.profileImage,
          avatar: userForm.profileImage,
        })
        toast.success('User created')
      } else if (editingUser) {
        await SettingsService.updateUser(editingUser.id, {
          firstName: userForm.firstName,
          lastName: userForm.lastName,
          email: userForm.email,
          mobile: userForm.mobile,
          designation: userForm.designation,
          department: userForm.department,
          roleId: userForm.roleId,
          profileImage: userForm.profileImage,
          avatar: userForm.profileImage,
        })
        toast.success('User updated')
      }
      setUserModal(null)
      refreshUsersRoles()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save user')
    }
  }

  const openCreateRole = () => {
    setEditingRole(null)
    setRoleForm({ name: '', level: 40, permissions: ['dashboard.view'] })
    setRoleModal('create')
  }

  const openEditRole = (r: { id: string; name: string; level: number; permissions: string[] }) => {
    setEditingRole(r)
    setRoleForm({ name: r.name, level: r.level, permissions: [...r.permissions] })
    setRoleModal('edit')
  }

  const toggleRolePermission = (perm: string) => {
    setRoleForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(perm)
        ? prev.permissions.filter((p) => p !== perm)
        : [...prev.permissions, perm],
    }))
  }

  const saveRole = async () => {
    try {
      if (!roleForm.name.trim()) {
        toast.error('Role name is required')
        return
      }
      if (roleModal === 'create') {
        await SettingsService.createRole(roleForm)
        toast.success('Role created')
      } else if (editingRole) {
        await SettingsService.updateRole(editingRole.id, roleForm)
        toast.success('Role updated')
      }
      setRoleModal(null)
      refreshUsersRoles()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save role')
    }
  }

  const saveOrg = useMutation({
    mutationFn: (data: Record<string, string>) => SettingsService.updateOrganization(data),
    onSuccess: () => { toast.success('Organization updated'); queryClient.invalidateQueries({ queryKey: ['organization'] }) },
    onError: (e: Error) => toast.error(e.message),
  })

  const persistNotifications = async (patch: Record<string, unknown>) => {
    const current = (settingsData?.notifications || {}) as Record<string, unknown>
    const next: Record<string, unknown> = { ...current, ...patch }
    if (patch.inApp && typeof patch.inApp === 'object') {
      next.inApp = {
        ...((typeof current.inApp === 'object' && current.inApp) ? current.inApp as object : {}),
        ...(patch.inApp as object),
      }
    }
    // Optimistic update so controlled Switch thumbs move immediately
    queryClient.setQueryData(['settings'], (old: unknown) => {
      if (!old || typeof old !== 'object') return old
      return { ...(old as Record<string, unknown>), notifications: next }
    })
    try {
      await SettingsService.updateSettings('notifications', next)
      toast.success('Notification settings saved')
    } catch (e) {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      toast.error(e instanceof Error ? e.message : 'Failed to save notifications')
      return
    }
    queryClient.invalidateQueries({ queryKey: ['settings'] })
  }

  const persistSecurity = async (patch: Record<string, unknown>) => {
    const current = (settingsData?.security || {}) as Record<string, unknown>
    const next = { ...current, ...patch }
    queryClient.setQueryData(['settings'], (old: unknown) => {
      if (!old || typeof old !== 'object') return old
      return { ...(old as Record<string, unknown>), security: next }
    })
    try {
      await SettingsService.updateSettings('security', next)
      toast.success('Security settings saved')
    } catch (e) {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      toast.error(e instanceof Error ? e.message : 'Failed to save security settings')
      return
    }
    queryClient.invalidateQueries({ queryKey: ['settings'] })
  }

  const changePassword = async (data: z.infer<typeof passwordSchema>) => {
    try {
      if (!user) return
      await AuthService.changePassword(user.id, data.currentPassword, data.newPassword)
      toast.success('Password changed successfully')
      passwordForm.reset()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to change password')
    }
  }

  const generateApiKey = async () => {
    const next = [
      ...apiKeys,
      {
        id: `key-${Date.now()}`,
        name: `Production Key ${apiKeys.length + 1}`,
        key: `sca_key_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`,
        createdAt: new Date().toISOString(),
      },
    ]
    setApiKeys(next)
    await SettingsService.updateSettings('apiKeys', next)
    queryClient.invalidateQueries({ queryKey: ['settings'] })
    toast.success('API key generated')
  }

  const revokeApiKey = async (id: string) => {
    const next = apiKeys.filter((k) => k.id !== id)
    setApiKeys(next)
    await SettingsService.updateSettings('apiKeys', next)
    queryClient.invalidateQueries({ queryKey: ['settings'] })
    toast.success('API key revoked')
  }

  const visibleTabs = TABS.filter((t) => !t.permission || permissions.includes(t.permission as never))

  const THEME_OPTIONS: { mode: ThemeMode; icon: typeof Sun; label: string }[] = [
    { mode: 'light', icon: Sun, label: 'Light' },
    { mode: 'dark', icon: Moon, label: 'Dark' },
    { mode: 'system', icon: Monitor, label: 'System' },
  ]

  const inAppEnabled = settingsData?.notifications?.inApp?.enabled ?? true
  const soundEnabled = settingsData?.notifications?.inApp?.sound ?? true
  const emailNotif = settingsData?.notifications?.email?.enabled ?? true
  const smsNotif = settingsData?.notifications?.sms?.enabled ?? false
  const waNotif = settingsData?.notifications?.whatsapp?.enabled ?? false
  const twoFactor = settingsData?.security?.twoFactor ?? false
  const sessionTimeout = settingsData?.security?.sessionTimeout ?? 30

  return (
    <div>
      <PageHeader title="Settings" description="Manage your organization settings and preferences" />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6">
        <Card className="lg:col-span-1 overflow-x-auto max-w-full" padding>
          <nav className="flex lg:flex-col gap-1 lg:min-w-0 overflow-x-auto scrollbar-thin pb-1 lg:pb-0">
            {visibleTabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button key={tab.id} type="button" onClick={() => selectTab(tab.id)} className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap shrink-0',
                  activeTab === tab.id ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                )}>
                  <Icon className="h-4 w-4 shrink-0" /> {tab.label}
                </button>
              )
            })}
          </nav>
        </Card>

        <div className="lg:col-span-3 space-y-6 min-w-0">
          {activeTab === 'organization' && orgData && (
            <Card>
              <CardTitle className="mb-6">Organization Details</CardTitle>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { key: 'name', label: 'Firm Name', default: String(orgData.name || '') },
                  { key: 'registrationNumber', label: 'Registration Number', default: String(orgData.registrationNumber || '') },
                  { key: 'pan', label: 'PAN', default: String(orgData.pan || '') },
                  { key: 'gstin', label: 'GSTIN', default: String(orgData.gstin || '') },
                  { key: 'email', label: 'Email', default: String(orgData.email || '') },
                  { key: 'phone', label: 'Phone', default: String(orgData.phone || '') },
                ].map((f) => (
                  <Input key={f.key} label={f.label} defaultValue={f.default} onChange={(e) => setOrgForm((p) => ({ ...p, [f.key]: e.target.value }))} />
                ))}
                <div className="sm:col-span-2">
                  <Input label="Address" defaultValue={String(orgData.address || '')} onChange={(e) => setOrgForm((p) => ({ ...p, address: e.target.value }))} />
                </div>
              </div>
              <div className="mt-6 flex justify-end">
                <Button onClick={() => saveOrg.mutate(orgForm)} loading={saveOrg.isPending}>Save Changes</Button>
              </div>
            </Card>
          )}

          {activeTab === 'profile' && user && (
            <Card>
              <CardTitle className="mb-6">My Profile</CardTitle>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="First Name" defaultValue={user.firstName} onChange={(e) => setProfileForm((p) => ({ ...p, firstName: e.target.value }))} />
                <Input label="Last Name" defaultValue={user.lastName} onChange={(e) => setProfileForm((p) => ({ ...p, lastName: e.target.value }))} />
                <Input label="Email" defaultValue={user.email} disabled />
                <Input label="Mobile" defaultValue={user.mobile} onChange={(e) => setProfileForm((p) => ({ ...p, mobile: e.target.value }))} />
                <Input label="Designation" defaultValue={user.designation} disabled />
                <Input label="Department" defaultValue={user.department} disabled />
                <Input label="PAN" defaultValue={user.pan} onChange={(e) => setProfileForm((p) => ({ ...p, pan: e.target.value }))} />
                <Input label="GSTIN" defaultValue={user.gstin} onChange={(e) => setProfileForm((p) => ({ ...p, gstin: e.target.value }))} />
                <div className="sm:col-span-2"><Input label="Bio" defaultValue={user.bio} onChange={(e) => setProfileForm((p) => ({ ...p, bio: e.target.value }))} /></div>
              </div>
              <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                <Button variant="outline" onClick={async () => {
                  const { resetDatabase } = await import('@/db')
                  if (confirm('Reset all mock data to factory defaults? Your local changes will be lost.')) {
                    resetDatabase()
                    toast.success('Database reset. Reloading...')
                    setTimeout(() => window.location.reload(), 800)
                  }
                }}>Reset Database</Button>
                <Button onClick={async () => {
                  try {
                    const firstName = profileForm.firstName || user.firstName
                    const lastName = profileForm.lastName || user.lastName
                    const updated = await AuthService.updateProfile(user.id, {
                      ...profileForm,
                      firstName,
                      lastName,
                      fullName: `${firstName} ${lastName}`,
                    })
                    updateUser(updated)
                    toast.success('Profile updated')
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : 'Failed to update profile')
                  }
                }}>Save Profile</Button>
              </div>
            </Card>
          )}

          {activeTab === 'password' && (
            <Card>
              <CardTitle className="mb-6">Change Password</CardTitle>
              <form onSubmit={passwordForm.handleSubmit(changePassword)} className="space-y-4 max-w-md">
                <Input label="Current Password" type="password" error={passwordForm.formState.errors.currentPassword?.message} {...passwordForm.register('currentPassword')} />
                <Input label="New Password" type="password" error={passwordForm.formState.errors.newPassword?.message} {...passwordForm.register('newPassword')} />
                <Input label="Confirm Password" type="password" error={passwordForm.formState.errors.confirmPassword?.message} {...passwordForm.register('confirmPassword')} />
                <Button type="submit">Update Password</Button>
              </form>
            </Card>
          )}

          {activeTab === 'users' && users && (
            <Card padding={false}>
              <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <CardTitle>Users ({filteredUsers.length})</CardTitle>
                <Button size="sm" onClick={openCreateUser}><Plus className="h-4 w-4" /> Create User</Button>
              </div>
              <div className="px-6 py-3 flex flex-col sm:flex-row gap-3 border-b border-gray-50 dark:border-gray-800">
                <Input placeholder="Search users..." value={userSearch} onChange={(e) => setUserSearch(e.target.value)} className="sm:max-w-xs" />
                <select
                  value={userStatusFilter}
                  onChange={(e) => setUserStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
                  className="text-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2"
                >
                  <option value="all">All statuses</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div className="divide-y divide-gray-50 dark:divide-gray-800 overflow-x-auto">
                {filteredUsers.map((u) => (
                  <div key={u.id} className="flex items-center justify-between gap-4 px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 min-w-[360px]">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-full bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center overflow-hidden shrink-0">
                        {u.profileImage || u.avatar ? (
                          <img src={u.profileImage || u.avatar} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-sm font-semibold text-primary-600">{u.firstName?.[0]}{u.lastName?.[0]}</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{u.fullName}</p>
                        <p className="text-xs text-gray-500 truncate">{u.email} · {u.designation}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                      <Badge>{u.roleName}</Badge>
                      <Badge status={u.status} />
                      <Button size="sm" variant="ghost" onClick={() => openEditUser(u)} aria-label="Edit"><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          await SettingsService.resetUserPassword(u.id)
                          toast.success(`Password reset to SmartCA@2025 for ${u.fullName}`)
                        }}
                        aria-label="Reset password"
                      >
                        <KeyRound className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          const next = u.status === 'active' ? 'inactive' : 'active'
                          await SettingsService.updateUserStatus(u.id, next)
                          toast.success(`${u.fullName} marked ${next}`)
                          refreshUsersRoles()
                        }}
                      >
                        {u.status === 'active' ? 'Deactivate' : 'Activate'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-500"
                        onClick={async () => {
                          if (!confirm(`Delete user ${u.fullName}?`)) return
                          try {
                            await SettingsService.deleteUser(u.id)
                            toast.success('User deleted')
                            refreshUsersRoles()
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : 'Delete failed')
                          }
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
                {filteredUsers.length === 0 && (
                  <p className="px-6 py-10 text-sm text-gray-400 text-center">No users match your filters</p>
                )}
              </div>
            </Card>
          )}

          {activeTab === 'roles' && (
            <Card>
              <div className="flex items-center justify-between gap-3 mb-6">
                <CardTitle>Roles & Permissions</CardTitle>
                <Button size="sm" onClick={openCreateRole}><Plus className="h-4 w-4" /> Create Role</Button>
              </div>
              <div className="space-y-4">
                {rolesData.map((r) => (
                  <div key={r.id} className="p-4 rounded-xl border border-gray-100 dark:border-gray-800">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{r.name}</p>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-gray-400">{r.userCount} users · Level {r.level}</span>
                        <Button size="sm" variant="ghost" onClick={() => openEditRole(r)} aria-label="Edit role"><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            await SettingsService.duplicateRole(r.id)
                            toast.success('Role duplicated')
                            refreshUsersRoles()
                          }}
                          aria-label="Duplicate role"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-500"
                          onClick={async () => {
                            try {
                              await SettingsService.deleteRole(r.id)
                              toast.success('Role deleted')
                              refreshUsersRoles()
                            } catch (e) {
                              toast.error(e instanceof Error ? e.message : 'Delete failed')
                            }
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {r.permissions.slice(0, 10).map((p: string) => <Badge key={p}>{p}</Badge>)}
                      {r.permissions.length > 10 && <Badge>+{r.permissions.length - 10} more</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {activeTab === 'notifications' && (
            <Card>
              <CardTitle className="mb-6">Notification Preferences</CardTitle>
              <div className="space-y-3">
                <SwitchField checked={inAppEnabled} onChange={(v) => void persistNotifications({ inApp: { enabled: v, sound: soundEnabled } })} label="In-App Notifications" description="Show notifications within the app" />
                <SwitchField checked={soundEnabled} onChange={(v) => void persistNotifications({ inApp: { enabled: inAppEnabled, sound: v } })} label="Notification Sound" description="Play sound for new notifications" />
                <SwitchField checked={emailNotif} onChange={(v) => void persistNotifications({ email: { enabled: v } })} label="Email Notifications" description="Receive notifications via email" />
                <SwitchField checked={smsNotif} onChange={(v) => void persistNotifications({ sms: { enabled: v } })} label="SMS Notifications" description="Receive SMS alerts" />
                <SwitchField checked={waNotif} onChange={(v) => void persistNotifications({ whatsapp: { enabled: v } })} label="WhatsApp Notifications" description="Receive WhatsApp messages" />
              </div>
            </Card>
          )}

          {activeTab === 'security' && (
            <Card>
              <CardTitle className="mb-6">Security Settings</CardTitle>
              <div className="space-y-3">
                <SwitchField checked={twoFactor} onChange={(v) => void persistSecurity({ twoFactor: v })} label="Two-Factor Authentication" description="Add an extra layer of security" />
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
                  <div><p className="text-sm font-medium text-gray-900 dark:text-gray-100">Session Timeout</p><p className="text-xs text-gray-500">Auto logout after inactivity</p></div>
                  <select
                    value={sessionTimeout}
                    onChange={(e) => void persistSecurity({ sessionTimeout: Number(e.target.value) })}
                    className="text-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-1.5"
                  >
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={60}>1 hour</option>
                    <option value={240}>4 hours</option>
                  </select>
                </div>
              </div>
            </Card>
          )}

          {activeTab === 'appearance' && (
            <Card>
              <CardTitle className="mb-6">Appearance</CardTitle>
              <div className="space-y-6">
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Theme</p>
                  <div className="grid grid-cols-3 gap-3">
                    {THEME_OPTIONS.map(({ mode: m, icon: Icon, label }) => (
                      <button key={m} type="button" onClick={() => { setMode(m); toast.success(`${label} theme applied`) }} className={cn(
                        'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-colors',
                        mode === m ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                      )}>
                        <Icon className="h-6 w-6 text-gray-600 dark:text-gray-400" />
                        <span className="text-sm font-medium">{label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Language</p>
                  <div className="flex flex-wrap gap-3">
                    {[{ code: 'en', label: 'English' }, { code: 'hi', label: 'हिंदी' }].map((lang) => (
                      <button key={lang.code} type="button" onClick={() => { setLanguage(lang.code); toast.success(`Language preference saved: ${lang.label} (i18n strings coming soon)`) }} className={cn(
                        'px-4 py-2 rounded-xl border text-sm font-medium transition-colors',
                        language === lang.code ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700' : 'border-gray-200 dark:border-gray-700'
                      )}>
                        <Globe className="h-4 w-4 inline mr-2" />{lang.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 mt-2">Language preference is stored for future i18n. UI remains English in v1.0 demo.</p>
                </div>
              </div>
            </Card>
          )}

          {activeTab === 'activity' && (
            <Card padding={false}>
              <div className="p-6 border-b border-gray-100 dark:border-gray-800"><CardTitle>Activity Logs</CardTitle></div>
              <div className="divide-y divide-gray-50 dark:divide-gray-800 max-h-[500px] overflow-y-auto">
                {auditData.map((log) => (
                  <div key={log.id} className="px-6 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm text-gray-900 dark:text-gray-100 min-w-0"><span className="font-medium">{log.userName}</span> {log.details}</p>
                      <Badge>{log.action}</Badge>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{log.module} · {formatRelativeTime(log.timestamp)}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {activeTab === 'branding' && (
            <Card>
              <CardTitle className="mb-4">Branding</CardTitle>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="App Name" value={brandingForm.appName} onChange={(e) => setBrandingForm((p) => ({ ...p, appName: e.target.value }))} />
                <Input label="Primary Color" value={brandingForm.primaryColor} onChange={(e) => setBrandingForm((p) => ({ ...p, primaryColor: e.target.value }))} type="color" className="h-10" />
              </div>
              <div className="mt-6 flex justify-end">
                <Button loading={saveSection.isPending} onClick={() => saveSection.mutate({ section: 'branding', data: brandingForm })}>Save Changes</Button>
              </div>
            </Card>
          )}

          {activeTab === 'email' && (
            <Card>
              <CardTitle className="mb-4">Email (SMTP)</CardTitle>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="SMTP Host" value={emailForm.smtpHost} onChange={(e) => setEmailForm((p) => ({ ...p, smtpHost: e.target.value }))} placeholder="smtp.gmail.com" />
                <Input label="SMTP Port" value={emailForm.smtpPort} onChange={(e) => setEmailForm((p) => ({ ...p, smtpPort: e.target.value }))} />
                <Input label="From Email" value={emailForm.fromEmail} onChange={(e) => setEmailForm((p) => ({ ...p, fromEmail: e.target.value }))} />
                <Input label="From Name" value={emailForm.fromName} onChange={(e) => setEmailForm((p) => ({ ...p, fromName: e.target.value }))} />
              </div>
              <div className="mt-6 flex justify-end">
                <Button loading={saveSection.isPending} onClick={() => saveSection.mutate({ section: 'email', data: emailForm })}>Save Changes</Button>
              </div>
            </Card>
          )}

          {activeTab === 'sms' && (
            <Card>
              <CardTitle className="mb-4">SMS Gateway</CardTitle>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="Provider" value={smsForm.provider} onChange={(e) => setSmsForm((p) => ({ ...p, provider: e.target.value }))} />
                <Input label="Sender ID" value={smsForm.senderId} onChange={(e) => setSmsForm((p) => ({ ...p, senderId: e.target.value }))} />
                <div className="sm:col-span-2">
                  <Input label="API Key" value={smsForm.apiKey} onChange={(e) => setSmsForm((p) => ({ ...p, apiKey: e.target.value }))} type="password" />
                </div>
              </div>
              <div className="mt-6 flex justify-end">
                <Button loading={saveSection.isPending} onClick={() => saveSection.mutate({ section: 'sms', data: smsForm })}>Save Changes</Button>
              </div>
            </Card>
          )}

          {activeTab === 'whatsapp' && (
            <Card>
              <CardTitle className="mb-4">WhatsApp Business</CardTitle>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="Business Number" value={whatsappForm.businessNumber} onChange={(e) => setWhatsappForm((p) => ({ ...p, businessNumber: e.target.value }))} />
                <Input label="API Token" value={whatsappForm.apiToken} onChange={(e) => setWhatsappForm((p) => ({ ...p, apiToken: e.target.value }))} type="password" />
              </div>
              <div className="mt-6 flex justify-end">
                <Button loading={saveSection.isPending} onClick={() => saveSection.mutate({ section: 'whatsapp', data: whatsappForm })}>Save Changes</Button>
              </div>
            </Card>
          )}

          {activeTab === 'api' && (
            <Card>
              <CardTitle className="mb-4">API Keys</CardTitle>
              <div className="space-y-3">
                {apiKeys.length === 0 && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">No API keys configured</p>
                )}
                {apiKeys.map((k) => (
                  <div key={k.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{k.name}</p>
                      <p className="text-xs font-mono text-gray-500 truncate">{k.key}</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button variant="outline" size="sm" onClick={() => { void navigator.clipboard.writeText(k.key); toast.success('Copied') }}>
                        <Copy className="h-3.5 w-3.5" /> Copy
                      </Button>
                      <Button variant="ghost" size="sm" className="text-red-500" onClick={() => void revokeApiKey(k.id)}>
                        <Trash2 className="h-3.5 w-3.5" /> Revoke
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex justify-end">
                <Button size="sm" onClick={() => void generateApiKey()}>Generate API Key</Button>
              </div>
            </Card>
          )}

          {activeTab === 'integrity' && (
            <Card>
              <CardTitle className="mb-2">Data Integrity</CardTitle>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Reconcile derived fields (invoice paidAmount, client outstanding, dashboard KPIs) against source collections.
              </p>
              <div className="flex flex-wrap gap-2 mb-4">
                <Button
                  onClick={() => {
                    void runDataIntegrityCheck().then((report) => {
                      toast.success(`Integrity check: ${report.errorCount} errors, ${report.warningCount} warnings`)
                      setIntegrityReport(report)
                    })
                  }}
                >
                  Run Data Integrity Check
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    void repairDerivedData().then((result) => {
                      toast.success(`Repaired ${result.repaired} derived records`)
                      setIntegrityReport(result.report)
                    })
                  }}
                >
                  Repair Derived Data
                </Button>
              </div>
              {integrityReport && (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  <p className="text-xs text-gray-500">
                    Checked {integrityReport.checkedAt} · {integrityReport.issueCount} issues
                  </p>
                  {integrityReport.issues.length === 0 && (
                    <p className="text-sm text-emerald-600">No integrity issues detected</p>
                  )}
                  {integrityReport.issues.map((issue) => (
                    <div key={issue.id} className="p-3 rounded-xl border border-gray-100 dark:border-gray-800 text-sm">
                      <p className={issue.severity === 'error' ? 'text-red-600 font-medium' : 'text-amber-600 font-medium'}>
                        [{issue.severity}] {issue.category}
                      </p>
                      <p className="text-gray-700 dark:text-gray-300">{issue.message}</p>
                      {(issue.expected != null || issue.actual != null) && (
                        <p className="text-xs text-gray-400 mt-1">expected={String(issue.expected)} actual={String(issue.actual)}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-6">
                <p className="text-xs font-semibold text-gray-500 mb-2">Repair audit log</p>
                <div className="space-y-1 max-h-40 overflow-y-auto text-xs text-gray-500">
                  {getIntegrityAuditLog().map((a) => (
                    <p key={String(a.id)}>{String(a.at)} · {String(a.action)} · repaired={String(a.repaired)} · errors={String(a.errorCount)}</p>
                  ))}
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>

      <Modal open={!!userModal} onClose={() => setUserModal(null)} title={userModal === 'create' ? 'Create User' : 'Edit User'} size="lg">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="First Name" value={userForm.firstName} onChange={(e) => setUserForm((p) => ({ ...p, firstName: e.target.value }))} />
          <Input label="Last Name" value={userForm.lastName} onChange={(e) => setUserForm((p) => ({ ...p, lastName: e.target.value }))} />
          <Input label="Email" value={userForm.email} onChange={(e) => setUserForm((p) => ({ ...p, email: e.target.value }))} />
          <Input label="Mobile" value={userForm.mobile} onChange={(e) => setUserForm((p) => ({ ...p, mobile: e.target.value }))} />
          <Input label="Designation" value={userForm.designation} onChange={(e) => setUserForm((p) => ({ ...p, designation: e.target.value }))} />
          <Input label="Department" value={userForm.department} onChange={(e) => setUserForm((p) => ({ ...p, department: e.target.value }))} />
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Role</label>
            <select
              value={userForm.roleId}
              onChange={(e) => setUserForm((p) => ({ ...p, roleId: e.target.value }))}
              className="w-full h-10 rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 px-3 text-sm"
            >
              {rolesOptions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          {userModal === 'create' && (
            <Input label="Temp Password" value={userForm.password} onChange={(e) => setUserForm((p) => ({ ...p, password: e.target.value }))} />
          )}
          <div className="sm:col-span-2">
            <Input
              label="Profile Picture URL"
              value={userForm.profileImage}
              onChange={(e) => setUserForm((p) => ({ ...p, profileImage: e.target.value }))}
              placeholder="https://… or leave blank for initials"
            />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setUserModal(null)}>Cancel</Button>
          <Button onClick={() => void saveUser()}>{userModal === 'create' ? 'Create' : 'Save'}</Button>
        </div>
      </Modal>

      <Modal open={!!roleModal} onClose={() => setRoleModal(null)} title={roleModal === 'create' ? 'Create Role' : 'Edit Role'} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Role Name" value={roleForm.name} onChange={(e) => setRoleForm((p) => ({ ...p, name: e.target.value }))} />
            <Input
              label="Level"
              type="number"
              value={roleForm.level}
              onChange={(e) => setRoleForm((p) => ({ ...p, level: Number(e.target.value) || 0 }))}
            />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Permission Matrix</p>
            <div className="max-h-64 overflow-y-auto rounded-xl border border-gray-100 dark:border-gray-800 p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ALL_PERMISSIONS.map((perm) => (
                <label key={perm} className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={roleForm.permissions.includes(perm)}
                    onChange={() => toggleRolePermission(perm)}
                    className="rounded border-gray-300"
                  />
                  {perm}
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2">{roleForm.permissions.length} permissions selected</p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setRoleModal(null)}>Cancel</Button>
          <Button onClick={() => void saveRole()}>{roleModal === 'create' ? 'Create Role' : 'Save Role'}</Button>
        </div>
      </Modal>
    </div>
  )
}
