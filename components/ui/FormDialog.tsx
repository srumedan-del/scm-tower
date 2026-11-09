'use client'

import { createContext, useContext, useEffect, useId, useRef, type FormEvent, type ReactNode } from 'react'
import { X, type LucideIcon } from 'lucide-react'
import { confirmAction } from '@/lib/feedback'

export const formControlClass =
  'h-11 w-full rounded-xl border border-gray-300 bg-white px-3.5 text-sm text-slate-900 transition-colors placeholder:text-slate-400 hover:border-gray-400 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-300/50 aria-[invalid=true]:border-red-500 aria-[invalid=true]:focus:ring-red-200'

export const dialogBodyClass = 'min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5'
export const dialogFooterClass = 'flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-gray-200 bg-gray-50 px-6 py-4'
export const dialogCancelClass = 'min-h-11 rounded-xl border border-gray-300 bg-white px-5 text-sm font-medium text-slate-700 transition-colors hover:bg-gray-100 disabled:opacity-50'
export const dialogPrimaryClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-60'
export const dialogDangerClass = 'inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50'

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])'

const SIZE_CLASS = {
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
  '5xl': 'max-w-5xl',
  '6xl': 'max-w-6xl',
}

type DialogContextValue = { titleId: string; requestClose: () => void }
const DialogContext = createContext<DialogContextValue>({ titleId: '', requestClose: () => {} })

export function DialogShell({
  onClose, size = '2xl', guardDirty = true, children,
}: {
  onClose: () => void
  size?: keyof typeof SIZE_CLASS
  /** Tanya dulu sebelum Esc atau tombol X membuang isian yang sudah diubah. */
  guardDirty?: boolean
  children: ReactNode
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const dirtyRef = useRef(false)
  const requestCloseRef = useRef<() => void>(() => {})
  const titleId = useId()

  async function requestClose() {
    if (guardDirty && dirtyRef.current && !(await confirmAction({
      title: 'Buang perubahan?',
      message: 'Data yang sudah diisi belum tersimpan.',
      confirmLabel: 'Ya, Buang',
    }))) return
    onClose()
  }

  useEffect(() => { requestCloseRef.current = requestClose })

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    const dialog = dialogRef.current
    const autofocus = dialog?.querySelector<HTMLElement>('[data-autofocus]')
    ;(autofocus ?? dialog)?.focus({ preventScroll: true })

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        requestCloseRef.current()
        return
      }
      if (event.key !== 'Tab' || !dialog) return
      const focusable = dialog.querySelectorAll<HTMLElement>(FOCUSABLE)
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      previouslyFocused?.focus?.()
    }
  }, [])

  const markDirty = () => { dirtyRef.current = true }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onInput={markDirty}
        onChange={markDirty}
        className={`flex max-h-[calc(100dvh-2rem)] w-full ${SIZE_CLASS[size]} flex-col overflow-hidden rounded-2xl bg-white font-sans text-sm outline-none`}
      >
        <DialogContext.Provider value={{ titleId, requestClose: () => requestCloseRef.current() }}>
          {children}
        </DialogContext.Provider>
      </div>
    </div>
  )
}

export function DialogHeader({
  title, subtitle, icon: Icon, actions,
}: {
  title: ReactNode
  subtitle?: ReactNode
  icon: LucideIcon
  actions?: ReactNode
}) {
  const { titleId, requestClose } = useContext(DialogContext)
  return (
    <header className="flex shrink-0 items-start gap-4 border-b border-gray-200 px-6 py-5">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gold-100 text-gold-700">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 id={titleId} className="lux-display text-xl font-semibold text-indigo-900 [overflow-wrap:anywhere]">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500 [overflow-wrap:anywhere]">{subtitle}</p>}
      </div>
      {actions}
      <button
        type="button"
        onClick={requestClose}
        aria-label="Tutup"
        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-slate-500 transition-colors hover:bg-gray-100 hover:text-slate-800"
      >
        <X className="h-5 w-5" aria-hidden="true" />
      </button>
    </header>
  )
}

export function FormDialog({
  title, subtitle, icon, onClose, onSubmit, footer, children,
}: {
  title: string
  subtitle?: string
  icon: LucideIcon
  onClose: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  footer: ReactNode
  children: ReactNode
}) {
  return (
    <DialogShell onClose={onClose} guardDirty={false}>
      <DialogHeader title={title} subtitle={subtitle} icon={icon} />
      <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">{children}</div>
        <footer className={dialogFooterClass}>{footer}</footer>
      </form>
    </DialogShell>
  )
}

export function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-gold-700">{title}</h3>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

export function FormField({
  label, required, hint, error, children,
}: {
  label: string
  required?: boolean
  hint?: string
  error?: string
  children: ReactNode
}) {
  const markedRequired = label.trimEnd().endsWith('*')
  const text = markedRequired ? label.trimEnd().slice(0, -1).trimEnd() : label
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-slate-700">
        {text}{(required || markedRequired) && <span className="ml-0.5 text-red-600" aria-hidden="true">*</span>}
      </span>
      {children}
      {error
        ? <span className="mt-1.5 block text-xs font-medium text-red-700">{error}</span>
        : hint && <span className="mt-1.5 block text-xs text-slate-500">{hint}</span>}
    </label>
  )
}
