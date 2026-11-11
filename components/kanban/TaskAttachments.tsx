'use client'

import { useEffect, useState, useTransition } from 'react'
import { Copy, ExternalLink, FolderOpen, Link2, Loader2, Plus, Trash2 } from 'lucide-react'
import { addTaskAttachment, deleteTaskAttachment, listTaskAttachments, type TaskAttachment } from './attachment-actions'
import { confirmAction, notify } from '@/lib/feedback'

const isWebLink = (location: string) => /^https?:\/\//i.test(location)

export function TaskAttachments({ taskId, onCountChange }: { taskId: string; onCountChange?: (count: number) => void }) {
  const [items, setItems] = useState<TaskAttachment[] | null>(null)
  const [label, setLabel] = useState('')
  const [location, setLocation] = useState('')
  const [error, setError] = useState('')
  const [saving, startSaving] = useTransition()

  useEffect(() => {
    let cancelled = false
    listTaskAttachments(taskId)
      .then(rows => { if (!cancelled) setItems(rows) })
      .catch(err => { if (!cancelled) { setItems([]); setError(err instanceof Error ? err.message : 'Gagal memuat lampiran.') } })
    return () => { cancelled = true }
  }, [taskId])

  function update(next: TaskAttachment[]) {
    setItems(next)
    onCountChange?.(next.length)
  }

  function add() {
    setError('')
    startSaving(async () => {
      try {
        const saved = await addTaskAttachment({ taskId, label, location })
        update([...(items ?? []), saved])
        setLabel('')
        setLocation('')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Gagal menyimpan lampiran.')
      }
    })
  }

  async function remove(item: TaskAttachment) {
    if (!(await confirmAction({ title: 'Hapus lampiran?', message: `Tautan "${item.label}" dihapus dari task ini. File aslinya tidak ikut terhapus.` }))) return
    try {
      await deleteTaskAttachment(item.id)
      update((items ?? []).filter(row => row.id !== item.id))
    } catch (err) {
      notify.error('Gagal menghapus lampiran', err instanceof Error ? err.message : undefined)
    }
  }

  async function copy(location: string) {
    try {
      await navigator.clipboard.writeText(location)
      notify.success('Path disalin', 'Tempel di File Explorer untuk membuka file.')
    } catch {
      notify.error('Tidak bisa menyalin', 'Salin path secara manual.')
    }
  }

  return (
    <section>
      <h3 className="mb-1.5 block text-[13px] font-medium text-slate-700">Lampiran</h3>
      <p className="mb-2 text-xs text-slate-500">
        Tempel tautan Google Drive atau path sharing folder. File tetap tersimpan di tempat aslinya.
      </p>

      {items === null ? (
        <p className="text-xs text-slate-500">Memuat lampiran...</p>
      ) : items.length > 0 && (
        <ul className="mb-3 divide-y divide-gray-200 rounded-xl border border-gray-200">
          {items.map(item => {
            const web = isWebLink(item.location)
            const Icon = web ? Link2 : FolderOpen
            return (
              <li key={item.id} className="flex items-center gap-3 px-3 py-2.5">
                <Icon className="h-4 w-4 shrink-0 text-gold-700" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-slate-900">{item.label}</div>
                  <div className="truncate text-xs text-slate-500" title={item.location}>{item.location}</div>
                </div>
                {web ? (
                  <a href={item.location} target="_blank" rel="noopener noreferrer" aria-label={`Buka ${item.label}`} className="grid h-9 w-9 place-items-center rounded-lg text-slate-600 hover:bg-gray-100">
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  </a>
                ) : (
                  <button type="button" onClick={() => void copy(item.location)} aria-label={`Salin path ${item.label}`} className="grid h-9 w-9 place-items-center rounded-lg text-slate-600 hover:bg-gray-100">
                    <Copy className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
                <button type="button" onClick={() => void remove(item)} aria-label={`Hapus ${item.label}`} className="grid h-9 w-9 place-items-center rounded-lg text-red-700 hover:bg-red-50">
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <div className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
        <input value={label} onChange={e => setLabel(e.target.value)} className="inp" placeholder="Nama (opsional)" aria-label="Nama lampiran" />
        <input
          value={location}
          onChange={e => setLocation(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (location.trim()) add() } }}
          className="inp"
          placeholder="https://drive.google.com/... atau \\server\folder\file.pdf"
          aria-label="Tautan atau path file"
        />
        <button
          type="button"
          onClick={add}
          disabled={saving || !location.trim()}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-gray-100 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
          Tambah
        </button>
      </div>
      {error && <p className="mt-1.5 text-xs font-medium text-red-700">{error}</p>}
    </section>
  )
}
