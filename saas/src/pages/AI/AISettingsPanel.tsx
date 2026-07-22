import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, XCircle, Loader2, Eye, EyeOff, Shield } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  AIService,
  type AIProviderName,
  type AIPublicSettings,
} from '@/services/aiService'
import { Button, Card, CardTitle, Input } from '@/components/common'
import { cn } from '@/utils'

const PROVIDERS: { id: AIProviderName; label: string; hint: string }[] = [
  { id: 'gemini', label: 'Google Gemini', hint: 'Cloud — requires API key' },
  { id: 'openai', label: 'OpenAI', hint: 'Cloud — requires API key' },
  { id: 'ollama', label: 'Ollama', hint: 'Local LLM — base URL + model' },
  { id: 'mock', label: 'Mock (offline)', hint: 'Works without credentials' },
]

export default function AISettingsPanel() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['ai-settings'],
    queryFn: () => AIService.getSettings(),
  })

  const [provider, setProvider] = useState<AIProviderName>('mock')
  const [model, setModel] = useState('mock')
  const [baseUrl, setBaseUrl] = useState('http://host.docker.internal:11434')
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [testStatus, setTestStatus] = useState<'idle' | 'ok' | 'fail'>('idle')
  const [testMessage, setTestMessage] = useState('')

  useEffect(() => {
    if (!data || dirty) return
    setProvider(data.provider || 'mock')
    setModel(data.model || '')
    setBaseUrl(data.baseUrl || 'http://host.docker.internal:11434')
    setApiKey(data.apiKeyMasked || '')
    setTestStatus('idle')
  }, [data, dirty])

  const modelOptions = useMemo(() => {
    const m = data?.suggestedModels
    if (!m) return []
    return m[provider] || []
  }, [data, provider])

  const keyForRequest = () => {
    const v = apiKey.trim()
    if (!v || v.includes('•') || v.includes('*')) return ''
    return v
  }

  const saveMut = useMutation({
    mutationFn: () =>
      AIService.saveSettings({
        provider,
        model,
        baseUrl: provider === 'ollama' ? baseUrl : '',
        apiKey: keyForRequest(),
      }),
    onSuccess: (res) => {
      qc.setQueryData(['ai-settings'], res)
      setProvider(res.provider)
      setModel(res.model)
      setBaseUrl(res.baseUrl || 'http://host.docker.internal:11434')
      setApiKey(res.apiKeyMasked || '')
      setDirty(false)
      toast.success(`AI settings saved — provider: ${res.provider}`)
      setTestStatus('idle')
    },
    onError: (e: Error) => toast.error(e.message || 'Save failed'),
  })

  const removeMut = useMutation({
    mutationFn: () => AIService.removeSettings(),
    onSuccess: (res) => {
      qc.setQueryData(['ai-settings'], res)
      setProvider('mock')
      setModel('mock')
      setApiKey('')
      setBaseUrl('http://host.docker.internal:11434')
      setDirty(false)
      toast.success('AI credentials removed — using mock')
    },
    onError: (e: Error) => toast.error(e.message || 'Remove failed'),
  })

  const testMut = useMutation({
    mutationFn: () =>
      AIService.testSettings({
        provider,
        model,
        baseUrl: provider === 'ollama' ? baseUrl : undefined,
        apiKey: keyForRequest(),
      }),
    onSuccess: (res) => {
      setTestStatus(res.ok ? 'ok' : 'fail')
      setTestMessage(res.message)
      if (res.ok) toast.success(res.message || 'Connected')
      else toast.error(res.message || 'Connection failed')
    },
    onError: (e: Error) => {
      setTestStatus('fail')
      setTestMessage(e.message)
      toast.error(e.message || 'Connection failed')
    },
  })

  if (isLoading && !data) {
    return (
      <Card className="p-8 flex items-center justify-center gap-2 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading AI settings…
      </Card>
    )
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <Card className="dark:bg-gray-900">
        <CardTitle>AI Provider</CardTitle>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Choose how SmartCA AI generates answers. API keys stay on the server and are never sent to the browser in full.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setProvider(p.id)
                const opts = data?.suggestedModels?.[p.id]
                if (opts?.[0]) setModel(opts[0])
                else if (p.id === 'mock') setModel('mock')
                // Do not reuse another provider's masked key.
                if (p.id !== data?.provider) setApiKey('')
                else setApiKey(data?.apiKeyMasked || '')
                setDirty(true)
                setTestStatus('idle')
              }}
              className={cn(
                'text-left rounded-xl border px-4 py-3 transition-colors',
                provider === p.id
                  ? 'border-primary-500 bg-primary-50/80 dark:bg-primary-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800',
              )}
            >
              <div className="font-medium text-sm text-gray-900 dark:text-white">{p.label}</div>
              <div className="text-xs text-gray-500 mt-0.5">{p.hint}</div>
            </button>
          ))}
        </div>
      </Card>

      <Card className="dark:bg-gray-900">
        <CardTitle>Provider configuration</CardTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
          {(provider === 'gemini' || provider === 'openai') && (
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                API Key
              </label>
              <div className="relative">
                <Input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => {
                    setApiKey(e.target.value)
                    setDirty(true)
                    setTestStatus('idle')
                  }}
                  placeholder={
                    provider === data?.provider && data?.hasApiKey
                      ? '•••• saved (enter new to replace)'
                      : 'Paste API key'
                  }
                  autoComplete="off"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  onClick={() => setShowKey((v) => !v)}
                  aria-label={showKey ? 'Hide API key' : 'Show API key'}
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                <Shield className="h-3 w-3" /> Stored encrypted server-side. UI shows a masked value only.
              </p>
            </div>
          )}

          {provider === 'ollama' && (
            <div className="sm:col-span-2">
              <Input
                label="Base URL"
                value={baseUrl}
                onChange={(e) => {
                  setBaseUrl(e.target.value)
                  setDirty(true)
                  setTestStatus('idle')
                }}
                placeholder="http://host.docker.internal:11434"
              />
              <p className="text-xs text-gray-400 mt-1">
                From Docker, use host.docker.internal to reach Ollama on your machine.
              </p>
            </div>
          )}

          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Model
            </label>
            <Input
              list="ai-model-suggestions"
              value={model}
              onChange={(e) => {
                setModel(e.target.value)
                setDirty(true)
                setTestStatus('idle')
              }}
              placeholder="Select or type a model id"
            />
            <datalist id="ai-model-suggestions">
              {modelOptions.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
            {provider === 'gemini' && (
              <p className="text-xs text-gray-400 mt-1">
                Models are discovered from the Gemini API when a key is available (Flash / Pro latest preferred).
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm min-h-[1.25rem]">
            {testStatus === 'ok' && (
              <span className="inline-flex items-center gap-1.5 text-emerald-600">
                <CheckCircle2 className="h-4 w-4" /> Connected{testMessage ? ` — ${testMessage}` : ''}
              </span>
            )}
            {testStatus === 'fail' && (
              <span className="inline-flex items-center gap-1.5 text-red-600">
                <XCircle className="h-4 w-4" /> Connection Failed{testMessage ? ` — ${testMessage}` : ''}
              </span>
            )}
            {data?.updatedAt && testStatus === 'idle' && (
              <span className="text-xs text-gray-400">Last updated {new Date(data.updatedAt).toLocaleString()}</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            <Button
              variant="outline"
              loading={testMut.isPending}
              onClick={() => testMut.mutate()}
            >
              Test Connection
            </Button>
            <Button
              variant="outline"
              loading={removeMut.isPending}
              onClick={() => {
                if (confirm('Remove saved AI credentials and switch to mock?')) removeMut.mutate()
              }}
            >
              Remove
            </Button>
            <Button loading={saveMut.isPending} onClick={() => saveMut.mutate()}>
              Save
            </Button>
          </div>
        </div>
      </Card>

      <ActiveBanner settings={data} provider={provider} />
    </div>
  )
}

function ActiveBanner({
  settings,
  provider,
}: {
  settings?: AIPublicSettings
  provider: AIProviderName
}) {
  const active = settings?.provider || provider
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
      Active provider after save: <strong className="text-gray-900 dark:text-white">{active}</strong>
      {settings?.model ? <> · model <code className="text-xs">{settings.model}</code></> : null}
      . Switching takes effect immediately — no Docker rebuild.
    </div>
  )
}
