'use client'

/**
 * Progres upload file bertahap untuk seluruh aplikasi:
 * Membaca file → Validasi → Menyimpan → Selesai. Ditampilkan oleh UploadProgressHost.
 */

export type UploadStage = 'read' | 'validate' | 'save'
export type UploadResultTone = 'success' | 'info' | 'error'

export type UploadState = {
  id: number
  fileName: string
  stage: UploadStage
  result: null | { tone: UploadResultTone; title: string; text: string }
  resolve?: () => void
}

let state: UploadState | null = null
let nextId = 1
const listeners = new Set<() => void>()

function set(next: UploadState | null) {
  state = next
  listeners.forEach(listener => listener())
}

export const uploadStore = {
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  },
  getSnapshot: () => state,
}

export const uploadProgress = {
  start(fileName: string) {
    set({ id: nextId++, fileName, stage: 'read', result: null })
  },
  stage(stage: UploadStage) {
    if (state && !state.result) set({ ...state, stage })
  },
  dismiss() {
    state?.resolve?.()
    set(null)
  },
  /** Dipanggil di finally: tutup panel bila proses berhenti tanpa menampilkan hasil. */
  ensureClosed() {
    if (state && !state.result) set(null)
  },
}

type ResultOptions = { icon?: string; title?: string; text?: string; html?: string; confirmButtonColor?: string }

/**
 * Pengganti Swal.fire untuk hasil upload: menutup progres dengan ringkasan hasil.
 * Selesai (promise resolve) saat pengguna menutup panel.
 */
export function uploadResult(options: ResultOptions) {
  const tone: UploadResultTone = options.icon === 'success' ? 'success' : options.icon === 'error' ? 'error' : 'info'
  const result = { tone, title: options.title ?? '', text: options.text ?? options.html ?? '' }
  return new Promise<void>(resolve => {
    set({ id: state?.id ?? nextId++, fileName: state?.fileName ?? '', stage: state?.stage ?? 'save', result, resolve })
  })
}
