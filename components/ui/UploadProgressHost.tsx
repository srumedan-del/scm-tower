'use client'

import { useEffect, useRef, useSyncExternalStore } from 'react'
import { AlertCircle, FileSpreadsheet, Info } from 'lucide-react'
import { uploadProgress, uploadStore, type UploadStage } from '@/lib/upload-progress'

const STAGES: { key: UploadStage | 'done'; label: string }[] = [
  { key: 'read', label: 'Membaca file' },
  { key: 'validate', label: 'Validasi data' },
  { key: 'save', label: 'Menyimpan ke database' },
  { key: 'done', label: 'Selesai' },
]

const PROGRESS: Record<UploadStage, number> = { read: 22, validate: 50, save: 78 }

/** Centang yang tergambar, dipakai juga oleh pop-up sukses. */
export function AnimatedCheck({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path className="lux-check-path" d="M5 12.5l4.2 4.2L19 7" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function StageDot({ state }: { state: 'done' | 'active' | 'todo' }) {
  if (state === 'done') {
    return (
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-green text-white">
        <AnimatedCheck className="h-3.5 w-3.5" />
      </span>
    )
  }
  if (state === 'active') {
    return (
      <span className="relative grid h-6 w-6 shrink-0 place-items-center">
        <span className="absolute inset-0 rounded-full border-2 border-gold-200" />
        <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-gold-500" />
      </span>
    )
  }
  return <span className="h-6 w-6 shrink-0 rounded-full border-2 border-gray-200" />
}

export function UploadProgressHost() {
  const upload = useSyncExternalStore(uploadStore.subscribe, uploadStore.getSnapshot, uploadStore.getSnapshot)
  const actionRef = useRef<HTMLButtonElement>(null)
  const finished = Boolean(upload?.result)

  useEffect(() => {
    if (!finished) return
    actionRef.current?.focus()
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') uploadProgress.dismiss()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [finished])

  if (!upload) return null
  const result = upload.result
  const activeIndex = result ? STAGES.length : STAGES.findIndex(stage => stage.key === upload.stage)
  const percent = result ? 100 : PROGRESS[upload.stage]
  const failed = result?.tone === 'error'

  return (
    <div className="lux-fade-in fixed inset-0 z-[93] flex items-center justify-center bg-black/40 p-4">
      <div
        role={result ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-labelledby="upload-title"
        aria-busy={!result}
        className="lux-modal-in w-full max-w-md overflow-hidden rounded-2xl bg-white"
      >
        <div className="flex items-center gap-3 border-b border-gray-200 px-6 py-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gold-100 text-gold-700">
            <FileSpreadsheet className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 id="upload-title" className="lux-display text-lg font-semibold text-indigo-900">
              {result ? result.title || 'Upload selesai' : 'Mengunggah file…'}
            </h2>
            <p className="truncate text-xs text-slate-500" title={upload.fileName}>{upload.fileName}</p>
          </div>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="h-2 overflow-hidden rounded-full bg-gray-100">
            <div
              className={`lux-upload-bar h-full rounded-full ${failed ? 'bg-red' : result ? 'bg-green' : 'bg-gold-500'} ${result ? '' : 'lux-upload-bar-active'}`}
              style={{ width: `${percent}%` }}
            />
          </div>

          {result ? (
            <div className="lux-rise-in flex items-start gap-3">
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${result.tone === 'success' ? 'lux-success-mark bg-green-100 text-green-700' : failed ? 'bg-red-100 text-red-700' : 'bg-gold-100 text-gold-700'}`}>
                {result.tone === 'success'
                  ? <AnimatedCheck className="h-6 w-6" />
                  : failed ? <AlertCircle className="h-5 w-5" aria-hidden="true" /> : <Info className="h-5 w-5" aria-hidden="true" />}
              </span>
              <p className="min-w-0 whitespace-pre-line pt-1 text-sm leading-6 text-slate-700 [overflow-wrap:anywhere]">{result.text}</p>
            </div>
          ) : (
            <ol className="space-y-2.5" aria-live="polite">
              {STAGES.map((stage, index) => {
                const dot = index < activeIndex ? 'done' : index === activeIndex ? 'active' : 'todo'
                return (
                  <li key={stage.key} className="flex items-center gap-3">
                    <StageDot state={dot} />
                    <span className={`text-sm ${dot === 'todo' ? 'text-slate-400' : dot === 'active' ? 'font-semibold text-slate-900' : 'text-slate-600'}`}>
                      {stage.label}
                    </span>
                  </li>
                )
              })}
            </ol>
          )}
        </div>

        {result && (
          <div className="border-t border-gray-200 bg-gray-50 px-6 py-4">
            <button
              ref={actionRef}
              type="button"
              onClick={uploadProgress.dismiss}
              className="min-h-11 w-full rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
            >
              {failed ? 'Tutup' : 'Selesai'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
