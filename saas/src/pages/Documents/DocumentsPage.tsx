import { useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router'
import {
  FolderOpen, File, Upload, Grid, List, Download, Trash2, Star, Eye, History,
  Pencil, Copy, Archive, FolderInput, RefreshCw, Clock, Filter, X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { DocumentService, ClientService } from '@/services'
import { COLLECTION } from '@/db'
import {
  PageHeader, Card, Button, SearchInput, Can, EntityFormModal, ConfirmDialog,
  Modal, Badge, type FormField,
} from '@/components/common'
import { formatDate, formatFileSize, deleteWithUndo, invalidateAfterMutation, cn, capitalize } from '@/utils'
import { documentSchema, type DocumentForm } from '@/schemas/entities'
import type { Document } from '@/types'
import { exportToCSV } from '@/utils/export'

const FOLDER_OPTIONS = [
  { label: 'GST Returns', value: 'GST Returns' },
  { label: 'ITR Documents', value: 'ITR Documents' },
  { label: 'Audit Reports', value: 'Audit Reports' },
  { label: 'Agreements', value: 'Agreements' },
  { label: 'Invoices', value: 'Invoices' },
  { label: 'Bank Statements', value: 'Bank Statements' },
]

const TYPE_OPTIONS = [
  { label: 'All types', value: '' },
  { label: 'Invoice', value: 'invoice' },
  { label: 'GST Return', value: 'gst_return' },
  { label: 'ITR', value: 'itr' },
  { label: 'Audit Report', value: 'audit_report' },
  { label: 'Agreement', value: 'agreement' },
  { label: 'PAN Card', value: 'pan_card' },
  { label: 'Other', value: 'other' },
]

function getPreviewContent(doc: Document): string {
  if (doc.contentPreview) return doc.contentPreview
  if (doc.mimeType.includes('pdf')) {
    return [
      '[PDF Preview]',
      '',
      doc.name,
      `Client: ${doc.clientName}`,
      `Type: ${capitalize(doc.type)}`,
      `Folder: ${doc.folder}`,
      '',
      'Mock PDF content — page 1 of 3',
      '',
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit. This preview simulates',
      'rendered PDF text extracted from the uploaded document.',
    ].join('\n')
  }
  return [
    `Document: ${doc.name}`,
    `Client: ${doc.clientName}`,
    `Type: ${capitalize(doc.type)}`,
    `Uploaded: ${formatDate(doc.uploadedAt)}`,
    `Size: ${formatFileSize(doc.size)}`,
    '',
    '--- Mock Content ---',
    '',
    `Preview of ${doc.name} for ${doc.clientName}.`,
  ].join('\n')
}

function docTypeColor(type: string) {
  const map: Record<string, string> = {
    invoice: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600',
    gst_return: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600',
    itr: 'bg-violet-50 dark:bg-violet-900/20 text-violet-600',
    audit_report: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600',
    agreement: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600',
    pan_card: 'bg-rose-50 dark:bg-rose-900/20 text-rose-600',
  }
  return map[type] || 'bg-red-50 dark:bg-red-900/20 text-red-500'
}

export default function DocumentsPage() {
  const [params] = useSearchParams()
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [search, setSearch] = useState('')
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const [favouritesOnly, setFavouritesOnly] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Document | null>(null)
  const [deleting, setDeleting] = useState<Document | null>(null)
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null)
  const [versionDoc, setVersionDoc] = useState<Document | null>(null)
  const [moveTarget, setMoveTarget] = useState<Document | null>(null)
  const [replaceTarget, setReplaceTarget] = useState<Document | null>(null)
  const [replaceNote, setReplaceNote] = useState('')
  const [moveFolder, setMoveFolder] = useState('')
  const [prefillClientId, setPrefillClientId] = useState('')
  const [saving, setSaving] = useState(false)
  const queryClient = useQueryClient()

  useEffect(() => {
    const clientId = params.get('clientId') || ''
    const upload = params.get('upload') === '1'
    if (clientId) setPrefillClientId(clientId)
    if (upload) {
      setEditing(null)
      setFormOpen(true)
    }
  }, [params])

  const { data: docs } = useQuery({
    queryKey: ['documents'],
    queryFn: () => DocumentService.getAll({ pageSize: 500, sortBy: 'uploadedAt', sortOrder: 'desc' }),
  })
  const { data: folders } = useQuery({
    queryKey: ['document-folders'],
    queryFn: () => DocumentService.getFolders(),
  })
  const { data: clients } = useQuery({
    queryKey: ['clients-options'],
    queryFn: () => ClientService.getAll({ pageSize: 500 }),
  })
  const { data: recentDocs = [] } = useQuery({
    queryKey: ['documents-recent'],
    queryFn: () => DocumentService.getRecent(6),
  })
  const { data: favouriteDocs = [] } = useQuery({
    queryKey: ['documents-favourites'],
    queryFn: () => DocumentService.getFavourites(),
  })

  const invalidate = () => {
    invalidateAfterMutation(queryClient, [
      'documents', 'document-folders', 'documents-recent', 'documents-favourites', 'recycle-bin',
    ])
  }

  const allTags = useMemo(() => {
    const tags = new Set<string>()
    docs?.data.forEach((d) => d.tags.forEach((t) => tags.add(t)))
    return [...tags].sort()
  }, [docs?.data])

  const filtered = useMemo(() => {
    if (!docs?.data) return []
    const q = search.trim().toLowerCase()
    return docs.data.filter((d) => {
      const matchSearch = !q
        || d.name.toLowerCase().includes(q)
        || d.clientName.toLowerCase().includes(q)
        || d.tags.some((t) => t.toLowerCase().includes(q))
      const matchFolder = !selectedFolder || d.folder === selectedFolder
      const matchType = !typeFilter || d.type === typeFilter
      const matchTag = !tagFilter || d.tags.includes(tagFilter)
      const matchFav = !favouritesOnly || d.favourite
      return matchSearch && matchFolder && matchType && matchTag && matchFav
    })
  }, [docs?.data, search, selectedFolder, typeFilter, tagFilter, favouritesOnly])

  const hasActiveFilters = !!(typeFilter || tagFilter || favouritesOnly || search)

  const fields: FormField[] = [
    { name: 'name', label: 'Document Name', required: true, colSpan: 2 },
    {
      name: 'clientId', label: 'Client', type: 'select',
      options: (clients?.data || []).map((c) => ({ label: c.name, value: c.id })),
      required: true,
      syncLabelTo: 'clientName',
    },
    { name: 'clientName', label: 'Client Name', hidden: true },
    {
      name: 'type', label: 'Type', type: 'select', options: TYPE_OPTIONS.filter((o) => o.value),
    },
    { name: 'folder', label: 'Folder', type: 'select', options: FOLDER_OPTIONS },
    { name: 'tags', label: 'Tags (comma separated)' },
  ]

  const handleSubmit = async (form: DocumentForm) => {
    setSaving(true)
    try {
      const client = clients?.data.find((c) => c.id === form.clientId)
      const payload = {
        ...form,
        clientName: client?.name || form.clientName,
        tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : ['pending_review'],
      }
      if (editing) {
        await DocumentService.updateMetadata(editing.id, payload)
        toast.success('Document updated')
      } else {
        await DocumentService.create(payload)
        toast.success('Document uploaded')
      }
      setFormOpen(false)
      setEditing(null)
      invalidate()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!deleting) return
      const record = { ...deleting } as unknown as Record<string, unknown> & { id: string }
      deleteWithUndo({
        collection: COLLECTION.documents,
        record,
        label: deleting.name,
        performDelete: () => { DocumentService.delete(deleting.id) },
        onRestored: invalidate,
      })
      setDeleting(null)
      invalidate()
    },
  })

  const handleArchive = () => {
    if (!deleting) return
    DocumentService.archive(deleting.id)
    toast.success(`"${deleting.name}" archived — restore from Recycle Bin`)
    setDeleting(null)
    invalidate()
  }

  const handleDownload = (doc: Document) => {
    const content = getPreviewContent(doc)
    const ext = doc.mimeType.includes('pdf') ? 'pdf.txt' : 'txt'
    const blob = new Blob([content], { type: 'text/plain' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${doc.name.replace(/[^a-z0-9]/gi, '_')}.${ext}`
    link.click()
    URL.revokeObjectURL(link.href)
    toast.success(`Downloaded ${doc.name}`)
  }

  const toggleFavourite = async (doc: Document) => {
    await DocumentService.toggleFavourite(doc.id)
    toast.success(doc.favourite ? 'Removed from favourites' : 'Added to favourites')
    invalidate()
  }

  const handleDuplicate = async (doc: Document) => {
    await DocumentService.duplicate(doc.id)
    toast.success('Document duplicated')
    invalidate()
  }

  const handleReplace = async () => {
    if (!replaceTarget) return
    setSaving(true)
    try {
      await DocumentService.replaceDocument(replaceTarget.id, replaceNote || undefined)
      toast.success(`New version uploaded for "${replaceTarget.name}"`)
      setReplaceTarget(null)
      setReplaceNote('')
      invalidate()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Replace failed')
    } finally {
      setSaving(false)
    }
  }

  const handleMove = async () => {
    if (!moveTarget || !moveFolder) return
    setSaving(true)
    try {
      await DocumentService.moveToFolder(moveTarget.id, moveFolder)
      toast.success(`Moved to ${moveFolder}`)
      setMoveTarget(null)
      setMoveFolder('')
      invalidate()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Move failed')
    } finally {
      setSaving(false)
    }
  }

  const clearFilters = () => {
    setSearch('')
    setTypeFilter('')
    setTagFilter('')
    setFavouritesOnly(false)
    setSelectedFolder(null)
  }

  const formDefaults = editing
    ? {
        name: editing.name,
        clientId: editing.clientId,
        clientName: editing.clientName,
        type: editing.type,
        folder: editing.folder,
        tags: editing.tags.join(', '),
      }
    : {
        type: 'other',
        folder: 'Invoices',
        clientName: clients?.data.find((c) => c.id === prefillClientId)?.name || '',
        clientId: prefillClientId,
      }

  const DocActions = ({ doc, compact = false }: { doc: Document; compact?: boolean }) => (
    <div className={cn('flex items-center gap-1', compact ? 'flex-wrap' : '')}>
      <button
        type="button"
        onClick={() => toggleFavourite(doc)}
        className={cn(
          'p-1.5 rounded-lg transition-colors',
          doc.favourite
            ? 'text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20'
            : 'text-gray-400 hover:text-amber-500 hover:bg-gray-50 dark:hover:bg-gray-800',
        )}
        title={doc.favourite ? 'Remove favourite' : 'Add to favourites'}
      >
        <Star className={cn('h-3.5 w-3.5', doc.favourite && 'fill-current')} />
      </button>
      <button type="button" onClick={() => setPreviewDoc(doc)} className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-gray-50 dark:hover:bg-gray-800" title="Preview">
        <Eye className="h-3.5 w-3.5" />
      </button>
      <button type="button" onClick={() => handleDownload(doc)} className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-gray-50 dark:hover:bg-gray-800" title="Download">
        <Download className="h-3.5 w-3.5" />
      </button>
      <Can permission="documents.upload">
        <button type="button" onClick={() => { setEditing(doc); setFormOpen(true) }} className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-gray-50 dark:hover:bg-gray-800" title="Edit metadata">
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button type="button" onClick={() => { setReplaceTarget(doc); setReplaceNote('') }} className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-gray-50 dark:hover:bg-gray-800" title="Replace (new version)">
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </Can>
      <button type="button" onClick={() => handleDuplicate(doc)} className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-gray-50 dark:hover:bg-gray-800" title="Duplicate">
        <Copy className="h-3.5 w-3.5" />
      </button>
      <button type="button" onClick={() => { setMoveTarget(doc); setMoveFolder(doc.folder) }} className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-gray-50 dark:hover:bg-gray-800" title="Move to folder">
        <FolderInput className="h-3.5 w-3.5" />
      </button>
      {(doc.versions?.length ?? 0) > 0 && (
        <button type="button" onClick={() => setVersionDoc(doc)} className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-gray-50 dark:hover:bg-gray-800" title="Version history">
          <History className="h-3.5 w-3.5" />
        </button>
      )}
      <button type="button" onClick={() => setDeleting(doc)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" title="Delete">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  )

  const QuickStrip = ({ title, icon: Icon, items }: { title: string; icon: typeof Star; items: Document[] }) => {
    if (!items.length) return null
    return (
      <Card padding className="mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Icon className="h-4 w-4 text-primary-600" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-thin">
          {items.map((doc) => (
            <button
              key={doc.id}
              type="button"
              onClick={() => setPreviewDoc(doc)}
              className="shrink-0 w-44 p-3 rounded-xl border border-gray-100 dark:border-gray-800 hover:border-primary-200 dark:hover:border-primary-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 text-left transition-colors"
            >
              <div className="flex items-center gap-2 mb-1">
                <File className="h-4 w-4 text-red-500 shrink-0" />
                <span className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">{doc.name}</span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{doc.clientName}</p>
              <p className="text-xs text-gray-400 mt-1">{formatDate(doc.uploadedAt)}</p>
            </button>
          ))}
        </div>
      </Card>
    )
  }

  return (
    <div>
      <PageHeader
        title="Documents"
        description="Manage client documents, versions, and folders"
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => exportToCSV(
                (filtered || []).map((d) => ({
                  name: d.name, client: d.clientName, folder: d.folder, type: d.type, tags: d.tags.join('; '),
                })),
                'documents',
              )}
            >
              Export
            </Button>
            <Can permission="documents.upload">
              <Button onClick={() => { setEditing(null); setFormOpen(true) }}>
                <Upload className="h-4 w-4" /> Upload
              </Button>
            </Can>
          </>
        }
      />

      <div className="mb-4 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
        <Archive className="h-3.5 w-3.5" />
        <span>Archived documents are kept in</span>
        <Link to="/recycle-bin" className="text-primary-600 hover:underline font-medium">Recycle Bin</Link>
        <span>— restore anytime.</span>
      </div>

      <QuickStrip title="Recent" icon={Clock} items={recentDocs} />
      <QuickStrip title="Favourites" icon={Star} items={favouriteDocs.slice(0, 6)} />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card className="lg:col-span-1" padding>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Folders</h3>
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => setSelectedFolder(null)}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm',
                !selectedFolder
                  ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800',
              )}
            >
              <FolderOpen className="h-4 w-4" /> All Documents
              <span className="ml-auto text-xs text-gray-400">{docs?.total}</span>
            </button>
            {folders?.map((folder) => (
              <button
                key={folder.name}
                type="button"
                onClick={() => setSelectedFolder(folder.name)}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm',
                  selectedFolder === folder.name
                    ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800',
                )}
              >
                <FolderOpen className="h-4 w-4" /> {folder.name}
                <span className="ml-auto text-xs text-gray-400">{folder.count}</span>
              </button>
            ))}
          </div>
        </Card>

        <div className="lg:col-span-3 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search documents, clients, tags..."
              className="flex-1"
            />
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                <Filter className="h-3.5 w-3.5" />
              </div>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="h-9 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2.5 text-xs text-gray-700 dark:text-gray-300"
              >
                {TYPE_OPTIONS.map((o) => (
                  <option key={o.value || 'all'} value={o.value}>{o.label}</option>
                ))}
              </select>
              <select
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
                className="h-9 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2.5 text-xs text-gray-700 dark:text-gray-300"
              >
                <option value="">All tags</option>
                {allTags.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setFavouritesOnly((v) => !v)}
                className={cn(
                  'h-9 px-3 rounded-xl border text-xs flex items-center gap-1.5 transition-colors',
                  favouritesOnly
                    ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800',
                )}
              >
                <Star className={cn('h-3.5 w-3.5', favouritesOnly && 'fill-current')} /> Favourites
              </button>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="h-9 px-2 rounded-xl text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-1"
                >
                  <X className="h-3.5 w-3.5" /> Clear
                </button>
              )}
              <div className="flex border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setView('grid')}
                  className={cn('p-2', view === 'grid' ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/30' : 'text-gray-400')}
                >
                  <Grid className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setView('list')}
                  className={cn('p-2', view === 'list' ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/30' : 'text-gray-400')}
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400">
            {filtered.length} document{filtered.length !== 1 ? 's' : ''}
            {selectedFolder ? ` in ${selectedFolder}` : ''}
          </p>

          {view === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map((doc) => (
                <Card key={doc.id} hover className="group">
                  <div className="flex items-start gap-3">
                    <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center shrink-0', docTypeColor(doc.type))}>
                      <File className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate flex-1">{doc.name}</p>
                        {doc.favourite && <Star className="h-3.5 w-3.5 text-amber-500 fill-current shrink-0" />}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{doc.clientName}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        <Badge variant="default" className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                          {capitalize(doc.type)}
                        </Badge>
                        {doc.tags.slice(0, 2).map((t) => (
                          <Badge key={t} variant="default" className="bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-gray-400 dark:text-gray-500">
                    <span>{formatFileSize(doc.size)}</span>
                    <span>{formatDate(doc.uploadedAt)}</span>
                    {(doc.versions?.length ?? 0) > 0 && (
                      <span className="text-primary-600">v{(doc.versions?.length ?? 0) + 1}</span>
                    )}
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-50 dark:border-gray-800 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <DocActions doc={doc} compact />
                  </div>
                </Card>
              ))}
              {!filtered.length && (
                <div className="col-span-full py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                  No documents match your filters.
                </div>
              )}
            </div>
          ) : (
            <Card padding={false}>
              <div className="divide-y divide-gray-50 dark:divide-gray-800">
                {filtered.map((doc) => (
                  <div key={doc.id} className="flex items-center gap-3 px-4 sm:px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center shrink-0', docTypeColor(doc.type))}>
                      <File className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                        {doc.name}
                        {doc.favourite && <Star className="h-3 w-3 text-amber-500 fill-current" />}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {doc.clientName} · {doc.folder}
                        {(doc.versions?.length ?? 0) > 0 && ` · v${(doc.versions?.length ?? 0) + 1}`}
                      </p>
                    </div>
                    <div className="hidden md:flex flex-wrap gap-1 max-w-[140px]">
                      {doc.tags.slice(0, 2).map((t) => (
                        <span key={t} className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500">{t}</span>
                      ))}
                    </div>
                    <span className="text-xs text-gray-400 hidden sm:block">{formatFileSize(doc.size)}</span>
                    <span className="text-xs text-gray-400 hidden lg:block">{formatDate(doc.uploadedAt)}</span>
                    <DocActions doc={doc} />
                  </div>
                ))}
                {!filtered.length && (
                  <div className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                    No documents match your filters.
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>

      <EntityFormModal
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditing(null) }}
        onSubmit={async (form) => {
          const client = clients?.data.find((c) => c.id === form.clientId)
          await handleSubmit({ ...form, clientName: client?.name || form.clientName })
        }}
        title={editing ? 'Edit Document' : 'Upload Document'}
        fields={fields}
        schema={documentSchema}
        defaultValues={formDefaults}
        loading={saving}
        submitLabel={editing ? 'Save' : 'Upload'}
      />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleteMutation.mutate()}
        onArchive={handleArchive}
        title="Remove Document"
        message={`Remove "${deleting?.name}"? Archive keeps it in Recycle Bin for restore.`}
        confirmLabel="Delete permanently"
        archiveLabel="Archive instead"
        preferArchive
        loading={deleteMutation.isPending}
      />

      <Modal open={!!previewDoc} onClose={() => setPreviewDoc(null)} title={previewDoc?.name || 'Preview'} size="lg">
        {previewDoc && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400">
              <span>{previewDoc.clientName}</span>
              <span>·</span>
              <span>{capitalize(previewDoc.type)}</span>
              <span>·</span>
              <span>{previewDoc.folder}</span>
              <span>·</span>
              <span>{formatFileSize(previewDoc.size)}</span>
            </div>
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4 max-h-[50vh] overflow-y-auto">
              <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono leading-relaxed">
                {getPreviewContent(previewDoc)}
              </pre>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => handleDownload(previewDoc)}>
                <Download className="h-4 w-4" /> Download
              </Button>
              <Button onClick={() => setPreviewDoc(null)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!versionDoc} onClose={() => setVersionDoc(null)} title="Version History" size="lg">
        {versionDoc && (
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Current — v{(versionDoc.versions?.length ?? 0) + 1}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {versionDoc.name} · {formatDate(versionDoc.uploadedAt)} · {formatFileSize(versionDoc.size)}
              </p>
            </div>
            {[...(versionDoc.versions || [])].reverse().map((v) => (
              <div key={v.version} className="p-3 rounded-xl border border-gray-100 dark:border-gray-800">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">v{v.version}</p>
                  <span className="text-xs text-gray-400">{formatDate(v.uploadedAt)}</span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{v.name} · {formatFileSize(v.size)}</p>
                {v.note && <p className="text-xs text-gray-600 dark:text-gray-300 mt-2 italic">{v.note}</p>}
              </div>
            ))}
            {!versionDoc.versions?.length && (
              <p className="text-sm text-gray-500 dark:text-gray-400">No previous versions.</p>
            )}
          </div>
        )}
      </Modal>

      <Modal open={!!moveTarget} onClose={() => { setMoveTarget(null); setMoveFolder('') }} title="Move to Folder" size="sm">
        {moveTarget && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Move <strong className="text-gray-900 dark:text-gray-100">{moveTarget.name}</strong> to:
            </p>
            <select
              value={moveFolder}
              onChange={(e) => setMoveFolder(e.target.value)}
              className="w-full h-10 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 text-sm text-gray-900 dark:text-gray-100"
            >
              {FOLDER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setMoveTarget(null); setMoveFolder('') }}>Cancel</Button>
              <Button onClick={handleMove} loading={saving} disabled={!moveFolder || moveFolder === moveTarget.folder}>
                Move
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!replaceTarget} onClose={() => { setReplaceTarget(null); setReplaceNote('') }} title="Replace Document" size="sm">
        {replaceTarget && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Upload a new version of <strong className="text-gray-900 dark:text-gray-100">{replaceTarget.name}</strong>.
              The current file will be saved in version history.
            </p>
            <div>
              <label htmlFor="replace-note" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Version note (optional)
              </label>
              <textarea
                id="replace-note"
                value={replaceNote}
                onChange={(e) => setReplaceNote(e.target.value)}
                rows={3}
                placeholder="e.g. Updated with FY24 figures"
                className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setReplaceTarget(null); setReplaceNote('') }}>Cancel</Button>
              <Button onClick={handleReplace} loading={saving}>
                <RefreshCw className="h-4 w-4" /> Replace
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
