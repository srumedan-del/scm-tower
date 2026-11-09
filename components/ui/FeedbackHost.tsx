'use client'

import { useEffect, useRef, useSyncExternalStore } from 'react'
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import {
  dismissToast, feedbackStore, settleConfirm,
  type ConfirmRequest, type ToastTone,
} from '@/lib/feedback'

const toastStyle: Record<ToastTone, { icon: typeof Info; bar: string; iconColor: string }> = {
  success: { icon: CheckCircle2, bar: 'bg-green', iconColor: 'text-green' },
  error: { icon: AlertCircle, bar: 'bg-red', iconColor: 'text-red' },
  info: { icon: Info, bar: 'bg-gold-500', iconColor: 'text-gold-600' },
}

function ConfirmModal({ request }: { request: ConfirmRequest }) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const danger = (request.tone ?? 'danger') === 'danger'

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    cancelRef.current?.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation()
        settleConfirm(false)
        return
      }
      if (event.key !== 'Tab') return
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('button')
      if (!focusable?.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      previouslyFocused?.focus?.()
    }
  }, [])

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4"
      onClick={() => settleConfirm(false)}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white"
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-start gap-4 p-6">
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${danger ? 'bg-red-100 text-red-700' : 'bg-gold-100 text-gold-700'}`}>
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 id="confirm-title" className="lux-display text-xl font-semibold text-indigo-900">{request.title}</h2>
            <p id="confirm-message" className="mt-1.5 text-sm leading-6 text-slate-600 [overflow-wrap:anywhere]">{request.message}</p>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-200 bg-gray-50 px-6 py-4">
          <button
            ref={cancelRef}
            type="button"
            onClick={() => settleConfirm(false)}
            className="min-h-10 rounded-xl border border-gray-300 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-gray-100"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={() => settleConfirm(true)}
            className={`min-h-10 rounded-xl px-4 text-sm font-semibold text-white transition-colors ${danger ? 'bg-red-700 hover:bg-red-800' : 'bg-indigo-600'}`}
          >
            {request.confirmLabel ?? (danger ? 'Ya, Hapus' : 'Ya, Lanjutkan')}
          </button>
        </div>
      </div>
    </div>
  )
}

export function FeedbackHost() {
  const { toasts, confirm } = useSyncExternalStore(
    feedbackStore.subscribe,
    feedbackStore.getSnapshot,
    feedbackStore.getSnapshot,
  )

  return (
    <>
      {confirm && <ConfirmModal key={confirm.title + confirm.message} request={confirm} />}
      <div className="pointer-events-none fixed right-4 top-4 z-[95] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2">
        {toasts.map(toast => {
          const { icon: Icon, bar, iconColor } = toastStyle[toast.tone]
          return (
            <div
              key={toast.id}
              role={toast.tone === 'error' ? 'alert' : 'status'}
              className="lux-toast pointer-events-auto relative flex items-start gap-3 overflow-hidden rounded-xl border border-gray-200 bg-white py-3 pl-5 pr-2"
            >
              <span className={`absolute inset-y-0 left-0 w-1 ${bar}`} aria-hidden="true" />
              <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${iconColor}`} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">{toast.title}</p>
                {toast.message && <p className="mt-0.5 text-xs leading-5 text-slate-600 [overflow-wrap:anywhere]">{toast.message}</p>}
              </div>
              <button
                type="button"
                aria-label="Tutup notifikasi"
                onClick={() => dismissToast(toast.id)}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-gray-100"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          )
        })}
      </div>
    </>
  )
}
