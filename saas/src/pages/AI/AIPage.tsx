import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Send, Plus, Bot, Paperclip, Sparkles, Trash2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router'
import toast from 'react-hot-toast'
import { ChatService } from '@/services'
import { Button, Card, Modal } from '@/components/common'
import { cn } from '@/utils'
import type { ChatSession } from '@/types'

const SUGGESTIONS = [
  'What are GST filing deadlines for Q1 FY 2025-26?',
  'How to compute advance tax for a company?',
  'TDS rate on professional fees under Section 194J',
  'ROC annual filing checklist for private limited company',
  'Section 80C deduction limits for FY 2025-26',
  'GST input tax credit reversal rules',
]

export default function AIPage() {
  const [activeSession, setActiveSession] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const navigate = useNavigate()
  const [attachOpen, setAttachOpen] = useState(false)
  const queryClient = useQueryClient()

  const { data: sessions } = useQuery({
    queryKey: ['chat-sessions'],
    queryFn: () => ChatService.getSessions(),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['chat-sessions'] })

  const currentSession = sessions?.find((s) => s.id === activeSession) || sessions?.[0]
  const messages = currentSession?.messages || []

  const handleNewChat = async () => {
    try {
      const session = await ChatService.createSession('New conversation')
      setActiveSession(session.id)
      invalidate()
      toast.success('New chat started')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create chat')
    }
  }

  const handleSend = async (message: string) => {
    if (!message.trim()) return
    setInput('')
    setIsTyping(true)
    try {
      let sessionId = activeSession || currentSession?.id
      if (!sessionId) {
        const session = await ChatService.createSession(message.slice(0, 48))
        sessionId = session.id
        setActiveSession(sessionId)
      }
      await ChatService.sendMessage(sessionId, message)
      // Update title if still "New conversation"
      const session = await ChatService.getSession(sessionId)
      if (session.title === 'New conversation') {
        // title update via recreate isn't available; leave as is
      }
      invalidate()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to send')
    } finally {
      setIsTyping(false)
    }
  }

  const handleDelete = async (id: string) => {
    await ChatService.deleteSession(id)
    if (activeSession === id) setActiveSession(null)
    toast.success('Chat deleted')
    invalidate()
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
                onClick={() => setActiveSession(session.id)}
                className={cn(
                  'flex-1 text-left px-3 py-2.5 rounded-xl text-sm transition-colors truncate',
                  (activeSession || currentSession?.id) === session.id
                    ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
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
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center mb-4">
                  <Sparkles className="h-8 w-8 text-white" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Smart CA AI Assistant</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 max-w-md">
                  Ask about GST, ITR, TDS, ROC compliance, tax planning, and more.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-6 max-w-lg">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => handleSend(s)}
                      className="text-left px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-primary-200 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <AnimatePresence>
                {messages.map((msg, i) => (
                  <motion.div
                    key={msg.id || i}
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
                        'max-w-[70%] px-4 py-3 rounded-2xl text-sm whitespace-pre-wrap',
                        msg.role === 'user'
                          ? 'bg-primary-600 text-white rounded-br-md'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-bl-md'
                      )}
                    >
                      {msg.content}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
            {isTyping && (
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
          </div>

          <div className="p-4 border-t border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 px-4 py-2">
              <button
                type="button"
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                onClick={() => setAttachOpen(true)}
                title="Attach"
                aria-label="Attach document"
              >
                <Paperclip className="h-5 w-5" />
              </button>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend(input)}
                placeholder="Ask anything about tax, compliance, accounting..."
                aria-label="AI message"
                className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-gray-400 dark:text-gray-100"
              />
              <Button size="sm" onClick={() => handleSend(input)} disabled={!input.trim() || isTyping} aria-label="Send">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <Modal open={attachOpen} onClose={() => setAttachOpen(false)} title="Attach document">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Document attachments for AI are simulated in this demo. Open the Documents module to upload or download client files, then reference them in your question.
        </p>
        <div className="mt-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button variant="outline" onClick={() => setAttachOpen(false)}>Close</Button>
          <Button onClick={() => { setAttachOpen(false); navigate('/documents') }}>
            Go to Documents
          </Button>
        </div>
      </Modal>
    </div>
  )
}
