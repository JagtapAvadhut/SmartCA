import { Fragment, useState, useEffect } from 'react'
import { Combobox, ComboboxInput, ComboboxOption, ComboboxOptions, Dialog, DialogPanel, Transition, TransitionChild } from '@headlessui/react'
import { Search, Users, FileText, FolderOpen, CheckSquare, LayoutDashboard, Building2, ShieldCheck } from 'lucide-react'
import { useNavigate } from 'react-router'
import { useAppStore } from '@/store'
import { useDebounce } from '@/hooks/useDebounce'
import { SearchService, type SearchResult } from '@/services/searchService'
import { NAVIGATION } from '@/constants/navigation'
import { cn } from '@/utils'

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  page: LayoutDashboard,
  client: Users,
  invoice: FileText,
  document: FolderOpen,
  employee: Users,
  task: CheckSquare,
  compliance: ShieldCheck,
  user: Users,
  company: Building2,
}

const quickActions = [
  { id: 'new-client', label: 'Add New Client', path: '/clients', group: 'Quick Actions' },
  { id: 'new-invoice', label: 'Create Invoice', path: '/invoices', group: 'Quick Actions' },
  { id: 'new-task', label: 'Create Task', path: '/tasks', group: 'Quick Actions' },
  { id: 'new-note', label: 'New Note', path: '/notes', group: 'Quick Actions' },
  { id: 'calendar', label: 'Open Calendar', path: '/calendar', group: 'Quick Actions' },
  { id: 'ai-chat', label: 'Ask AI Assistant', path: '/ai', group: 'Quick Actions' },
]

export function CommandPalette() {
  const { commandPaletteOpen, setCommandPaletteOpen } = useAppStore()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const debouncedQuery = useDebounce(query, 200)
  const navigate = useNavigate()

  useEffect(() => {
    if (!commandPaletteOpen) {
      setQuery('')
      setResults([])
    }
  }, [commandPaletteOpen])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setCommandPaletteOpen(!useAppStore.getState().commandPaletteOpen)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setCommandPaletteOpen])

  useEffect(() => {
    if (!debouncedQuery) {
      const defaultItems: SearchResult[] = [
        ...NAVIGATION.map((item) => ({ id: item.id, type: 'page' as const, title: item.label, path: item.path })),
        ...quickActions.map((a) => ({ id: a.id, type: 'page' as const, title: a.label, path: a.path })),
      ]
      setResults(defaultItems)
      return
    }

    setLoading(true)
    SearchService.search(debouncedQuery).then((r) => {
      setResults(r)
      setLoading(false)
    })
  }, [debouncedQuery])

  const handleSelect = (item: SearchResult | null) => {
    if (!item) return
    setCommandPaletteOpen(false)
    setQuery('')
    navigate(item.path)
  }

  return (
    <Transition show={commandPaletteOpen} as={Fragment}>
      <Dialog onClose={() => setCommandPaletteOpen(false)} className="relative z-[60]">
        <TransitionChild as={Fragment} enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
        </TransitionChild>

        <div className="fixed inset-0 flex items-start justify-center pt-[15vh] px-4">
          <TransitionChild as={Fragment} enter="ease-out duration-200" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-150" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
            <DialogPanel className="w-full max-w-lg bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-700">
              <Combobox onChange={handleSelect}>
                <div className="flex items-center gap-3 px-4 border-b border-gray-100 dark:border-gray-700">
                  <Search className="h-5 w-5 text-gray-400" />
                  <ComboboxInput
                    className="w-full py-4 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 bg-transparent focus:outline-none"
                    placeholder="Search pages, clients, invoices..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    autoFocus
                  />
                  <kbd className="hidden sm:inline-flex items-center px-2 py-0.5 text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 rounded">ESC</kbd>
                </div>
                <ComboboxOptions static className="max-h-80 overflow-y-auto p-2">
                  {loading ? (
                    <p className="px-4 py-8 text-center text-sm text-gray-400">Searching...</p>
                  ) : results.length === 0 ? (
                    <p className="px-4 py-8 text-center text-sm text-gray-400">No results found</p>
                  ) : (
                    results.map((item) => {
                      const Icon = TYPE_ICONS[item.type] || Search
                      return (
                        <ComboboxOption key={`${item.type}-${item.id}`} value={item} className={({ focus }) => cn(
                          'flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer text-sm',
                          focus && 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                        )}>
                          <Icon className="h-4 w-4 text-gray-400 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{item.title}</p>
                            {item.subtitle && <p className="text-xs text-gray-400 truncate">{item.subtitle}</p>}
                          </div>
                          <span className="text-xs text-gray-400 capitalize shrink-0">{item.type}</span>
                        </ComboboxOption>
                      )
                    })
                  )}
                </ComboboxOptions>
              </Combobox>
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  )
}
