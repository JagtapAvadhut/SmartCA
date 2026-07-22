import { createCrudService } from './crudFactory'
import type { Document } from '@/types'

function generateMockPreview(name: string, clientName: string, type: string, version = 1): string {
  const label = type.replace(/_/g, ' ')
  return [
    `Document: ${name}`,
    `Client: ${clientName}`,
    `Type: ${label}`,
    `Version: ${version}`,
    '',
    '--- Document summary ---',
    '',
    `Working copy of "${name}" for ${clientName}.`,
    'Use Download / Open to access the filed original from your DMS.',
    '',
    'Checklist:',
    '• Period and entity details match client master',
    '• Supporting annexures attached where required',
    '• Ready for partner review before client delivery',
  ].join('\n')
}

const base = createCrudService<Document>('documents', {
  beforeCreate: (data) => ({
    type: 'other',
    folder: 'Invoices',
    size: 102400,
    mimeType: 'application/pdf',
    uploadedBy: '',
    uploadedAt: new Date().toISOString().split('T')[0],
    tags: ['pending_review'],
    status: 'active',
    favourite: false,
    contentPreview:
      data.name && data.clientName
        ? generateMockPreview(String(data.name), String(data.clientName), String(data.type || 'other'))
        : undefined,
    ...data,
  }),
})

export const DocumentService = {
  ...base,

  async getByClient(clientId: string) {
    return base.find({ clientId })
  },

  async getFolders() {
    const docs = await base.find()
    const folders = [...new Set(docs.map((d) => d.folder))]
    return folders.map((folder) => ({
      name: folder,
      count: docs.filter((d) => d.folder === folder).length,
    }))
  },

  async updateMetadata(
    id: string,
    data: Partial<Pick<Document, 'name' | 'type' | 'folder' | 'tags' | 'clientId' | 'clientName'>>,
  ) {
    return base.update(id, data)
  },

  async toggleFavourite(id: string) {
    const doc = await base.getById(id)
    return base.update(id, { favourite: !doc.favourite })
  },

  async archive(id: string) {
    return base.archive(id)
  },

  async restore(id: string) {
    return base.restore(id)
  },

  async duplicate(id: string, overrides?: Partial<Document>) {
    const source = await base.getById(id)
    return base.duplicate(id, {
      name: `${source.name} (Copy)`,
      favourite: false,
      versions: undefined,
      ...overrides,
    })
  },

  async replaceDocument(id: string, note?: string) {
    const doc = await base.getById(id)
    const existingVersions = doc.versions || []
    const versionEntry = {
      version: existingVersions.length + 1,
      name: doc.name,
      uploadedAt: doc.uploadedAt,
      uploadedBy: doc.uploadedBy,
      size: doc.size,
      note,
    }
    const nextVersion = existingVersions.length + 2

    return base.update(id, {
      uploadedAt: new Date().toISOString().split('T')[0],
      size: doc.size + Math.floor(Math.random() * 50000) + 1024,
      versions: [...existingVersions, versionEntry],
      contentPreview: generateMockPreview(doc.name, doc.clientName, doc.type, nextVersion),
    })
  },

  async moveToFolder(id: string, folder: string) {
    return base.update(id, { folder })
  },

  async getRecent(limit = 8) {
    const res = await base.getAll({ page: 1, pageSize: limit, sortBy: 'uploadedAt', sortOrder: 'desc' })
    return res.data
  },

  async getFavourites() {
    const docs = await base.find()
    return docs
      .filter((d) => d.favourite)
      .sort((a, b) => String(b.uploadedAt).localeCompare(String(a.uploadedAt)))
  },
}
