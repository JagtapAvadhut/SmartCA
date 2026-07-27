import { http } from './httpClient'

/** Legacy statuses kept for dual-read during Practice Core migration. */
export type LegacyWorkStatus = 'todo' | 'in_progress' | 'blocked' | 'review' | 'completed' | 'cancelled'

/** Practice Core v1 primary status enum (matches Go workmgmt transitions). */
export type PracticeStatus =
  | 'OPEN'
  | 'DOCUMENT_PENDING'
  | 'DOCUMENT_RECEIVED'
  | 'IN_PROGRESS'
  | 'BLOCKED'
  | 'ON_HOLD'
  | 'READY_FOR_TL_VERIFY'
  | 'TL_REJECTED'
  | 'TL_VERIFIED'
  | 'READY_FOR_CA_VERIFY'
  | 'CA_REJECTED'
  | 'CA_VERIFIED'
  | 'READY_FOR_MANAGER_CLOSE'
  | 'DELIVERED'
  | 'CLOSED'
  | 'CANCELLED'

export type WorkStatus = PracticeStatus | LegacyWorkStatus

export type WorkPriority = 'low' | 'medium' | 'high' | 'urgent'
export type WorkRiskClass = 'low' | 'medium' | 'high'
export type WorkOverlay = 'GSTR1_FILED' | 'GSTR3B_FILED' | 'ITR_UNDER_REVIEW' | 'NOTICE_REPLY_DUE' | string
export type VerifyDecision = 'pass' | 'fail'
export type AssignSlot = 'owner_ca' | 'tl' | 'assignee'
export type ChecklistStatus = 'pending' | 'received' | 'verified' | 'rejected'
export type IntakeStatus = 'INTAKE' | 'APPROVED' | 'REJECTED' | string

export const PRACTICE_STATUSES: PracticeStatus[] = [
  'OPEN',
  'DOCUMENT_PENDING',
  'DOCUMENT_RECEIVED',
  'IN_PROGRESS',
  'BLOCKED',
  'ON_HOLD',
  'READY_FOR_TL_VERIFY',
  'TL_REJECTED',
  'READY_FOR_CA_VERIFY',
  'CA_REJECTED',
  'READY_FOR_MANAGER_CLOSE',
  'DELIVERED',
  'CLOSED',
  'CANCELLED',
]

/** Board columns for practice Kanban (Architecture §9.2). */
export const PRACTICE_BOARD_COLUMNS: PracticeStatus[] = [
  'OPEN',
  'DOCUMENT_PENDING',
  'IN_PROGRESS',
  'BLOCKED',
  'READY_FOR_TL_VERIFY',
  'READY_FOR_CA_VERIFY',
  'READY_FOR_MANAGER_CLOSE',
  'CLOSED',
]

export const PRACTICE_OVERLAYS = [
  'GSTR1_FILED',
  'GSTR3B_FILED',
  'ITR_UNDER_REVIEW',
  'NOTICE_REPLY_DUE',
] as const

export interface WorkItem {
  id: string
  title: string
  description: string
  priority: WorkPriority
  status: WorkStatus
  dueDate?: string
  createdDate: string
  assignedBy: string
  assignedByName?: string
  assignedTo: string
  assignedToName?: string
  clientId?: string
  clientName: string
  companyId?: string
  engagementId?: string
  workType?: string
  periodKey?: string
  fy?: string
  overlay?: string
  riskClass?: WorkRiskClass | string
  ownerCaId?: string
  tlId?: string
  assigneeId?: string
  delegatedClose?: boolean
  requiresPartnerSignoff?: boolean
  department: string
  tags: string[]
  estimatedHours: number
  actualHours: number
  completionPct: number
  parentId?: string
  childCount?: number
  createdAt: string
  updatedAt: string
}

export interface WorkPage {
  items: WorkItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface WorkDashboard {
  pending: number
  completed: number
  overdue: number
  todaysWork: number
  myWork: number
  todaysFollowUps: number
  upcomingCalls: number
  pendingTasks: number
  completedTasks: number
  readyForTLVerify?: number
  readyForCAVerify?: number
  readyForManagerClose?: number
  awaitingClose?: number
  employeePerformance?: Record<string, number>
  caPerformance?: Record<string, number>
  teamLeaderPerformance?: Record<string, number>
  departmentSummary?: Record<string, number>
}

export interface WorkListParams {
  page?: number
  pageSize?: number
  sort?: string
  q?: string
  status?: string
  priority?: string
  assigneeId?: string
  clientId?: string
  companyId?: string
  department?: string
  overlay?: string
  workType?: string
  periodKey?: string
  ownerCaId?: string
  tlId?: string
}

export interface Engagement {
  id: string
  clientId: string
  companyId?: string
  ownerCaId: string
  services: string[]
  status: string
  fy?: string
  title?: string
  createdBy: string
  updatedBy: string
  createdAt: string
  updatedAt: string
}

export interface Intake {
  id: string
  status: IntakeStatus
  source: string
  contactName: string
  contactPhone?: string
  contactEmail?: string
  services: string[]
  notes?: string
  payload?: Record<string, unknown>
  createdBy: string
  approvedBy?: string
  rejectedBy?: string
  rejectRemarks?: string
  clientId?: string
  companyId?: string
  engagementId?: string
  ownerCaId?: string
  createdAt: string
  updatedAt: string
}

export interface ChecklistItem {
  id: string
  workItemId: string
  code: string
  label: string
  status: ChecklistStatus | string
  remarks?: string
  verifiedBy?: string
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface CreateIntakeBody {
  source?: string
  contactName: string
  contactPhone?: string
  contactEmail?: string
  services?: string[]
  notes?: string
  payload?: Record<string, unknown>
}

export interface ApproveIntakeBody {
  clientId: string
  companyId?: string
  ownerCaId: string
  engagementTitle?: string
  services?: string[]
}

function normalizeStatus(status: string | undefined): string {
  if (!status) return 'OPEN'
  const legacy: Record<string, PracticeStatus> = {
    todo: 'OPEN',
    in_progress: 'IN_PROGRESS',
    blocked: 'BLOCKED',
    review: 'READY_FOR_TL_VERIFY',
    completed: 'CLOSED',
    cancelled: 'CANCELLED',
  }
  const lower = status.toLowerCase()
  if (legacy[lower]) return legacy[lower]
  return status.toUpperCase()
}

/** Map API work item status to canonical practice status for UI. */
export function toPracticeStatus(status: string | undefined): PracticeStatus {
  const n = normalizeStatus(status)
  return (PRACTICE_STATUSES.includes(n as PracticeStatus) ? n : 'OPEN') as PracticeStatus
}

export const WorkService = {
  list(params: WorkListParams = {}) {
    return http.get<WorkPage>('/work/items', { params: params as Record<string, string | number | undefined> })
  },
  get(id: string) {
    return http.get<WorkItem>(`/work/items/${id}`)
  },
  create(body: Record<string, unknown>) {
    return http.post<WorkItem>('/work/items', body)
  },
  update(id: string, body: Record<string, unknown>) {
    return http.patch<WorkItem>(`/work/items/${id}`, body)
  },
  reassign(id: string, body: { assignedTo: string; assignedToName?: string; assigneeRole: string }) {
    return http.post<WorkItem>(`/work/items/${id}/reassign`, body)
  },
  transfer(id: string, body: { assignedTo: string; assignedToName?: string; assigneeRole: string }) {
    return http.post<WorkItem>(`/work/items/${id}/transfer`, body)
  },
  /** Ownership triad slot: owner_ca | tl | assignee */
  assignSlot(id: string, body: { slot: AssignSlot; userId: string; userName?: string; userRole?: string }) {
    return http.post<WorkItem>(`/work/items/${id}/assign`, body)
  },
  /** Non-verify legal transitions (e.g. submit for TL review). */
  transition(id: string, body: { to: string; remarks?: string; overlay?: string }) {
    return http.post<WorkItem>(`/work/items/${id}/transitions`, body)
  },
  verifyTL(id: string, body: { decision: VerifyDecision; remarks?: string }) {
    return http.post<WorkItem>(`/work/items/${id}/verify/tl`, body)
  },
  verifyCA(id: string, body: { decision: VerifyDecision; remarks?: string }) {
    return http.post<WorkItem>(`/work/items/${id}/verify/ca`, body)
  },
  close(id: string, body: { remarks?: string } = {}) {
    return http.post<WorkItem>(`/work/items/${id}/close`, body)
  },
  reopen(id: string, body: { reason: string }) {
    return http.post<WorkItem>(`/work/items/${id}/reopen`, body)
  },
  archive(id: string) {
    return http.post<{ message: string }>(`/work/items/${id}/archive`, {})
  },
  restore(id: string) {
    return http.post<{ message: string }>(`/work/items/${id}/restore`, {})
  },

  listChecklist(id: string) {
    return http.get<ChecklistItem[]>(`/work/items/${id}/checklist`)
  },
  addChecklist(id: string, body: { code: string; label: string; status?: string }) {
    return http.post<ChecklistItem>(`/work/items/${id}/checklist`, body)
  },
  verifyChecklist(id: string, cid: string, body: { decision: VerifyDecision; remarks?: string }) {
    return http.post<ChecklistItem>(`/work/items/${id}/checklist/${cid}/verify`, body)
  },

  listIntakes(params: { status?: string } = {}) {
    return http.get<Intake[]>('/work/intakes', { params: params as Record<string, string | undefined> })
  },
  createIntake(body: CreateIntakeBody) {
    return http.post<Intake>('/work/intakes', body)
  },
  approveIntake(id: string, body: ApproveIntakeBody) {
    return http.post<Intake>(`/work/intakes/${id}/approve`, body)
  },
  rejectIntake(id: string, body: { remarks: string }) {
    return http.post<Intake>(`/work/intakes/${id}/reject`, body)
  },

  listEngagements(params: { clientId?: string } = {}) {
    return http.get<Engagement[]>('/work/engagements', { params: params as Record<string, string | undefined> })
  },
  createEngagement(body: Partial<Engagement> & { clientId: string; ownerCaId: string }) {
    return http.post<Engagement>('/work/engagements', body)
  },

  dashboard() {
    return http.get<WorkDashboard>('/work/dashboard')
  },
  search(q: string) {
    return http.get<WorkItem[]>('/work/search', { params: { q } })
  },
  timeline(limit = 100) {
    return http.get<Array<Record<string, unknown>>>('/work/timeline', { params: { limit } })
  },
  followups(id: string) {
    return http.get<Array<Record<string, unknown>>>(`/work/items/${id}/followups`)
  },
  addFollowup(id: string, body: Record<string, unknown>) {
    return http.post(`/work/items/${id}/followups`, body)
  },
  calls(id: string) {
    return http.get<Array<Record<string, unknown>>>(`/work/items/${id}/calls`)
  },
  addCall(id: string, body: Record<string, unknown>) {
    return http.post(`/work/items/${id}/calls`, body)
  },
  emails(id: string) {
    return http.get<Array<Record<string, unknown>>>(`/work/items/${id}/emails`)
  },
  addEmail(id: string, body: Record<string, unknown>) {
    return http.post(`/work/items/${id}/emails`, body)
  },
  meetings(id: string) {
    return http.get<Array<Record<string, unknown>>>(`/work/items/${id}/meetings`)
  },
  addMeeting(id: string, body: Record<string, unknown>) {
    return http.post(`/work/items/${id}/meetings`, body)
  },
  notes(id: string) {
    return http.get<Array<Record<string, unknown>>>(`/work/items/${id}/notes`)
  },
  addNote(id: string, body: Record<string, unknown>) {
    return http.post(`/work/items/${id}/notes`, body)
  },
  comments(id: string) {
    return http.get<Array<Record<string, unknown>>>(`/work/items/${id}/comments`)
  },
  addComment(id: string, body: Record<string, unknown>) {
    return http.post(`/work/items/${id}/comments`, body)
  },
  attachments(id: string) {
    return http.get<Array<Record<string, unknown>>>(`/work/items/${id}/attachments`)
  },
  addAttachment(id: string, body: Record<string, unknown>) {
    return http.post(`/work/items/${id}/attachments`, body)
  },
  activity(id: string) {
    return http.get<Array<Record<string, unknown>>>(`/work/items/${id}/activity`)
  },
  audit(id: string) {
    return http.get<Array<Record<string, unknown>>>(`/work/items/${id}/audit`)
  },
  createTeamUser(body: Record<string, unknown>) {
    return http.post('/work/team/users', body)
  },
}
