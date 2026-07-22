import { useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Send, Plus, Bot, Sparkles, Trash2, Copy, RotateCcw, Eraser, User,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { AIService, ChatService, type AIChatMessage } from '@/services'
import { Button, Card } from '@/components/common'
import { cn } from '@/utils'
import type { ChatSession } from '@/types'

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

function SimpleMarkdown({ text }: { text: string }) {
  const blocks = useMemo(() => parseMarkdown(text), [text])
  return (
    <div className="space-y-2 text-sm leading-relaxed prose-ai">
      {blocks.map((b, i) => {
        if (b.type === 'code') {
          return (
            <div key={i} className="relative group">
              <pre className="overflow-x-auto rounded-xl bg-gray-900 text-gray-100 p-3 text-xs">
                <code>{b.content}</code>
              </pre>
              <button
                type="button"
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-xs bg-white/10 hover:bg-white/20 text-white px-2 py-1 rounded"
                onClick={() => {
                  void navigator.clipboard.writeText(b.content)
                  toast.success('Copied')
                }}
              >
                Copy
              </button>
            </div>
          )
        }
        if (b.type === 'ul') {
          return (
            <ul key={i} className="list-disc pl-5 space-y-1">
              {b.items!.map((it, j) => (
                <li key={j} dangerouslySetInnerHTML={{ __html: inlineMd(it) }} />
              ))}
            </ul>
          )
        }
        if (b.type === 'h') {
          return <h3 key={i} className="font-semibold text-base mt-2" dangerouslySetInnerHTML={{ __html: inlineMd(b.content) }} />
        }
        return <p key={i} dangerouslySetInnerHTML={{ __html: inlineMd(b.content) }} />
      })}
    </div>
  )
}

function inlineMd(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 text-xs">$1</code>')
}

function parseMarkdown(text: string): { type: 'p' | 'h' | 'ul' | 'code'; content: string; items?: string[] }[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const out: { type: 'p' | 'h' | 'ul' | 'code'; content: string; items?: string[] }[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (line.startsWith('```')) {
      const buf: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) {
        buf.push(lines[i])
        i++
      }
      out.push({ type: 'code', content: buf.join('\n') })
      i++
      continue
    }
    if (/^#{1,3}\s+/.test(line)) {
      out.push({ type: 'h', content: line.replace(/^#{1,3}\s+/, '') })
      i++
      continue
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ''))
        i++
      }
      out.push({ type: 'ul', content: '', items })
      continue
    }
    if (line.trim() === '') {
      i++
      continue
    }
    const buf = [line]
    i++
    while (i < lines.length && lines[i].trim() !== '' && !lines[i].startsWith('```') && !/^#{1,3}\s+/.test(lines[i]) && !/^\s*[-*]\s+/.test(lines[i])) {
      buf.push(lines[i])
      i++
    }
    out.push({ type: 'p', content: buf.join(' ') })
  }
  return out
}

async function typewrite(full: string, onTick: (partial: string) => void) {
  const step = Math.max(2, Math.floor(full.length / 80))
  for (let i = 0; i < full.length; i += step) {
    onTick(full.slice(0, Math.min(full.length, i + step)))
    await new Promise((r) => setTimeout(r, 12))
  }
  onTick(full)
}

export default function AIPage() {
  const [activeSession, setActiveSession] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [localMsgs, setLocalMsgs] = useState<LocalMsg[]>([])
  const [lastUserPrompt, setLastUserPrompt] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()

  const { data: sessions } = useQuery({
    queryKey: ['chat-sessions'],
    queryFn: () => ChatService.getSessions(),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['chat-sessions'] })
  const currentSession = sessions?.find((s) => s.id === activeSession) || sessions?.[0]

  const historyForApi = useMemo((): AIChatMessage[] => {
    return localMsgs
      .filter((m) => !m.streaming)
      .map((m) => ({ role: m.role, content: m.content }))
  }, [localMsgs])

  const handleNewChat = async () => {
    try {
      const session = await ChatService.createSession('New conversation')
      setActiveSession(session.id)
      setLocalMsgs([])
      invalidate()
      toast.success('New chat started')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create chat')
    }
  }

  const persistSession = async (sessionId: string, msgs: LocalMsg[]) => {
    await httpPatchChat(sessionId, msgs)
  }

  const handleSend = async (message: string, opts?: { retry?: boolean }) => {
    const text = message.trim()
    if (!text || isTyping) return
    setInput('')
    setIsTyping(true)
    setLastUserPrompt(text)

    let sessionId = activeSession || currentSession?.id
    if (!sessionId) {
      const session = await ChatService.createSession(text.slice(0, 48))
      sessionId = session.id
      setActiveSession(sessionId)
    }

    const userMsg: LocalMsg = { id: `u-${Date.now()}`, role: 'user', content: text }
    const pendingId = `a-${Date.now()}`
    const hist = opts?.retry
      ? historyForApi
      : [...historyForApi, { role: 'user' as const, content: text }]

    setLocalMsgs((prev) => {
      const base = opts?.retry ? prev.filter((m) => m.role !== 'assistant' || m.id !== prev[prev.length - 1]?.id) : prev
      return [...base, userMsg, { id: pendingId, role: 'assistant', content: '', streaming: true }]
    })

    try {
      const result = await AIService.chat(text, hist.slice(0, -1))
      const reply = result.markdown || result.reply || ''
      await typewrite(reply, (partial) => {
        setLocalMsgs((prev) => prev.map((m) => (m.id === pendingId ? { ...m, content: partial } : m)))
      })
      setLocalMsgs((prev) => {
        const next = prev.map((m) => (m.id === pendingId ? { ...m, content: reply, streaming: false } : m))
        void persistSession(sessionId!, next)
        return next
      })
      if (result.model) {
        /* meta available for UI if needed */
      }
      invalidate()
    } catch (e) {
      const err = e instanceof Error ? e.message : 'AI request failed'
      setLocalMsgs((prev) => prev.map((m) => (m.id === pendingId ? { ...m, content: `**Error:** ${err}`, streaming: false } : m)))
      toast.error(err)
    } finally {
      setIsTyping(false)
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    }
  }

  const handleDelete = async (id: string) => {
    await ChatService.deleteSession(id)
    if (activeSession === id) {
      setActiveSession(null)
      setLocalMsgs([])
    }
    toast.success('Chat deleted')
    invalidate()
  }

  const handleClear = () => {
    setLocalMsgs([])
    toast.success('Conversation cleared')
  }

  const handleCopyLast = async () => {
    const last = [...localMsgs].reverse().find((m) => m.role === 'assistant' && m.content)
    if (!last) return
    await navigator.clipboard.writeText(last.content)
    toast.success('Copied assistant reply')
  }

  // hydrate from session when switching
  const loadSession = async (id: string) => {
    setActiveSession(id)
    try {
      const s = await ChatService.getSession(id)
      const msgs = (s.messages || []).map((m, i) => ({
        id: m.id || `m-${i}`,
        role: (m.role === 'assistant' ? 'assistant' : 'user') as 'user' | 'assistant',
        content: m.content,
      }))
      setLocalMsgs(msgs)
    } catch {
      setLocalMsgs([])
    }
  }

  return (
    <div className="flex h-[calc(100svh-8rem)] min-h-[420px] gap-3 sm:gap-4 flex-col md:flex-row">
      <Card className="w-full md:w-72 shrink-0 flex flex-col dark:bg-gray-900 max-h-48 md:max-h-none" padding={false}>
        <div className="p-4 border-b border-gray-100 dark:border-gray-800">
          <Button className="w-full" onClick={handleNewChat}>
            <Plus className="h-4 w-4" /> New Chat
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sessions?.map((session: ChatSession) => (
            <div key={session.id} className="group flex items-center gap-1">
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
              <button
                type="button"
                onClick={() => handleDelete(session.id)}
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

      <div className="flex-1 flex flex-col">
        <Card className="flex-1 flex flex-col dark:bg-gray-900" padding={false}>
          <div className="flex items-center justify-end gap-1 px-3 pt-3">
            <Button variant="ghost" size="sm" onClick={handleCopyLast} disabled={!localMsgs.some((m) => m.role === 'assistant')} title="Copy last reply">
              <Copy className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => lastUserPrompt && handleSend(lastUserPrompt, { retry: true })} disabled={!lastUserPrompt || isTyping} title="Retry">
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={handleClear} disabled={!localMsgs.length} title="Clear chat">
              <Eraser className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {localMsgs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center mb-4">
                  <Sparkles className="h-8 w-8 text-white" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Smart CA AI Assistant</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 max-w-md">
                  Powered by Google Gemini via the Smart CA Go API. Your API key never leaves the server.
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
                      {msg.role === 'assistant' ? <SimpleMarkdown text={msg.content || (msg.streaming ? '…' : '')} /> : msg.content}
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
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && void handleSend(input)}
                placeholder="Ask about GST, ITR, invoices, compliance…"
                aria-label="AI message"
                className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-gray-400 dark:text-gray-100"
              />
              <Button size="sm" onClick={() => void handleSend(input)} disabled={!input.trim() || isTyping} aria-label="Send">
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-[11px] text-gray-400 mt-2 px-1">Responses via Go → Gemini. Keys are never sent to the browser.</p>
          </div>
        </Card>
      </div>
    </div>
  )
}

async function httpPatchChat(sessionId: string, msgs: LocalMsg[]) {
  const { http } = await import('@/services/httpClient')
  await http.patch(`/chat/${sessionId}`, {
    messages: msgs.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      timestamp: new Date().toISOString(),
    })),
    title: msgs.find((m) => m.role === 'user')?.content.slice(0, 48) || 'Conversation',
  })
}
