/**
 * Mock database seed sources.
 * Runtime data lives in localStorage via MockDatabase engine.
 * JSON files under /src/mock are the initial seed.
 *
 * Collections: clients, companies, employees, invoices, payments,
 * documents, tasks, gst, itr, tds, roc, compliance, notifications,
 * activities, calendar, users, roles, permissions, organization,
 * settings, auditLogs, loginHistory, chat, departments, branches,
 * dashboard, reports, notes
 */
export { COLLECTION, initDatabase, resetDatabase, getCollection } from '@/db/seed'
export { MockDatabase } from '@/db/MockDatabase'
