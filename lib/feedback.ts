/**
 * Pengganti alert() dan confirm() bawaan browser. Bisa dipanggil dari mana saja
 * di kode client; tampilannya dirender oleh FeedbackHost di root layout.
 */

export type ToastTone = 'success' | 'error' | 'info'

export type ToastItem = {
  id: number
  tone: ToastTone
  title: string
  message?: string
}

export type ConfirmOptions = {
  title: string
  message: string
  confirmLabel?: string
  tone?: 'danger' | 'info'
}

export type ConfirmRequest = ConfirmOptions & { resolve: (confirmed: boolean) => void }

export type SuccessOptions = {
  title: string
  message?: string
  details?: Array<{ label: string; value: string }>
  actionLabel?: string
}

export type SuccessRequest = SuccessOptions & { resolve: () => void }

type State = { toasts: ToastItem[]; confirm: ConfirmRequest | null; success: SuccessRequest | null }

export const TOAST_DURATION: Record<ToastTone, number> = { success: 4000, info: 5000, error: 8000 }

let state: State = { toasts: [], confirm: null, success: null }
let nextToastId = 1
const listeners = new Set<() => void>()

function setState(next: Partial<State>) {
  state = { ...state, ...next }
  listeners.forEach(listener => listener())
}

export const feedbackStore = {
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  },
  getSnapshot: () => state,
}

export function dismissToast(id: number) {
  setState({ toasts: state.toasts.filter(toast => toast.id !== id) })
}

function pushToast(tone: ToastTone, title: string, message?: string) {
  const id = nextToastId++
  setState({ toasts: [...state.toasts, { id, tone, title, message }] })
  setTimeout(() => dismissToast(id), TOAST_DURATION[tone])
}

export const notify = {
  success: (title: string, message?: string) => pushToast('success', title, message),
  error: (title: string, message?: string) => pushToast('error', title, message),
  info: (title: string, message?: string) => pushToast('info', title, message),
}

/** Mengembalikan true jika user mengonfirmasi. */
export function confirmAction(options: ConfirmOptions) {
  state.confirm?.resolve(false)
  return new Promise<boolean>(resolve => setState({ confirm: { ...options, resolve } }))
}

export function settleConfirm(confirmed: boolean) {
  state.confirm?.resolve(confirmed)
  setState({ confirm: null })
}

/** Pop-up berhasil; selesai saat user menutupnya, jadi aman untuk reload sesudahnya. */
export function showSuccess(options: SuccessOptions) {
  state.success?.resolve()
  return new Promise<void>(resolve => setState({ success: { ...options, resolve } }))
}

export function settleSuccess() {
  state.success?.resolve()
  setState({ success: null })
}
