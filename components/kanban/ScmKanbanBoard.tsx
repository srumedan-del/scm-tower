'use client'

import React, { useState } from 'react'
import {
  Plus,
  AlertTriangle,
  MessageSquare,
  Paperclip,
  ListTodo,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react'
import { ScmTask, TaskStatus, STATUS_CONFIG, KANBAN_COLUMNS } from './types'

interface ScmKanbanBoardProps {
  tasks: ScmTask[]
  searchQuery: string
  onOpenNewTask: (status?: TaskStatus) => void
  onSelectTask: (task: ScmTask) => void
  onMoveTaskStatus: (taskId: string, newStatus: TaskStatus) => void
}

export function ScmKanbanBoard({
  tasks,
  searchQuery,
  onOpenNewTask,
  onSelectTask,
  onMoveTaskStatus,
}: ScmKanbanBoardProps) {
  // Filter tasks based on searchQuery
  const filteredTasks = tasks.filter((t) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      t.name.toLowerCase().includes(q) ||
      (t.description && t.description.toLowerCase().includes(q)) ||
      t.pic.toLowerCase().includes(q) ||
      (t.tags && t.tags.some((tag) => tag.toLowerCase().includes(q)))
    )
  })

  // Track manually expanded empty columns.
  // Rule: Columns with cards (> 0) are ALWAYS open.
  // Columns with 0 cards are collapsed by default, unless manually expanded.
  const [expandedEmptyColumns, setExpandedEmptyColumns] = useState<Record<string, boolean>>({})

  const toggleEmptyColumn = (column: TaskStatus) => {
    setExpandedEmptyColumns((prev) => ({
      ...prev,
      [column]: !prev[column],
    }))
  }

  const getTasksByStatus = (status: TaskStatus) => {
    return filteredTasks.filter((t) => t.status === status)
  }

  // Get next and previous statuses for quick move
  const getPrevStatus = (current: TaskStatus): TaskStatus | null => {
    const idx = KANBAN_COLUMNS.indexOf(current)
    if (idx > 0) return KANBAN_COLUMNS[idx - 1]
    return null
  }

  const getNextStatus = (current: TaskStatus): TaskStatus | null => {
    const idx = KANBAN_COLUMNS.indexOf(current)
    if (idx < KANBAN_COLUMNS.length - 1) return KANBAN_COLUMNS[idx + 1]
    return null
  }

  return (
    <div className="h-full w-full flex flex-col min-h-0">
      {/* Kanban Board Columns Horizontal Scroll */}
      <div className="flex-1 min-h-0 flex gap-3.5 overflow-x-auto pb-3 pt-1 snap-x scrollbar-thin">
        {KANBAN_COLUMNS.map((column) => {
          const colTasks = getTasksByStatus(column)
          const config = STATUS_CONFIG[column]
          const hasCards = colTasks.length > 0

          // Rule: If it has cards, it is ALWAYS open (never collapsed).
          // If it has no cards, it is collapsed UNLESS manually expanded.
          const isCollapsed = !hasCards && !expandedEmptyColumns[column]

          // 1. COLLAPSED VIEW (Only for columns with NO cards)
          if (isCollapsed) {
            return (
              <div
                key={column}
                onClick={() => toggleEmptyColumn(column)}
                className="flex-shrink-0 w-11 bg-slate-100/80 hover:bg-slate-200/70 rounded-2xl border border-slate-200/90 py-3.5 px-1.5 flex flex-col items-center justify-between h-full cursor-pointer transition-all select-none shadow-sm group"
                title={`Klik untuk membuka kolom kosong ${config.label}`}
              >
                {/* Top: Dot + Count */}
                <div className="flex flex-col items-center gap-1.5">
                  <span className={`h-2.5 w-2.5 rounded-full ${config.dotColor}`} />
                  <span className="text-[11px] font-bold text-slate-400 group-hover:text-slate-700">
                    0
                  </span>
                </div>

                {/* Center: Vertical Rotated Label */}
                <div className="flex-1 flex items-center justify-center my-4">
                  <span className="text-[11px] font-bold tracking-widest uppercase text-slate-500 group-hover:text-slate-900 transition-colors [writing-mode:vertical-lr] rotate-180">
                    {config.label}
                  </span>
                </div>

                {/* Bottom: Expand Indicator */}
                <div className="text-slate-400 group-hover:text-slate-700 p-0.5">
                  <ChevronRight size={14} />
                </div>
              </div>
            )
          }

          // 2. EXPANDED VIEW (All columns with cards are permanently here, or empty ones manually expanded)
          return (
            <div
              key={column}
              className="flex-shrink-0 w-80 bg-slate-50/90 rounded-2xl border border-slate-200/80 p-3.5 flex flex-col h-full shadow-sm transition-all"
            >
              {/* Column Header */}
              <div className="flex items-center justify-between mb-3 px-1 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${config.dotColor}`} />
                  <span className="text-xs font-bold tracking-wider uppercase text-slate-700">
                    {config.label}
                  </span>
                  <span className="text-xs font-semibold text-slate-400">
                    {colTasks.length}
                  </span>
                </div>

                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => onOpenNewTask(column)}
                    className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors"
                    title={`Tambah task ke ${config.label}`}
                  >
                    <Plus size={14} />
                  </button>

                  {/* Only empty columns have a collapse button to fold back */}
                  {!hasCards && (
                    <button
                      onClick={() => toggleEmptyColumn(column)}
                      className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors"
                      title="Tutup kembali kolom kosong ini"
                    >
                      <ChevronLeft size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Column Cards (Scrollable internally) */}
              <div className="flex-1 min-h-0 overflow-y-auto space-y-2.5 pr-1 scrollbar-thin">
                {!hasCards ? (
                  <div
                    onClick={() => toggleEmptyColumn(column)}
                    className="h-32 flex flex-col items-center justify-center gap-1 text-xs font-medium text-slate-400 cursor-pointer hover:text-slate-600 rounded-xl hover:bg-slate-100/50 transition-colors"
                    title="Klik untuk menutup kolom kosong ini"
                  >
                    <span>Empty</span>
                    <span className="text-[10px] text-slate-400 hover:underline">
                      (Klik untuk ciutkan)
                    </span>
                  </div>
                ) : (
                  colTasks.map((t) => {
                    const prev = getPrevStatus(t.status)
                    const next = getNextStatus(t.status)
                    const avatarLetter = (t.pic || 'E').slice(0, 1).toUpperCase()
                    const displayId = t.id.replace('t-', '').slice(0, 6)

                    return (
                      <div
                        key={t.id}
                        className={`group relative rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm transition-all hover:border-slate-300 hover:shadow-md ${
                          t.status === 'BLOCKED' ? 'border-l-4 border-l-red-500' : ''
                        }`}
                      >
                        {/* Title and Edit Trigger */}
                        <div
                          onClick={() => onSelectTask(t)}
                          className="cursor-pointer"
                        >
                          <h4 className="text-sm font-semibold text-slate-900 leading-snug line-clamp-2 hover:text-brand-primary transition-colors">
                            {t.icon ? <span className="mr-1.5">{t.icon}</span> : null}
                            {t.name}
                          </h4>

                          {t.description && (
                            <p className="mt-1.5 text-xs text-slate-500 line-clamp-2 leading-relaxed">
                              {t.description}
                            </p>
                          )}
                        </div>

                        {/* Card Footer: Badges, PIC, Actions */}
                        <div className="mt-3.5 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                          {/* Left: Avatar & Tag */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className="grid h-6 w-6 place-items-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-700 border border-slate-200"
                              title={`PIC: ${t.pic}`}
                            >
                              {avatarLetter}
                            </span>

                            {t.tags && t.tags.includes('needs_input') && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50/80 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                needs_input
                              </span>
                            )}
                          </div>

                          {/* Right: Meta icons & ID */}
                          <div className="flex items-center gap-2 text-slate-400 text-[11px]">
                            {t.warningCount && (
                              <span className="inline-flex items-center gap-0.5 text-amber-600 font-medium">
                                <AlertTriangle size={12} />
                                {t.warningCount}
                              </span>
                            )}
                            {t.commentsCount && (
                              <span className="inline-flex items-center gap-0.5 text-slate-500">
                                <MessageSquare size={12} />
                                {t.commentsCount}
                              </span>
                            )}
                            {!!t.attachmentsCount && (
                              <span className="inline-flex items-center gap-0.5 text-slate-500" title={`${t.attachmentsCount} lampiran`}>
                                <Paperclip size={12} />
                                {t.attachmentsCount}
                              </span>
                            )}
                            {t.subtasks && (
                              <span className="inline-flex items-center gap-0.5 text-slate-500">
                                <ListTodo size={12} />
                                {t.subtasks}
                              </span>
                            )}
                            <span className="font-mono text-[10px] text-slate-400">
                              {displayId}
                            </span>
                          </div>
                        </div>

                        {/* Hover Quick-Move Arrows */}
                        <div className="mt-2 pt-1 border-t border-slate-50 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                          {prev ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                onMoveTaskStatus(t.id, prev)
                              }}
                              className="inline-flex items-center gap-0.5 text-[10px] font-medium text-slate-500 hover:text-slate-800 p-0.5 rounded hover:bg-slate-100"
                              title={`Pindah ke ${prev}`}
                            >
                              <ChevronLeft size={12} />
                              <span>{prev}</span>
                            </button>
                          ) : <div />}

                          {next ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                onMoveTaskStatus(t.id, next)
                              }}
                              className="inline-flex items-center gap-0.5 text-[10px] font-medium text-slate-500 hover:text-slate-800 p-0.5 rounded hover:bg-slate-100"
                              title={`Pindah ke ${next}`}
                            >
                              <span>{next}</span>
                              <ChevronRight size={12} />
                            </button>
                          ) : <div />}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
