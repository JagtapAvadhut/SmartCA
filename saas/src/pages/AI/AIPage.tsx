import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Send, Plus, Bot, Sparkles, Trash2, Copy, RotateCcw, Eraser, User, Square, Settings2, MessageSquare, Pencil,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { AIService, ChatService, type AIChatMessage } from '@/services'
import { Button, Card } from '@/components/common'
import { cn } from '@/utils'
import type { ChatSession } from '@/types'
import AISettingsPanel from './AISettingsPanel'
import { SimpleMarkdown } from './markdown'

const SUGGESTIONS = [
  'Explain GST in simple English.',
  'Summarize overdue invoices and collection priorities.',
  'Generate a professional payment reminder email.',
  'Analyze invoice payment risk for this practice.',
  'Generate dashboard insights for compliance.',
  'What are GST filing deadlines for this quarter?',
]

type LocalMsg = {
  id: string
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
}

type Tab = 'chat' | 'settings'

export default function AIPage() {
  const [tab, setTab] = useState<Tab>('chat')
  const [activeSession, setActiveSession] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [localMsgs, setLocalMsgs] = useState<LocalMsg[]>([])
  const [lastUserPrompt, setLastUserPrompt] = useState('')
  const [providerLabel, setProviderLabel] = useState('mock')
  const [loadedSessionId, setLoadedSessionId] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const hydratedRef = useRef(false)
  const queryClient = useQueryClient()

  const { data: sessions } = useQuery({
    queryKey: ['chat-sessions'],
    queryFn: () => ChatService.getSessions(),
  })

  const { data: aiSettings } = useQuery({
    queryKey: ['ai-settings'],
    queryFn: () => AIService.getSettings(),
  })

  useEffect(() => {
    if (aiSettings?.provider) setProviderLabel(aiSettings.provider)
  }, [aiSettings])

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['chat-sessions'] })
  }
  const currentSession = sessions?.find((s) => s.id === activeSession) || sessions?.[0]

  // Auto-open the first / selected session so history is never blank while highlighted.
  useEffect(() => {
    if (!sessions?.length) return
    const targetId = activeSession || sessions[0]?.id
    if (!targetId) return
    if (loadedSessionId === targetId) return
    if (isTyping) return
    // Only auto-hydrate once on first load, or when user selects a different session via loadSession.
    if (!hydratedRef.current || (activeSession && loadedSessionId !== activeSession)) {
      hydratedRef.current = true
      void loadSession(targetId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, activeSession])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [localMsgs, isTyping])

  const historyForApi = useMemo((): AIChatMessage[] => {
    return localMsgs
      .filter((m) => !m.streaming)
      .map((m) => ({ role: m.role, content: m.content }))
  }, [localMsgs])

  const handleNewChat = async () => {
    try {
      const session = await ChatService.createSession('New conversation')
      queryClient.setQueryData<ChatSession[]>(['chat-sessions'], (prev) => {
        const rest = (prev || []).filter((s) => s.id !== session.id)
        return [session, ...rest]
      })
      setActiveSession(session.id)
      setLoadedSessionId(session.id)
      setLocalMsgs([])
      setLastUserPrompt('')
      await invalidate()
      toast.success('New chat started')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create chat')
    }
  }

  const persistSession = async (sessionId: string, msgs: LocalMsg[]) => {
    try {
      await httpPatchChat(sessionId, msgs, aiSettings?.provider || providerLabel)
      await invalidate()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save conversation')
    }
  }

  const stopGeneration = () => {
    abortRef.current?.abort()
    abortRef.current = null
    setIsTyping(false)
    setLocalMsgs((prev) => {
      const next = prev.map((m) => (m.streaming ? { ...m, streaming: false } : m))
      const sessionId = activeSession || currentSession?.id
      if (sessionId && next.length) void persistSession(sessionId, next)
      return next
    })
  }

  const handleSend = async (message: string, opts?: { retry?: boolean }) => {
    const text = message.trim()
    if (!text || isTyping) return
    setInput('')
    setIsTyping(true)
    setLastUserPrompt(text)
    setTab('chat')

    let sessionId = activeSession || currentSession?.id
    try {
      if (!sessionId) {
        const session = await ChatService.createSession(text.slice(0, 48))
        sessionId = session.id
        setActiveSession(sessionId)
        setLoadedSessionId(sessionId)
        queryClient.setQueryData<ChatSession[]>(['chat-sessions'], (prev) => {
          const rest = (prev || []).filter((s) => s.id !== session.id)
          return [session, ...rest]
        })
      }
    } catch (e) {
      setIsTyping(false)
      toast.error(e instanceof Error ? e.message : 'Failed to create chat')
      return
    }

    const userMsg: LocalMsg = { id: `u-${Date.now()}`, role: 'user', content: text }
    const pendingId = `a-${Date.now()}`
    const hist = opts?.retry
      ? historyForApi.filter((m, idx, arr) => !(idx === arr.length - 1 && m.role === 'user'))
      : historyForApi

    setLocalMsgs((prev) => {
      let base = prev
      if (opts?.retry) {
        const last = prev[prev.length - 1]
        if (last?.role === 'assistant') base = prev.slice(0, -1)
        const last2 = base[base.length - 1]
        if (last2?.role === 'user' && last2.content === text) base = base.slice(0, -1)
      }
      return [...base, userMsg, { id: pendingId, role: 'assistant', content: '', streaming: true }]
    })

    const ac = new AbortController()
    abortRef.current = ac
    let assembled = ''
    let streamErrorShown = false

    try {
      await AIService.chatStream(
        text,
        hist,
        {
          signal: ac.signal,
          onDelta: (delta) => {
            assembled += delta
            setLocalMsgs((prev) =>
              prev.map((m) => (m.id === pendingId ? { ...m, content: assembled } : m)),
            )
          },
          onDone: (meta) => {
            if (meta.model) setProviderLabel((p) => aiSettings?.provider || p)
          },
          onError: (msg) => {
            streamErrorShown = true
            toast.error(msg)
          },
        },
      )
      const next = await new Promise<LocalMsg[]>((resolve) => {
        setLocalMsgs((prev) => {
          const updated = prev.map((m) =>
            m.id === pendingId ? { ...m, content: assembled || m.content, streaming: false } : m,
          )
          resolve(updated)
          return updated
        })
      })
      await persistSession(sessionId!, next)
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') {
        setLocalMsgs((prev) => {
          const next = prev.map((m) => (m.id === pendingId ? { ...m, streaming: false } : m))
          void persistSession(sessionId!, next)
          return next
        })
      } else {
        const err = e instanceof Error ? e.message : 'AI request failed'
        setLocalMsgs((prev) => {
          const next = prev.map((m) =>
            m.id === pendingId
              ? { ...m, content: assembled || `**Error:** ${err}`, streaming: false }
              : m,
          )
          void persistSession(sessionId!, next)
          return next
        })
        if (!assembled && !streamErrorShown) toast.error(err)
      }
    } finally {
      abortRef.current = null
      setIsTyping(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await ChatService.deleteSession(id)
      queryClient.setQueryData<ChatSession[]>(['chat-sessions'], (prev) =>
        (prev || []).filter((s) => s.id !== id),
      )
      if (activeSession === id || loadedSessionId === id) {
        setActiveSession(null)
        setLoadedSessionId(null)
        setLocalMsgs([])
        hydratedRef.current = false
      }
      toast.success('Chat deleted')
      await invalidate()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete chat')
    }
  }

  const handleClear = async () => {
    setLocalMsgs([])
    const sessionId = activeSession || currentSession?.id
    if (sessionId) {
      try {
        await httpPatchChat(sessionId, [])
        invalidate()
      } catch {
        /* ignore */
      }
    }
    toast.success('Conversation cleared')
  }

  const handleCopyLast = async () => {
    const last = [...localMsgs].reverse().find((m) => m.role === 'assistant' && m.content)
    if (!last) return
    await navigator.clipboard.writeText(last.content)
    toast.success('Copied assistant reply')
  }

  const loadSession = async (id: string) => {
    setActiveSession(id)
    setTab('chat')
    try {
      const s = await ChatService.getSession(id)
      const msgs = (s.messages || []).map((m, i) => ({
        id: m.id || `m-${i}`,
        role: (m.role === 'assistant' ? 'assistant' : 'user') as 'user' | 'assistant',
        content: m.content,
      }))
      setLocalMsgs(msgs)
      setLoadedSessionId(id)
      const lastUser = [...msgs].reverse().find((m) => m.role === 'user')
      setLastUserPrompt(lastUser?.content || '')
    } catch (e) {
      setLocalMsgs([])
      setLoadedSessionId(id)
      toast.error(e instanceof Error ? e.message : 'Failed to open conversation')
    }
  }

  const commitRename = async (id: string) => {
    const title = renameValue.trim()
    setRenamingId(null)
    if (!title) return
    try {
      const updated = await ChatService.renameSession(id, title)
      queryClient.setQueryData<ChatSession[]>(['chat-sessions'], (prev) =>
        (prev || []).map((s) => (s.id === id ? { ...s, ...updated, title } : s)),
      )
      toast.success('Chat renamed')
      await invalidate()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Rename failed')
    }
  }

  return (
    <div className="flex flex-col gap-3 h-[calc(100svh-8rem)] min-h-[420px]">
      <div className="flex items-center gap-2">
        <div className="inline-flex rounded-xl border border-gray-200 dark:border-gray-700 p-1 bg-white dark:bg-gray-900">
          <button
            type="button"
            onClick={() => setTab('chat')}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm',
              tab === 'chat' ? 'bg-primary-600 text-white' : 'text-gray-600 dark:text-gray-300',
            )}
          >
            <MessageSquare className="h-4 w-4" /> Chat
          </button>
          <button
            type="button"
            onClick={() => setTab('settings')}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm',
              tab === 'settings' ? 'bg-primary-600 text-white' : 'text-gray-600 dark:text-gray-300',
            )}
          >
            <Settings2 className="h-4 w-4" /> Settings
          </button>
        </div>
        <span className="text-xs text-gray-400 ml-auto">
          Provider: <strong className="text-gray-600 dark:text-gray-200">{aiSettings?.provider || providerLabel}</strong>
          {aiSettings?.model ? ` · ${aiSettings.model}` : ''}
        </span>
      </div>

      {tab === 'settings' ? (
        <div className="flex-1 overflow-y-auto">
          <AISettingsPanel />
        </div>
      ) : (
        <div className="flex flex-1 gap-3 sm:gap-4 flex-col md:flex-row min-h-0">
          <Card className="w-full md:w-72 shrink-0 flex flex-col dark:bg-gray-900 max-h-48 md:max-h-none" padding={false}>
            <div className="p-4 border-b border-gray-100 dark:border-gray-800">
              <Button className="w-full" onClick={() => void handleNewChat()}>
                <Plus className="h-4 w-4" /> New Chat
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {sessions?.map((session: ChatSession) => (
                <div key={session.id} className="group flex items-center gap-1">
                  {renamingId === session.id ? (
                    <input
                      className="flex-1 text-sm px-2 py-1.5 rounded-lg border border-primary-300 bg-white dark:bg-gray-800 dark:text-white"
                      value={renameValue}
                      autoFocus
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={() => void commitRename(session.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void commitRename(session.id)
                        if (e.key === 'Escape') setRenamingId(null)
                      }}
                    />
                  ) : (
                    <button
                      onClick={() => void loadSession(session.id)}
                      className={cn(
                        'flex-1 text-left px-3 py-2.5 rounded-xl text-sm transition-colors truncate',
                        (activeSession || currentSession?.id) === session.id
                          ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800',
                      )}
                    >
                      {session.title}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setRenamingId(session.id)
                      setRenameValue(session.title)
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                    title="Rename"
                    aria-label="Rename conversation"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(session.id)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
                    title="Delete"
                    aria-label="Delete conversation"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </Card>

          <div className="flex-1 flex flex-col min-h-0">
            <Card className="flex-1 flex flex-col dark:bg-gray-900 min-h-0" padding={false}>
              <div className="flex items-center justify-end gap-1 px-3 pt-3">
                <Button variant="ghost" size="sm" onClick={() => void handleCopyLast()} disabled={!localMsgs.some((m) => m.role === 'assistant')} title="Copy last reply">
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => lastUserPrompt && void handleSend(lastUserPrompt, { retry: true })}
                  disabled={!lastUserPrompt || isTyping}
                  title="Regenerate"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => void handleClear()} disabled={!localMsgs.length || isTyping} title="Clear chat">
                  <Eraser className="h-4 w-4" />
                </Button>
                {isTyping && (
                  <Button variant="outline" size="sm" onClick={stopGeneration} title="Stop generation">
                    <Square className="h-3.5 w-3.5" /> Stop
                  </Button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {localMsgs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center mb-4">
                      <Sparkles className="h-8 w-8 text-white" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">SmartCA AI Assistant</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 max-w-md">
                      Expert CA, GST, ROC, and tax guidance grounded in your practice data. Configure Gemini, OpenAI, or Ollama in Settings — keys never leave the server.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-6 max-w-lg">
                      {SUGGESTIONS.map((s) => (
                        <button
                          key={s}
                          onClick={() => void handleSend(s)}
                          className="text-left px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-primary-200 transition-colors"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <AnimatePresence>
                    {localMsgs.map((msg) => (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn('flex gap-3', msg.role === 'user' ? 'justify-end' : '')}
                      >
                        {msg.role === 'assistant' && (
                          <div className="h-8 w-8 rounded-lg bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center shrink-0">
                            <Bot className="h-4 w-4 text-primary-600" />
                          </div>
                        )}
                        <div
                          className={cn(
                            'max-w-[80%] px-4 py-3 rounded-2xl text-sm',
                            msg.role === 'user'
                              ? 'bg-primary-600 text-white rounded-br-md whitespace-pre-wrap'
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-bl-md',
                          )}
                        >
                          {msg.role === 'assistant' ? (
                            <SimpleMarkdown text={msg.content || (msg.streaming ? '…' : '')} />
                          ) : (
                            msg.content
                          )}
                        </div>
                        {msg.role === 'user' && (
                          <div className="h-8 w-8 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center shrink-0">
                            <User className="h-4 w-4 text-gray-600 dark:text-gray-200" />
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                )}
                {isTyping && localMsgs[localMsgs.length - 1]?.content === '' && (
                  <div className="flex gap-3">
                    <div className="h-8 w-8 rounded-lg bg-primary-100 flex items-center justify-center">
                      <Bot className="h-4 w-4 text-primary-600" />
                    </div>
                    <div className="bg-gray-100 dark:bg-gray-800 px-4 py-3 rounded-2xl rounded-bl-md">
                      <div className="flex gap-1">
                        <span className="h-2 w-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="h-2 w-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="h-2 w-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              <div className="p-4 border-t border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 px-4 py-2">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        void handleSend(input)
                      }
                    }}
                    rows={1}
                    placeholder="Ask about GST, ITR, invoices, compliance…"
                    aria-label="AI message"
                    className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-gray-400 dark:text-gray-100 resize-none max-h-32 py-1"
                  />
                  {isTyping ? (
                    <Button size="sm" variant="outline" onClick={stopGeneration} aria-label="Stop">
                      <Square className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => void handleSend(input)} disabled={!input.trim()} aria-label="Send">
                      <Send className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <p className="text-[11px] text-gray-400 mt-2 px-1">
                  Streaming via Go API · business context attached automatically · keys never leave the server
                </p>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}

async function httpPatchChat(sessionId: string, msgs: LocalMsg[], provider?: string) {
  const { http } = await import('@/services/httpClient')
  const title =
    msgs.find((m) => m.role === 'user')?.content.slice(0, 48) ||
    (msgs.length === 0 ? undefined : 'Conversation')
  await http.patch(`/chat/${sessionId}`, {
    messages: msgs.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      timestamp: new Date().toISOString(),
    })),
    ...(title ? { title } : {}),
    ...(provider ? { provider } : {}),
    updatedAt: new Date().toISOString(),
  })
}
