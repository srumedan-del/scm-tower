'use client'

import React, { useState } from 'react'
import {
  FileText,
  Clock,
  User,
  Users,
  Repeat,
  Sparkles,
  Plus,
  ChevronDown,
  Calendar,
  AlertCircle,
} from 'lucide-react'
import { ScmTask, TaskStatus, TaskFrequency, STATUS_CONFIG } from './types'

interface ScmNotionTaskTableProps {
  tasks: ScmTask[]
  onSelectTask: (task: ScmTask) => void
  onMoveTaskStatus: (taskId: string, newStatus: TaskStatus) => void
  onOpenNewTask: () => void
  onQuickAdd: (name: string) => void
}

export function ScmNotionTaskTable({
  tasks,
  onSelectTask,
  onMoveTaskStatus,
  onOpenNewTask,
  onQuickAdd,
}: ScmNotionTaskTableProps) {
  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null)
  const [inlineNewName, setInlineNewName] = useState('')
  const [isAddingInline, setIsAddingInline] = useState(false)

  // Format date to "Month DD, YYYY" e.g. "October 28, 2026"
  const formatDeadline = (dateStr: string) => {
    if (!dateStr) return '-'
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return d.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
  }

  // Check if deadline is overdue (relative to today or 2026-11-03)
  const isOverdue = (dateStr: string) => {
    if (!dateStr) return false
    const d = new Date(dateStr)
    const today = new Date('2026-11-03')
    return d < today
  }

  const handleInlineSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inlineNewName.trim()) {
      setIsAddingInline(false)
      return
    }
    onQuickAdd(inlineNewName.trim())
    setInlineNewName('')
    setIsAddingInline(false)
  }

  // Frequency badge styling matching Notion screenshots
  const getFrequencyBadgeClass = (freq: TaskFrequency) => {
    switch (freq) {
      case 'Bulanan':
        return 'bg-purple-100 text-purple-700'
      case 'Harian':
        return 'bg-sky-100 text-sky-700'
      case 'Mingguan':
        return 'bg-amber-100 text-amber-700'
      case 'Sekali saja':
      default:
        return 'bg-slate-100 text-slate-700'
    }
  }

  return (
    <div className="h-full w-full flex flex-col min-h-0">
      {/* Table Title and Actions */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold uppercase tracking-wider text-slate-800">
            Detail Tugas
          </span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
            {tasks.length} baris
          </span>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm scrollbar-thin">
        <table className="w-full border-collapse text-left">
          {/* Header matching Screenshot 3 */}
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-800">
              <th className="px-4 py-3.5 text-sm font-bold uppercase tracking-wider min-w-[280px]">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-slate-500">Aa</span>
                  <span>Name</span>
                </div>
              </th>
              <th className="px-4 py-3.5 text-sm font-bold uppercase tracking-wider min-w-[150px]">
                <div className="flex items-center gap-1.5">
                  <Sparkles size={14} className="text-slate-500" />
                  <span>Status</span>
                </div>
              </th>
              <th className="px-4 py-3.5 text-sm font-bold uppercase tracking-wider min-w-[190px]">
                <div className="flex items-center gap-1.5">
                  <Calendar size={14} className="text-slate-500" />
                  <span>Deadline</span>
                  <span className="text-[10px] text-slate-400">ⓘ</span>
                </div>
              </th>
              <th className="px-4 py-3.5 text-sm font-bold uppercase tracking-wider min-w-[140px]">
                <div className="flex items-center gap-1.5">
                  <User size={14} className="text-slate-500" />
                  <span>Pelaksana / PIC</span>
                  <span className="text-[10px] text-slate-400">ⓘ</span>
                </div>
              </th>
              <th className="px-4 py-3.5 text-sm font-bold uppercase tracking-wider min-w-[150px]">
                <div className="flex items-center gap-1.5">
                  <Users size={14} className="text-slate-500" />
                  <span>Pemberi tugas</span>
                  <span className="text-[10px] text-slate-400">ⓘ</span>
                </div>
              </th>
              <th className="px-4 py-3.5 text-sm font-bold uppercase tracking-wider min-w-[130px]">
                <div className="flex items-center gap-1.5">
                  <Repeat size={14} className="text-slate-500" />
                  <span>Frekuensi</span>
                  <span className="text-[10px] text-slate-400">ⓘ</span>
                </div>
              </th>
            </tr>
          </thead>

          {/* Body Rows */}
          <tbody className="divide-y divide-slate-100 text-sm">
            {tasks.map((task) => {
              const cfg = STATUS_CONFIG[task.status]
              const overdue = isOverdue(task.deadline)
              const isOpenStatusMenu = activeDropdownId === task.id

              return (
                <tr
                  key={task.id}
                  className="group hover:bg-slate-50/70 transition-colors"
                >
                  {/* Name column with document icon */}
                  <td className="px-4 py-3 font-medium text-slate-800">
                    <div
                      onClick={() => onSelectTask(task)}
                      className="flex items-center gap-2.5 cursor-pointer hover:text-brand-primary transition-colors"
                    >
                      <FileText size={16} className="text-slate-400 flex-shrink-0" />
                      {task.icon && <span className="flex-shrink-0">{task.icon}</span>}
                      <span className="truncate max-w-md" title={task.name}>
                        {task.name}
                      </span>
                    </div>
                  </td>

                  {/* Status column with Notion pill */}
                  <td className="px-4 py-3 relative">
                    <button
                      type="button"
                      onClick={() =>
                        setActiveDropdownId(isOpenStatusMenu ? null : task.id)
                      }
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${cfg.bgBadge} ${cfg.textBadge} hover:opacity-80 transition-opacity`}
                    >
                      <span className={`h-2 w-2 rounded-full ${cfg.dotColor}`} />
                      <span>{cfg.tableLabel}</span>
                      <ChevronDown size={11} className="opacity-60" />
                    </button>

                    {/* Quick status switcher dropdown */}
                    {isOpenStatusMenu && (
                      <div className="absolute left-4 top-12 z-20 w-48 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                        {Object.entries(STATUS_CONFIG).map(([stKey, stCfg]) => (
                          <button
                            key={stKey}
                            onClick={() => {
                              onMoveTaskStatus(task.id, stKey as TaskStatus)
                              setActiveDropdownId(null)
                            }}
                            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors"
                          >
                            <span className={`h-2 w-2 rounded-full ${stCfg.dotColor}`} />
                            <span>{stCfg.tableLabel}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </td>

                  {/* Deadline column with alarm clock */}
                  <td className="px-4 py-3">
                    <div
                      className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                        overdue
                          ? 'text-rose-600'
                          : 'text-brand-primary'
                      }`}
                    >
                      <span>⏰</span>
                      <span>{formatDeadline(task.deadline)}</span>
                    </div>
                  </td>

                  {/* PIC column */}
                  <td className="px-4 py-3 text-xs font-medium text-slate-700">
                    {task.pic || '-'}
                  </td>

                  {/* Pemberi tugas column with avatar badge */}
                  <td className="px-4 py-3">
                    {task.assigner ? (
                      <div className="inline-flex items-center gap-1.5 text-xs text-slate-700">
                        <span className="grid h-5 w-5 place-items-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-700">
                          {task.assigner.slice(0, 1).toUpperCase()}
                        </span>
                        <span>{task.assigner}</span>
                      </div>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>

                  {/* Frequency column */}
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium ${getFrequencyBadgeClass(
                        task.frequency
                      )}`}
                    >
                      {task.frequency}
                    </span>
                  </td>
                </tr>
              )
            })}

            {/* Bottom Row: + New page matching Screenshot 3 */}
            <tr>
              <td colSpan={6} className="px-4 py-3 text-slate-500">
                {isAddingInline ? (
                  <form onSubmit={handleInlineSubmit} className="flex items-center gap-2">
                    <FileText size={16} className="text-slate-400" />
                    <input
                      type="text"
                      autoFocus
                      value={inlineNewName}
                      onChange={(e) => setInlineNewName(e.target.value)}
                      placeholder="Ketik judul task baru lalu tekan Enter..."
                      className="w-full max-w-md rounded-lg border border-slate-300 px-3 py-1 text-xs text-slate-800 placeholder:text-slate-400 focus:border-brand-primary focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="rounded-lg bg-brand-primary px-3 py-1 text-xs font-medium text-white hover:bg-brand-primary-hover"
                    >
                      Tambah
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsAddingInline(false)}
                      className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
                    >
                      Batal
                    </button>
                  </form>
                ) : (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setIsAddingInline(true)}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors"
                    >
                      <Plus size={14} />
                      <span>New page</span>
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      onClick={onOpenNewTask}
                      className="text-xs font-medium text-brand-primary hover:underline"
                    >
                      + Buka Form Lengkap
                    </button>
                  </div>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
