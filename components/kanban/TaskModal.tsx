'use client'

import { DialogShell, DialogHeader, dialogBodyClass, dialogFooterClass, dialogCancelClass, dialogPrimaryClass, dialogDangerClass } from '@/components/ui/FormDialog'
import { showSuccess } from '@/lib/feedback'
import React, { useState, useEffect } from 'react'
import { Calendar, User, Clock, AlertCircle, Trash2, Tag, CheckSquare } from 'lucide-react'
import { ScmTask, TaskStatus, TaskFrequency, STATUS_CONFIG } from './types'
import { TaskAttachments } from './TaskAttachments'

interface TaskModalProps {
  isOpen: boolean
  onClose: () => void
  task?: ScmTask | null
  initialStatus?: TaskStatus
  onSave: (task: ScmTask) => void
  onDelete?: (taskId: string) => void
  onAttachmentsChange?: (taskId: string, count: number) => void
}

export function TaskModal({
  isOpen,
  onClose,
  task,
  initialStatus = 'TODO',
  onSave,
  onDelete,
  onAttachmentsChange,
}: TaskModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<TaskStatus>(initialStatus)
  const [deadline, setDeadline] = useState(new Date().toISOString().split('T')[0])
  const [pic, setPic] = useState('Erwin')
  const [assigner, setAssigner] = useState('Erwin')
  const [frequency, setFrequency] = useState<TaskFrequency>('Sekali saja')
  const [tagsStr, setTagsStr] = useState('')
  const [showConfirmDelete, setShowConfirmDelete] = useState(false)

  useEffect(() => {
    if (task) {
      setName(task.name)
      setDescription(task.description || '')
      setStatus(task.status)
      setDeadline(task.deadline || new Date().toISOString().split('T')[0])
      setPic(task.pic || 'Erwin')
      setAssigner(task.assigner || 'Erwin')
      setFrequency(task.frequency || 'Sekali saja')
      setTagsStr((task.tags || []).join(', '))
    } else {
      setName('')
      setDescription('')
      setStatus(initialStatus)
      setDeadline(new Date().toISOString().split('T')[0])
      setPic('Erwin')
      setAssigner('Erwin')
      setFrequency('Sekali saja')
      setTagsStr('')
    }
    setShowConfirmDelete(false)
  }, [task, initialStatus, isOpen])

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    const tags = tagsStr
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)

    const updatedTask: ScmTask = {
      id: task ? task.id : `t-${Date.now().toString(36)}`,
      name: name.trim(),
      description: description.trim(),
      status,
      deadline,
      pic: pic.trim() || 'Erwin',
      assigner: assigner.trim() || 'Erwin',
      frequency,
      tags,
      commentsCount: task?.commentsCount,
      warningCount: task?.warningCount,
      subtasks: task?.subtasks,
      icon: task?.icon,
      attachmentsCount: task?.attachmentsCount,
    }

    onSave(updatedTask)
    onClose()
    void showSuccess({ title: 'Task tersimpan', message: updatedTask.name })
  }

  return (
    <>
      <DialogShell onClose={onClose} size="xl">
        <DialogHeader title={task ? 'Edit Task' : 'Tambah Task Baru'} subtitle={task ? task.name : 'Catat pekerjaan baru di board'} icon={CheckSquare} />

          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className={dialogBodyClass}>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                Nama Task *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Buat pengajuan forecast NHD"
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TaskStatus)}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 bg-white focus:border-brand-primary focus:outline-none"
                >
                  {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                    <option key={key} value={key}>
                      {cfg.label} ({cfg.tableLabel})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Deadline
                </label>
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 bg-white focus:border-brand-primary focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Pelaksana / PIC
                </label>
                <input
                  type="text"
                  value={pic}
                  onChange={(e) => setPic(e.target.value)}
                  placeholder="Erwin"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-brand-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Pemberi Tugas
                </label>
                <input
                  type="text"
                  value={assigner}
                  onChange={(e) => setAssigner(e.target.value)}
                  placeholder="Erwin"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-brand-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Frekuensi
                </label>
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value as TaskFrequency)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 bg-white focus:border-brand-primary focus:outline-none"
                >
                  <option value="Sekali saja">Sekali saja</option>
                  <option value="Harian">Harian</option>
                  <option value="Mingguan">Mingguan</option>
                  <option value="Bulanan">Bulanan</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                Deskripsi / Detail
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Catatan atau detail rincian tugas..."
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-brand-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                Tags (pisahkan koma)
              </label>
              <input
                type="text"
                value={tagsStr}
                onChange={(e) => setTagsStr(e.target.value)}
                placeholder="needs_input, urgent, sop"
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-brand-primary focus:outline-none"
              />
            </div>

            {task ? (
              <TaskAttachments taskId={task.id} onCountChange={count => onAttachmentsChange?.(task.id, count)} />
            ) : (
              <p className="text-xs text-slate-500">Lampiran bisa ditambahkan setelah task disimpan.</p>
            )}

            </div>

            <div className={dialogFooterClass}>
              {task && onDelete ? (
                <button
                  type="button"
                  onClick={() => setShowConfirmDelete(true)}
                  className={dialogDangerClass}
                >
                  <Trash2 size={14} />
                  <span>Hapus</span>
                </button>
              ) : <div />}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className={dialogCancelClass}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className={dialogPrimaryClass}
                >
                  Simpan
                </button>
              </div>
            </div>
          </form>
      </DialogShell>

      {/* Modern Delete Confirmation Dialog */}
      {showConfirmDelete && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 text-center animate-scaleUp">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 ring-8 ring-rose-50/50 mb-4">
              <Trash2 className="h-7 w-7" />
            </div>

            <h3 className="text-lg font-bold text-slate-900">
              Hapus Task Ini?
            </h3>

            <p className="mt-2 text-xs text-slate-500 leading-relaxed px-2">
              Task <span className="font-semibold text-slate-800">"{name || task?.name}"</span> akan dihapus secara permanen dari board dan tabel.
            </p>

            <div className="mt-6 flex items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={() => setShowConfirmDelete(false)}
                className="w-1/2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  if (task && onDelete) {
                    onDelete(task.id)
                  }
                  setShowConfirmDelete(false)
                  onClose()
                }}
                className="w-1/2 rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-rose-700 transition-colors flex items-center justify-center gap-1.5"
              >
                <Trash2 size={13} />
                <span>Ya, Hapus</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
