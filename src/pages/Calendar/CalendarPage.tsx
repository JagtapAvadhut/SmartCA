import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import { z } from 'zod'
import dayjs from 'dayjs'
import { CalendarService, ComplianceService } from '@/services'
import { COLLECTION } from '@/db'
import {
  PageHeader, Card, Button, Can, EntityFormModal, ConfirmDialog, Badge, type FormField,
} from '@/components/common'
import { deleteWithUndo, invalidateAfterMutation, cn } from '@/utils'
import type { CalendarEvent } from '@/types'

const eventSchema = z.object({
  title: z.string().min(2).max(120),
  date: z.string().min(1),
  time: z.string().min(1),
  duration: z.coerce.number().min(15).max(480),
  type: z.string().min(1),
  clientName: z.string().optional(),
})

type EventForm = z.infer<typeof eventSchema>
type ViewMode = 'month' | 'week' | 'day'

const TYPE_COLORS: Record<string, string> = {
  meeting: 'bg-primary-500',
  deadline: 'bg-red-500',
  hearing: 'bg-amber-500',
  internal: 'bg-emerald-500',
  compliance: 'bg-purple-500',
}

const fields: FormField[] = [
  { name: 'title', label: 'Title', required: true, colSpan: 2 },
  { name: 'date', label: 'Date', type: 'date', required: true },
  { name: 'time', label: 'Time', required: true },
  { name: 'duration', label: 'Duration (min)', type: 'number', required: true },
  { name: 'type', label: 'Type', type: 'select', options: [
    { label: 'Meeting', value: 'meeting' }, { label: 'Deadline', value: 'deadline' },
    { label: 'Hearing', value: 'hearing' }, { label: 'Internal', value: 'internal' },
    { label: 'Compliance', value: 'compliance' },
  ]},
  { name: 'clientName', label: 'Client (optional)' },
]

export default function CalendarPage() {
  const [view, setView] = useState<ViewMode>('month')
  const [cursor, setCursor] = useState(dayjs())
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<CalendarEvent | null>(null)
  const [deleting, setDeleting] = useState<CalendarEvent | null>(null)
  const [saving, setSaving] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const { data = [], isLoading } = useQuery({
    queryKey: ['calendar'],
    queryFn: () => CalendarService.getAll(),
  })

  const { data: complianceRows = [] } = useQuery({
    queryKey: ['calendar-compliance'],
    queryFn: async () => {
      const res = await ComplianceService.getAll({ page: 1, pageSize: 50 })
      return res.data.filter((c) => c.status !== 'completed').slice(0, 12)
    },
  })

  const complianceEvents = useMemo(() => {
    return complianceRows.map((c) => ({
      id: `cmp-${c.id}`,
      title: String(c.service),
      date: String(c.dueDate),
      time: '09:00',
      duration: 60,
      type: 'compliance',
      clientName: String(c.clientName),
      clientId: String(c.clientId || ''),
      assignedTo: '',
      color: '#8b5cf6',
    })) as CalendarEvent[]
  }, [complianceRows])

  const allEvents = useMemo(() => [...data, ...complianceEvents], [data, complianceEvents])

  const invalidate = () => invalidateAfterMutation(queryClient, ['calendar'])

  const daysInGrid = useMemo(() => {
    if (view === 'day') return [cursor.startOf('day')]
    if (view === 'week') {
      const start = cursor.startOf('week')
      return Array.from({ length: 7 }, (_, i) => start.add(i, 'day'))
    }
    const start = cursor.startOf('month').startOf('week')
    return Array.from({ length: 42 }, (_, i) => start.add(i, 'day'))
  }, [cursor, view])

  const eventsOn = (day: dayjs.Dayjs) =>
    allEvents.filter((e) => dayjs(e.date).format('YYYY-MM-DD') === day.format('YYYY-MM-DD'))

  const handleSubmit = async (form: EventForm) => {
    setSaving(true)
    try {
      const payload = { ...form, clientId: null as string | null, assignedTo: '', color: '#4f46e5' }
      if (editing && !String(editing.id).startsWith('cmp-')) {
        await CalendarService.update(editing.id, payload)
        toast.success('Event updated')
      } else {
        await CalendarService.create(payload)
        toast.success('Event created')
      }
      setFormOpen(false)
      setEditing(null)
      invalidate()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const onDropDay = async (day: dayjs.Dayjs) => {
    if (!dragId || dragId.startsWith('cmp-')) return
    try {
      await CalendarService.update(dragId, { date: day.format('YYYY-MM-DD') })
      toast.success('Event moved')
      invalidate()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Move failed')
    } finally {
      setDragId(null)
    }
  }

  const title = view === 'month' ? cursor.format('MMMM YYYY') : view === 'week' ? `Week of ${cursor.startOf('week').format('DD MMM')}` : cursor.format('dddd, DD MMM YYYY')

  return (
    <div className="space-y-4">
      <PageHeader
        title="Calendar"
        description="Month / week / day views with drag-and-drop and upcoming compliance due dates"
        actions={
          <Can permission="dashboard.view">
            <Button onClick={() => { setEditing(null); setFormOpen(true) }}>
              <Plus className="h-4 w-4" /> Add Event
            </Button>
          </Can>
        }
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setCursor((c) => c.subtract(1, view === 'month' ? 'month' : view === 'week' ? 'week' : 'day'))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCursor(dayjs())}>Today</Button>
          <Button variant="outline" size="sm" onClick={() => setCursor((c) => c.add(1, view === 'month' ? 'month' : view === 'week' ? 'week' : 'day'))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 ml-2">{title}</h2>
        </div>
        <div className="flex gap-1 p-1 rounded-xl bg-gray-100 dark:bg-gray-800">
          {(['month', 'week', 'day'] as ViewMode[]).map((v) => (
            <button key={v} type="button" onClick={() => setView(v)} className={cn('px-3 py-1.5 rounded-lg text-xs font-medium capitalize', view === v ? 'bg-white dark:bg-gray-900 text-primary-700 dark:text-primary-300 shadow-sm' : 'text-gray-600 dark:text-gray-400')}>
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-gray-600 dark:text-gray-400">
        {Object.entries(TYPE_COLORS).map(([type, color]) => (
          <span key={type} className="inline-flex items-center gap-1.5 capitalize">
            <span className={cn('h-2.5 w-2.5 rounded-full', color)} /> {type}
          </span>
        ))}
      </div>

      {isLoading ? (
        <Card><p className="text-sm text-gray-500">Loading calendar...</p></Card>
      ) : (
        <Card padding={false} className="overflow-hidden">
          {view === 'month' && (
            <div className="grid grid-cols-7 border-b border-gray-100 dark:border-gray-800">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <div key={d} className="px-2 py-2 text-center text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase">{d}</div>
              ))}
            </div>
          )}
          <div className={cn('grid', view === 'month' ? 'grid-cols-7' : view === 'week' ? 'grid-cols-7' : 'grid-cols-1')}>
            {daysInGrid.map((day) => {
              const inMonth = day.month() === cursor.month()
              const isToday = day.isSame(dayjs(), 'day')
              const dayEvents = eventsOn(day)
              return (
                <div
                  key={day.toString()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => void onDropDay(day)}
                  className={cn(
                    'min-h-[96px] sm:min-h-[110px] border border-gray-50 dark:border-gray-800 p-1.5',
                    view !== 'month' && 'min-h-[220px]',
                    !inMonth && view === 'month' && 'bg-gray-50/60 dark:bg-gray-900/40',
                    isToday && 'bg-primary-50/40 dark:bg-primary-900/10'
                  )}
                >
                  <button
                    type="button"
                    className={cn('text-xs font-semibold mb-1 h-6 w-6 rounded-full', isToday ? 'bg-primary-600 text-white' : 'text-gray-700 dark:text-gray-300')}
                    onClick={() => { setCursor(day); setView('day') }}
                  >
                    {day.date()}
                  </button>
                  <div className="space-y-1">
                    {dayEvents.slice(0, view === 'month' ? 3 : 12).map((ev) => (
                      <button
                        key={ev.id}
                        type="button"
                        draggable={!String(ev.id).startsWith('cmp-')}
                        onDragStart={() => setDragId(ev.id)}
                        onClick={() => {
                          if (String(ev.id).startsWith('cmp-')) {
                            toast('Compliance due date — open Compliance module to edit', { icon: '📌' })
                            return
                          }
                          setEditing(ev)
                          setFormOpen(true)
                        }}
                        className={cn('w-full text-left text-[10px] sm:text-xs px-1.5 py-0.5 rounded text-white truncate', TYPE_COLORS[ev.type] || 'bg-gray-500')}
                        title={`${ev.time} ${ev.title}`}
                      >
                        {ev.time} {ev.title}
                      </button>
                    ))}
                    {dayEvents.length > (view === 'month' ? 3 : 12) && (
                      <p className="text-[10px] text-gray-400">+{dayEvents.length - 3} more</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      <Card>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Upcoming compliance</h3>
        <div className="flex flex-wrap gap-2">
          {complianceEvents.slice(0, 8).map((e) => (
            <Badge key={e.id}>{e.date}: {e.title}</Badge>
          ))}
          {!complianceEvents.length && <p className="text-sm text-gray-500">No upcoming compliance due dates.</p>}
        </div>
      </Card>

      <EntityFormModal
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditing(null) }}
        onSubmit={handleSubmit}
        title={editing ? 'Edit Event' : 'Add Event'}
        fields={fields}
        schema={eventSchema}
        defaultValues={editing ? {
          title: editing.title, date: editing.date, time: editing.time,
          duration: editing.duration, type: editing.type, clientName: editing.clientName || '',
        } : {
          date: cursor.format('YYYY-MM-DD'), time: '10:00', duration: 60, type: 'meeting',
        }}
        loading={saving}
      />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return
          deleteWithUndo({
            collection: COLLECTION.calendar,
            record: { ...deleting } as unknown as Record<string, unknown> & { id: string },
            label: deleting.title,
            performDelete: () => { CalendarService.delete(deleting.id) },
            onRestored: invalidate,
          })
          setDeleting(null)
          invalidate()
        }}
        title="Delete Event"
        message={`Delete "${deleting?.title}"?`}
        confirmLabel="Delete"
      />
    </div>
  )
}
