import { http } from './httpClient'

export type AIUsage = {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export type AIResult = {
  reply: string
  markdown: string
  json?: Record<string, unknown>
  model: string
  provider: string
  usage: AIUsage
  latencyMs: number
  cached: boolean
  template: string
  suggestions?: string[]
}

export type AIChatMessage = { role: 'user' | 'assistant'; content: string }

/** All AI calls go through the Go API — never call Gemini from the browser. */
export const AIService = {
  chat(message: string, history: AIChatMessage[] = [], clientId?: string) {
    return http.post<AIResult>(
      '/ai/chat',
      { message, history, clientId },
      { timeoutMs: 90_000 },
    )
  },
  summarize(text: string) {
    return http.post<AIResult>('/ai/summarize', { text }, { timeoutMs: 90_000 })
  },
  email(input: { purpose: string; clientId?: string; tone?: string; details?: string }) {
    return http.post<AIResult>('/ai/email', input, { timeoutMs: 90_000 })
  },
  clientSummary(clientId: string, question?: string) {
    return http.post<AIResult>(
      '/ai/client-summary',
      { clientId, question },
      { timeoutMs: 90_000 },
    )
  },
  documentAnalysis(input: { documentId?: string; excerpt?: string; question?: string }) {
    return http.post<AIResult>('/ai/document-analysis', input, { timeoutMs: 90_000 })
  },
  dashboardInsights(focus?: string) {
    return http.post<AIResult>(
      '/ai/dashboard-insights',
      { focus },
      { timeoutMs: 90_000 },
    )
  },
}
