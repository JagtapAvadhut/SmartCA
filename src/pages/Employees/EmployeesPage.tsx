import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import { EmployeeService } from '@/services'
import { employeeRepository, taskRepository } from '@/repositories'
import { COLLECTION } from '@/db'
import {
  PageHeader, DataTable, Badge, Avatar, Button, Can, EntityFormModal, ConfirmDialog, RowActions, type FormField,
} from '@/components/common'
import { deleteWithUndo, formatDate, invalidateAfterMutation } from '@/utils'
import { employeeSchema, type EmployeeForm } from '@/schemas/entities'
import type { Employee } from '@/types'

const fields: FormField[] = [
  { name: 'firstName', label: 'First Name', required: true },
  { name: 'lastName', label: 'Last Name', required: true },
  { name: 'email', label: 'Email', type: 'email', required: true },
  { name: 'phone', label: 'Phone', type: 'tel', required: true },
  { name: 'designation', label: 'Designation', required: true },
  { name: 'department', label: 'Department', type: 'select', options: [
    { label: 'Tax', value: 'Tax' }, { label: 'Audit', value: 'Audit' },
    { label: 'Compliance', value: 'Compliance' }, { label: 'Accounts', value: 'Accounts' },
    { label: 'Advisory', value: 'Advisory' }, { label: 'HR', value: 'HR' },
  ]},
  { name: 'role', label: 'Role', type: 'select', options: [
    { label: 'Admin', value: 'admin' }, { label: 'Manager', value: 'manager' }, { label: 'Staff', value: 'staff' },
  ]},
  { name: 'status', label: 'Status', type: 'select', options: [
    { label: 'Active', value: 'active' }, { label: 'Inactive', value: 'inactive' },
  ]},
  { name: 'dateOfJoining', label: 'Joining Date', type: 'date', required: true },
  { name: 'pan', label: 'PAN' },
]

export default function EmployeesPage() {
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Employee | null>(null)
  const [deleting, setDeleting] = useState<Employee | null>(null)
  const [saving, setSaving] = useState(false)
  const [reassignTo, setReassignTo] = useState('')
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: () => EmployeeService.getAll({ pageSize: 200 }),
  })

  const invalidate = () => invalidateAfterMutation(queryClient, ['employees', 'tasks'])

  const handleSubmit = async (form: EmployeeForm) => {
    setSaving(true)
    try {
      const dup = (data?.data || []).find((e) => e.email === form.email && e.id !== editing?.id)
      if (dup) throw new Error('Employee with this email already exists')
      if (editing) {
        await EmployeeService.update(editing.id, form)
        toast.success('Employee updated')
      } else {
        await EmployeeService.create(form)
        toast.success('Employee created')
      }
      setFormOpen(false)
      invalidate()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const taskCount = deleting ? employeeRepository.getAssignedTaskCount(deleting.id) : 0

  const handleDelete = () => {
    if (!deleting) return
    const record = { ...deleting } as unknown as Record<string, unknown> & { id: string }
    const name = `${deleting.firstName} ${deleting.lastName}`
    deleteWithUndo({
      collection: COLLECTION.employees,
      record,
      label: name,
      performDelete: () => {
        if (taskCount > 0) {
          if (reassignTo) {
            const target = (data?.data || []).find((e) => e.id === reassignTo)
            taskRepository.reassignFromEmployee(
              deleting.id,
              reassignTo,
              target ? `${target.firstName} ${target.lastName}` : 'Team member'
            )
          } else {
            taskRepository.unassignFromEmployee(deleting.id)
          }
        }
        EmployeeService.delete(deleting.id)
      },
      onRestored: invalidate,
    })
    setDeleting(null)
    setReassignTo('')
    invalidate()
  }

  const handleArchive = () => {
    if (!deleting) return
    employeeRepository.archive(deleting.id)
    toast.success(`${deleting.firstName} archived`)
    setDeleting(null)
    invalidate()
  }

  const deleteMutation = useMutation({ mutationFn: async () => handleDelete() })

  const columns: ColumnDef<Employee, unknown>[] = useMemo(() => [
    {
      accessorKey: 'firstName',
      header: 'Employee',
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <Avatar src={row.original.avatar} name={`${row.original.firstName} ${row.original.lastName}`} size="sm" />
          <div>
            <p className="font-medium">{row.original.firstName} {row.original.lastName}</p>
            <p className="text-xs text-gray-500">{row.original.email}</p>
          </div>
        </div>
      ),
    },
    { accessorKey: 'designation', header: 'Designation' },
    { accessorKey: 'department', header: 'Department' },
    { accessorKey: 'phone', header: 'Phone' },
    { accessorKey: 'dateOfJoining', header: 'Joined', cell: ({ getValue }) => formatDate(getValue() as string, 'MMM YYYY') },
    { accessorKey: 'role', header: 'Role', cell: ({ getValue }) => <Badge>{String(getValue())}</Badge> },
    { accessorKey: 'status', header: 'Status', cell: ({ getValue }) => <Badge status={getValue() as string} /> },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <RowActions
          onEdit={() => { setEditing(row.original); setFormOpen(true) }}
          onDelete={() => setDeleting(row.original)}
          editPermission="employees.edit"
          deletePermission="employees.edit"
        />
      ),
    },
  ], [])

  const defaults = editing
    ? {
        firstName: editing.firstName, lastName: editing.lastName, email: editing.email,
        phone: editing.phone, designation: editing.designation, department: editing.department,
        status: editing.status as EmployeeForm['status'], role: editing.role as EmployeeForm['role'],
        dateOfJoining: editing.dateOfJoining, pan: editing.pan,
      }
    : { status: 'active' as const, role: 'staff' as const, department: 'Tax', dateOfJoining: new Date().toISOString().split('T')[0] }

  return (
    <div>
      <PageHeader title="Employees" description={`${data?.total || 0} team members`} actions={
        <Can permission="employees.create">
          <Button onClick={() => { setEditing(null); setFormOpen(true) }}><Plus className="h-4 w-4" /> Add Employee</Button>
        </Can>
      } />
      <DataTable data={data?.data || []} columns={columns} searchPlaceholder="Search employees..." exportFilename="employees" loading={isLoading} />
      <EntityFormModal open={formOpen} onClose={() => setFormOpen(false)} onSubmit={handleSubmit} title={editing ? 'Edit Employee' : 'Add Employee'} fields={fields} schema={employeeSchema} defaultValues={defaults} loading={saving} />
      <ConfirmDialog
        open={!!deleting}
        onClose={() => { setDeleting(null); setReassignTo('') }}
        onConfirm={() => deleteMutation.mutate()}
        onArchive={handleArchive}
        title="Remove Employee"
        message={
          taskCount > 0
            ? `Delete ${deleting?.firstName} ${deleting?.lastName}? Choose a teammate to reassign ${taskCount} task(s), or leave blank to unassign.`
            : `Delete ${deleting?.firstName} ${deleting?.lastName}? You can undo shortly.`
        }
        warnings={taskCount > 0 ? [
          `${taskCount} task(s) will be ${reassignTo ? 'reassigned' : 'unassigned'}`,
        ] : []}
        preferArchive={taskCount > 0}
        confirmLabel={taskCount > 0 ? (reassignTo ? 'Delete & reassign' : 'Delete & unassign') : 'Delete'}
        archiveLabel="Archive instead"
        loading={deleteMutation.isPending}
      />
      {deleting && taskCount > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] w-[min(92vw,28rem)] rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 shadow-lg">
          <label className="text-xs font-medium text-gray-600 dark:text-gray-300">Reassign tasks to</label>
          <select
            className="mt-1 w-full text-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-800 rounded-lg px-3 py-2"
            value={reassignTo}
            onChange={(e) => setReassignTo(e.target.value)}
          >
            <option value="">— Unassign —</option>
            {(data?.data || [])
              .filter((e) => e.id !== deleting.id && e.status === 'active')
              .map((e) => (
                <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>
              ))}
          </select>
        </div>
      )}
    </div>
  )
}
