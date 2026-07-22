import { http, getApiBaseUrl, getAuthToken } from './httpClient'

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

export type AIProviderName = 'mock' | 'gemini' | 'openai' | 'ollama'

export type AIPublicSettings = {
  provider: AIProviderName
  model: string
  baseUrl: string
  hasApiKey: boolean
  apiKeyMasked: string
  updatedAt?: string
  availableProviders: string[]
  suggestedModels: {
    gemini: string[]
    openai: string[]
    ollama: string[]
    mock: string[]
  }
}

export type AITestResult = {
  ok: boolean
  provider: string
  model: string
  message: string
}

export type AIStreamHandlers = {
  onDelta: (delta: string) => void
  onDone?: (meta: { model?: string; usage?: AIUsage }) => void
  onError?: (message: string) => void
  signal?: AbortSignal
}

function handleStreamUnauthorized() {
  try {
    localStorage.removeItem('smart-ca-token')
    localStorage.removeItem('smart-ca-auth')
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
    window.location.assign('/login')
  }
}

/** All AI calls go through the Go API — never call providers from the browser. */
export const AIService = {
  chat(message: string, history: AIChatMessage[] = [], clientId?: string) {
    return http.post<AIResult>(
      '/ai/chat',
      { message, history, clientId },
      { timeoutMs: 90_000 },
    )
  },

  async chatStream(
    message: string,
    history: AIChatMessage[],
    handlers: AIStreamHandlers,
    clientId?: string,
  ): Promise<void> {
    const token = getAuthToken()
    const res = await fetch(`${getApiBaseUrl()}/ai/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ message, history, clientId }),
      signal: handlers.signal,
    })
    if (!res.ok || !res.body) {
      if (res.status === 401) handleStreamUnauthorized()
      let msg = `AI stream failed (${res.status})`
      try {
        const j = (await res.json()) as { error?: { message?: string } }
        if (j?.error?.message) msg = j.error.message
      } catch {
        /* ignore */
      }
      handlers.onError?.(msg)
      throw new Error(msg)
    }
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      // Normalize CRLF so SSE frames split reliably behind any proxy.
      buffer = buffer.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
      const parts = buffer.split('\n\n')
      buffer = parts.pop() || ''
      for (const part of parts) {
        const dataLines = part
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => l.startsWith('data:'))
          .map((l) => l.replace(/^data:\s*/, ''))
        if (!dataLines.length) continue
        const payload = dataLines.join('\n')
        try {
          const evt = JSON.parse(payload) as {
            delta?: string
            done?: boolean
            model?: string
            usage?: AIUsage
            error?: string
          }
          if (evt.error) {
            handlers.onError?.(evt.error)
            throw new Error(evt.error)
          }
          if (evt.delta) handlers.onDelta(evt.delta)
          if (evt.done) handlers.onDone?.({ model: evt.model, usage: evt.usage })
        } catch (e) {
          if (e instanceof SyntaxError) continue
          throw e
        }
      }
    }
  },

  getSettings() {
    return http.get<AIPublicSettings>('/ai/settings')
  },

  saveSettings(body: {
    provider: AIProviderName
    model: string
    baseUrl?: string
    apiKey?: string
    clearApiKey?: boolean
  }) {
    return http.put<AIPublicSettings>('/ai/settings', body)
  },

  removeSettings() {
    return http.del<AIPublicSettings>('/ai/settings')
  },

  testSettings(body: {
    provider: AIProviderName
    model: string
    baseUrl?: string
    apiKey?: string
  }) {
    return http.post<AITestResult>('/ai/settings/test', body, { timeoutMs: 30_000 })
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
