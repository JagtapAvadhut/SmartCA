import { useEffect, useRef, useState } from 'react'
import { useForm, type FieldValues, type DefaultValues, type Path } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { z } from 'zod'
import { Modal } from './Modal'
import { Input } from './Input'
import { Button } from './Button'
import { cn } from '@/utils'

export interface FormField {
  name: string
  label: string
  type?: 'text' | 'email' | 'tel' | 'number' | 'date' | 'select' | 'textarea' | 'password'
  placeholder?: string
  options?: { label: string; value: string }[]
  required?: boolean
  colSpan?: 1 | 2
  /** Hide from UI; still registered for submit (e.g. auto-derived names) */
  hidden?: boolean
  /** When this select changes, copy the option label into another field */
  syncLabelTo?: string
}

interface EntityFormModalProps<T extends FieldValues> {
  open: boolean
  onClose: () => void
  onSubmit: (data: T) => Promise<void> | void
  title: string
  fields: FormField[]
  schema: z.ZodType<T>
  defaultValues?: DefaultValues<T>
  loading?: boolean
  submitLabel?: string
  /** LocalStorage draft key — enables auto-save + restore */
  draftKey?: string
}

export function EntityFormModal<T extends FieldValues>({
  open,
  onClose,
  onSubmit,
  title,
  fields,
  schema,
  defaultValues,
  loading,
  submitLabel = 'Save',
  draftKey,
}: EntityFormModalProps<T>) {
  const [draftHint, setDraftHint] = useState('')
  const undoSnapshot = useRef<DefaultValues<T> | null>(null)
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<T>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema as any),
    defaultValues,
  })

  useEffect(() => {
    if (!open) return
    let values = defaultValues
    if (draftKey) {
      try {
        const raw = localStorage.getItem(`smart-ca-draft:${draftKey}`)
        if (raw) {
          values = { ...defaultValues, ...JSON.parse(raw) } as DefaultValues<T>
          setDraftHint('Draft restored')
        } else {
          setDraftHint('')
        }
      } catch {
        setDraftHint('')
      }
    }
    undoSnapshot.current = values || null
    reset(values)
    // Only reset when the modal opens (or draft key changes) — not when parent
    // recreates defaultValues on every render (that wiped in-progress input).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [open, draftKey, reset])

  useEffect(() => {
    if (!open || !draftKey) return
    const sub = watch((data) => {
      try {
        localStorage.setItem(`smart-ca-draft:${draftKey}`, JSON.stringify(data))
        setDraftHint('Draft saved')
      } catch {
        /* ignore */
      }
    })
    return () => sub.unsubscribe()
  }, [open, draftKey, watch])

  // Sync select option labels into companion fields (clientId → clientName, etc.)
  useEffect(() => {
    if (!open) return
    const syncers = fields.filter((f) => f.type === 'select' && f.syncLabelTo)
    if (!syncers.length) return
    const sub = watch((values) => {
      for (const field of syncers) {
        const selected = String((values as Record<string, unknown>)[field.name] ?? '')
        const label = field.options?.find((o) => o.value === selected)?.label ?? ''
        const target = field.syncLabelTo as Path<T>
        const current = (values as Record<string, unknown>)[field.syncLabelTo!]
        if (label && current !== label) {
          setValue(target, label as never, { shouldValidate: true, shouldDirty: true })
        }
      }
    })
    return () => sub.unsubscribe()
  }, [open, fields, watch, setValue])

  const clearDraft = () => {
    if (draftKey) localStorage.removeItem(`smart-ca-draft:${draftKey}`)
    setDraftHint('')
  }

  const submit = handleSubmit(async (data) => {
    await onSubmit(data)
    clearDraft()
  })

  const busy = loading || isSubmitting

  return (
    <Modal open={open} onClose={onClose} title={title} size="lg">
      <form onSubmit={submit} className="space-y-4" noValidate>
        {(draftHint || draftKey) && (
          <div className="flex items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span>{draftHint || 'Auto-save draft enabled'}</span>
            <div className="flex gap-2">
              <button
                type="button"
                className="text-primary-600 dark:text-primary-400 hover:underline"
                onClick={() => undoSnapshot.current && reset(undoSnapshot.current)}
              >
                Undo
              </button>
              <button
                type="button"
                className="hover:underline"
                onClick={() => {
                  clearDraft()
                  reset(defaultValues)
                }}
              >
                Reset
              </button>
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {fields.map((field) => {
            const error = (errors[field.name as Path<T>] as { message?: string } | undefined)?.message
            const span = field.colSpan === 2 ? 'sm:col-span-2' : ''
            const errorId = `field-${field.name}-error`
            const labelText = (
              <>
                {field.label}
                {field.required ? <span className="text-red-500 ml-0.5" aria-hidden>*</span> : null}
              </>
            )

            if (field.hidden) {
              return (
                <input
                  key={field.name}
                  type="hidden"
                  {...register(field.name as Path<T>)}
                />
              )
            }

            if (field.type === 'select') {
              return (
                <div key={field.name} className={span}>
                  <label htmlFor={`field-${field.name}`} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    {labelText}
                  </label>
                  <select
                    id={`field-${field.name}`}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? errorId : undefined}
                    aria-required={field.required || undefined}
                    {...register(field.name as Path<T>)}
                    className={cn(
                      'w-full h-10 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500',
                      error && 'border-red-300 focus:border-red-500',
                    )}
                  >
                    <option value="">Select...</option>
                    {field.options?.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  {error && <p id={errorId} className="mt-1 text-xs text-red-500" role="alert">{error}</p>}
                </div>
              )
            }

            if (field.type === 'textarea') {
              return (
                <div key={field.name} className={span || 'sm:col-span-2'}>
                  <label htmlFor={`field-${field.name}`} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    {labelText}
                  </label>
                  <textarea
                    id={`field-${field.name}`}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? errorId : undefined}
                    aria-required={field.required || undefined}
                    {...register(field.name as Path<T>)}
                    rows={3}
                    placeholder={field.placeholder}
                    className={cn(
                      'w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500',
                      error && 'border-red-300 focus:border-red-500',
                    )}
                  />
                  {error && <p id={errorId} className="mt-1 text-xs text-red-500" role="alert">{error}</p>}
                </div>
              )
            }

            return (
              <div key={field.name} className={span}>
                <Input
                  label={field.label}
                  required={field.required}
                  type={field.type || 'text'}
                  placeholder={field.placeholder}
                  error={error}
                  id={`field-${field.name}`}
                  aria-invalid={error ? true : undefined}
                  {...register(
                    field.name as Path<T>,
                    field.type === 'number'
                      ? {
                          setValueAs: (v) => {
                            if (v === '' || v == null) return undefined
                            const n = Number(v)
                            return Number.isFinite(n) ? n : undefined
                          },
                        }
                      : undefined,
                  )}
                />
              </div>
            )
          })}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" loading={busy}>{submitLabel}</Button>
        </div>
      </form>
    </Modal>
  )
}
