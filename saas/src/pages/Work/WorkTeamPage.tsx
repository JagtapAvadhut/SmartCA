import { useState } from 'react'
import { Link } from 'react-router'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { PageHeader, Button } from '@/components/common'
import { WorkService } from '@/services/workService'
import { useAuthStore } from '@/store'

const ROLE_OPTIONS = [
  { value: 'manager', label: 'Manager' },
  { value: 'ca', label: 'CA' },
  { value: 'team_leader', label: 'Team Leader' },
  { value: 'employee', label: 'Employee' },
]

function creatableRoles(role?: string): string[] {
  const r = (role || '').toLowerCase()
  if (['super_admin', 'admin', 'partner', 'manager'].includes(r)) return ['manager', 'ca', 'team_leader', 'employee']
  if (['ca', 'senior_ca'].includes(r)) return ['team_leader', 'employee']
  if (['team_leader', 'junior_ca', 'article_assistant'].includes(r)) return ['employee']
  return []
}

export default function WorkTeamPage() {
  const role = useAuthStore((s) => s.user?.role)
  const allowed = creatableRoles(role)
  const [form, setForm] = useState({
    fullName: '', email: '', password: 'SmartCA@2025', role: allowed[0] || 'employee', department: '', designation: '',
  })

  const mut = useMutation({
    mutationFn: () => WorkService.createTeamUser(form),
    onSuccess: () => toast.success('User created'),
    onError: (e: Error) => toast.error(e.message || 'Create failed'),
  })

  return (
    <div className="space-y-6 max-w-xl">
      <PageHeader
        title="Team Provisioning"
        description="Hierarchy-gated user creation"
        actions={<Link to="/work"><Button variant="secondary">Back</Button></Link>}
      />
      {allowed.length === 0 ? (
        <p className="text-sm text-gray-500">Your role cannot create users.</p>
      ) : (
        <div className="space-y-3 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
          {(['fullName', 'email', 'password', 'department', 'designation'] as const).map((k) => (
            <input
              key={k}
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm"
              placeholder={k}
              type={k === 'password' ? 'password' : 'text'}
              value={form[k]}
              onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
            />
          ))}
          <select
            className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm"
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
          >
            {ROLE_OPTIONS.filter((o) => allowed.includes(o.value)).map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <Button disabled={!form.fullName || !form.email || mut.isPending} onClick={() => mut.mutate()}>
            Create user
          </Button>
        </div>
      )}
    </div>
  )
}
