import { createCrudService } from './crudFactory'
import { COLLECTION, getCollection } from '@/db'
import { simulateDelay } from './api'
import { documentRepository } from '@/repositories'
import type { Document } from '@/types'

function generateMockPreview(name: string, clientName: string, type: string, version = 1): string {
  return [
    `Document: ${name}`,
    `Client: ${clientName}`,
    `Type: ${type.replace(/_/g, ' ')}`,
    `Version: ${version}`,
    '',
    '--- Mock Preview ---',
    '',
    `This is a simulated preview of "${name}" prepared for ${clientName}.`,
    'In production this would render PDF pages or extracted text from the uploaded file.',
    '',
    'Key highlights:',
    '• Filing period verified against client records',
    '• Supporting schedules attached in annexure',
    '• Reviewed and approved for client delivery',
  ].join('\n')
}

const base = createCrudService<Document>(COLLECTION.documents, {
  searchFields: ['name', 'clientName', 'folder', 'type', 'tags'],
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
    contentPreview: data.name && data.clientName
      ? generateMockPreview(String(data.name), String(data.clientName), String(data.type || 'other'))
      : undefined,
    ...data,
  }),
})

export const DocumentService = {
  ...base,

  async getByClient(clientId: string) {
    await simulateDelay()
    return getCollection<Document>(COLLECTION.documents).find({ filter: { clientId } })
  },

  async getFolders() {
    await simulateDelay()
    const docs = getCollection<Document>(COLLECTION.documents).find()
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
    await simulateDelay(300)
    return documentRepository.update(id, data)
  },

  async toggleFavourite(id: string) {
    await simulateDelay(200)
    const doc = documentRepository.findById(id)
    if (!doc) throw new Error('Document not found')
    return documentRepository.update(id, { favourite: !doc.favourite })
  },

  async archive(id: string) {
    await simulateDelay(200)
    return documentRepository.archive(id)
  },

  async restore(id: string) {
    await simulateDelay(200)
    return documentRepository.restore(id)
  },

  async duplicate(id: string, overrides?: Partial<Document>) {
    await simulateDelay(300)
    const source = documentRepository.findById(id)
    if (!source) throw new Error('Document not found')
    return documentRepository.duplicate(id, {
      name: `${source.name} (Copy)`,
      favourite: false,
      versions: undefined,
      ...overrides,
    })
  },

  async replaceDocument(id: string, note?: string) {
    await simulateDelay(300)
    const doc = documentRepository.findById(id)
    if (!doc) throw new Error('Document not found')

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

    return documentRepository.update(id, {
      uploadedAt: new Date().toISOString().split('T')[0],
      size: doc.size + Math.floor(Math.random() * 50000) + 1024,
      versions: [...existingVersions, versionEntry],
      contentPreview: generateMockPreview(doc.name, doc.clientName, doc.type, nextVersion),
    })
  },

  async moveToFolder(id: string, folder: string) {
    await simulateDelay(200)
    return documentRepository.update(id, { folder })
  },

  async getRecent(limit = 8) {
    await simulateDelay()
    return getCollection<Document>(COLLECTION.documents).find({
      sortBy: 'uploadedAt',
      sortOrder: 'desc',
      pageSize: limit,
    })
  },

  async getFavourites() {
    await simulateDelay()
    return getCollection<Document>(COLLECTION.documents).find({
      filter: { favourite: true },
      sortBy: 'uploadedAt',
      sortOrder: 'desc',
    })
  },
}
