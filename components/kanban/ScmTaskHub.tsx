'use client'

import React, { useState, useEffect } from 'react'
import { ScmKanbanBoard } from './ScmKanbanBoard'
import { ScmNotionTaskTable } from './ScmNotionTaskTable'
import { TaskModal } from './TaskModal'
import { ScmTask, TaskStatus, INITIAL_TASKS } from './types'
import {
  getScmTasks,
  saveScmTask,
  deleteScmTask,
  updateScmTaskStatus,
} from './actions'
import {
  LayoutGrid,
  ListTodo,
  Search,
  Plus,
  Database,
  Bell,
  BellRing,
} from 'lucide-react'
import { notify } from '@/lib/feedback'

const STORAGE_KEY = 'scm_hub_tasks_v1'

function playNotificationChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContextClass) return
    const ctx = new AudioContextClass()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(587.33, ctx.currentTime) // D5
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12) // A5
    gain.gain.setValueAtTime(0.18, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.38)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.38)
  } catch {}
}

export function ScmTaskHub() {
  const [tasks, setTasks] = useState<ScmTask[]>([])
  const [isLoaded, setIsLoaded] = useState(false)
  const [isSupabase, setIsSupabase] = useState<boolean | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTask, setSelectedTask] = useState<ScmTask | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalInitialStatus, setModalInitialStatus] = useState<TaskStatus>('TODO')
  const [activeView, setActiveView] = useState<'board' | 'table'>('board')
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'unsupported'>('default')

  // Cek dukungan notifikasi browser saat mount
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('Notification' in window)) {
      setNotificationPermission('unsupported')
      return
    }
    setNotificationPermission(Notification.permission)
  }, [])

  // Load from Supabase (with fallback to localStorage)
  useEffect(() => {
    let isMounted = true

    // 1. Muat instan dari localStorage untuk fast render
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved !== null) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) {
          setTasks(parsed)
          setIsLoaded(true)
        }
      }
    } catch (e) {
      console.warn('Failed to parse cached tasks', e)
    }

    // 2. Sync dari database Supabase
    getScmTasks()
      .then(async (res) => {
        if (!isMounted) return
        setIsSupabase(res.isSupabaseAvailable)

        if (res.isSupabaseAvailable) {
          const isInitialized = localStorage.getItem('scm_tasks_synced_v1') === 'true'

          if (res.tasks.length > 0) {
            // Sudah ada data di Supabase -> gunakan sebagai sumber utama
            setTasks(res.tasks)
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(res.tasks))
              localStorage.setItem('scm_tasks_synced_v1', 'true')
            } catch {}
          } else if (!isInitialized) {
            // Baru pertama kali tabel dibuat di Supabase (masih 0 baris)
            let seedList = INITIAL_TASKS
            try {
              const saved = localStorage.getItem(STORAGE_KEY)
              if (saved) {
                const parsed = JSON.parse(saved)
                if (Array.isArray(parsed) && parsed.length > 0) {
                  seedList = parsed
                }
              }
            } catch {}

            setTasks(seedList)
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(seedList))
              localStorage.setItem('scm_tasks_synced_v1', 'true')
            } catch {}

            // Kirim ke database Supabase
            for (const t of seedList) {
              await saveScmTask(t).catch(() => {})
            }
          } else {
            // User memang sudah sengaja menghapus semua task di database
            setTasks([])
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify([]))
            } catch {}
          }
        } else {
          // Jika Supabase offline / belum dibuat tabelnya
          if (localStorage.getItem(STORAGE_KEY) === null) {
            setTasks(INITIAL_TASKS)
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_TASKS))
            } catch {}
          }
        }
        setIsLoaded(true)
      })
      .catch((err) => {
        // Sesi habis: router sedang berpindah ke halaman login.
        if (String(err?.digest ?? '').startsWith('NEXT_REDIRECT')) return
        console.error('Failed to sync tasks from Supabase', err)
        if (!isMounted) return
        setIsLoaded(true)
      })

    return () => {
      isMounted = false
    }
  }, [])

  // Pengecekan otomatis Scheduled Task & Pengiriman Notifikasi Windows Desktop
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return
    if (notificationPermission !== 'granted') return

    const checkScheduledTasks = () => {
      const todayStr = new Date().toISOString().split('T')[0]
      const notifiedKey = `scm_notified_scheduled_${todayStr}`
      let notifiedIds: string[] = []
      try {
        const stored = localStorage.getItem(notifiedKey)
        if (stored) notifiedIds = JSON.parse(stored)
      } catch {}

      // Ambil task berstatus SCHEDULED yang jatuh tempo hari ini atau sebelumnya
      const scheduledTasks = tasks.filter(
        (t) => t.status === 'SCHEDULED' && (!t.deadline || t.deadline <= todayStr)
      )

      let newlyNotified = false
      for (const t of scheduledTasks) {
        if (!notifiedIds.includes(t.id)) {
          playNotificationChime()
          const n = new Notification(`⏰ Scheduled Task: ${t.name}`, {
            body: `Deadline: ${t.deadline || 'Hari ini'} | PIC: ${t.pic || 'Erwin'}\n${t.description ? t.description.slice(0, 90) : 'Jadwal task perlu perhatian.'}`,
            icon: '/favicon.ico',
            tag: `scheduled-${t.id}`,
          })
          n.onclick = () => {
            window.focus()
            setSelectedTask(t)
            setIsModalOpen(true)
          }
          notifiedIds.push(t.id)
          newlyNotified = true
        }
      }

      if (newlyNotified) {
        try {
          localStorage.setItem(notifiedKey, JSON.stringify(notifiedIds))
        } catch {}
      }
    }

    checkScheduledTasks()
    const timer = setInterval(checkScheduledTasks, 30000) // Cek setiap 30 detik
    return () => clearInterval(timer)
  }, [tasks, notificationPermission])

  const handleToggleNotification = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      notify.error('Notifikasi tidak didukung', 'Browser ini tidak mendukung Web Notifications.')
      return
    }

    if (Notification.permission === 'granted') {
      playNotificationChime()
      const n = new Notification('SCM Control Tower — Notifikasi Desktop', {
        body: 'Notifikasi Windows aktif! Scheduled task akan muncul otomatis di sini.',
        icon: '/favicon.ico',
      })
      n.onclick = () => window.focus()
      return
    }

    const permission = await Notification.requestPermission()
    setNotificationPermission(permission)

    if (permission === 'granted') {
      playNotificationChime()
      const n = new Notification('SCM Control Tower — Berhasil Diaktifkan!', {
        body: 'Notifikasi Desktop Windows aktif untuk semua scheduled task Kanban.',
        icon: '/favicon.ico',
      })
      n.onclick = () => window.focus()
    } else if (permission === 'denied') {
      notify.error('Izin notifikasi diblokir', 'Silakan aktifkan izin notifikasi pada ikon gembok di sebelah kiri address bar browser Anda.')
    }
  }

  const handleOpenNewTask = (status: TaskStatus = 'TODO') => {
    setSelectedTask(null)
    setModalInitialStatus(status)
    setIsModalOpen(true)
  }

  const handleSelectTask = (task: ScmTask) => {
    setSelectedTask(task)
    setIsModalOpen(true)
  }

  const handleSaveTask = (taskToSave: ScmTask) => {
    setTasks((prev) => {
      const exists = prev.some((t) => t.id === taskToSave.id)
      const next = exists
        ? prev.map((t) => (t.id === taskToSave.id ? taskToSave : t))
        : [taskToSave, ...prev]
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {}
      return next
    })

    // Simpan ke Supabase
    saveScmTask(taskToSave).catch((err) =>
      console.error('Error saving task to Supabase:', err)
    )
  }

  const handleDeleteTask = (taskId: string) => {
    setTasks((prev) => {
      const next = prev.filter((t) => t.id !== taskId)
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {}
      return next
    })

    // Hapus permanen di Supabase
    deleteScmTask(taskId).catch((err) =>
      console.error('Error deleting task from Supabase:', err)
    )
  }

  const handleMoveTaskStatus = (taskId: string, newStatus: TaskStatus) => {
    setTasks((prev) => {
      const next = prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {}
      return next
    })

    // Update status di Supabase
    updateScmTaskStatus(taskId, newStatus).catch((err) =>
      console.error('Error moving task status in Supabase:', err)
    )
  }

  const handleQuickAdd = (name: string) => {
    const newTask: ScmTask = {
      id: `t-${Date.now().toString(36)}`,
      name,
      status: 'TODO',
      deadline: new Date().toISOString().split('T')[0],
      pic: 'Erwin',
      assigner: 'Erwin',
      frequency: 'Sekali saja',
    }
    handleSaveTask(newTask)
  }

  // Filter tasks based on searchQuery for badges and table
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

  return (
    <div className="h-full w-full flex flex-col min-h-0 bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
      {/* Unified Single Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-slate-200/90 bg-white flex-shrink-0">
        {/* Left: Title + Badge + View Toggle Tabs */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-slate-900 tracking-tight">
              SCM Kanban Board
            </h1>
            <span className="grid h-6 min-w-6 place-items-center rounded-full bg-slate-100 px-2 text-xs font-bold text-slate-700">
              {filteredTasks.length}
            </span>
          </div>

          {/* View Mode Tabs (Board vs Tabel Detail) */}
          <div className="flex items-center rounded-xl bg-slate-100 p-0.5 text-xs font-medium text-slate-600">
            <button
              onClick={() => setActiveView('board')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all ${
                activeView === 'board'
                  ? 'bg-white text-slate-900 font-semibold shadow-sm'
                  : 'hover:text-slate-900'
              }`}
            >
              <LayoutGrid size={13} />
              <span>Board</span>
            </button>
            <button
              onClick={() => setActiveView('table')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all ${
                activeView === 'table'
                  ? 'bg-white text-slate-900 font-semibold shadow-sm'
                  : 'hover:text-slate-900'
              }`}
            >
              <ListTodo size={13} />
              <span>Tabel Detail</span>
            </button>
          </div>

          {/* Database indicator */}
          {isSupabase !== null && (
            <div
              className={`hidden sm:inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                isSupabase
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                  : 'bg-amber-50 text-amber-700 border border-amber-200/60'
              }`}
              title={
                isSupabase
                  ? 'Tersambung ke Supabase (database aktif)'
                  : 'Jalankan supabase/migration_v35_scm_tasks.sql di Supabase SQL Editor untuk mengaktifkan tabel database'
              }
            >
              <Database size={11} />
              <span>{isSupabase ? 'Supabase Connected' : 'Tabel SQL Belum Dibuat'}</span>
            </div>
          )}
        </div>

        {/* Right: Notification Toggle + Search Filter + New Task */}
        <div className="flex items-center gap-2.5">
          {/* Tombol Izin & Status Notifikasi Windows Desktop */}
          {notificationPermission !== 'unsupported' && (
            <button
              type="button"
              onClick={handleToggleNotification}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all border ${
                notificationPermission === 'granted'
                  ? 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100/80 shadow-xs'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
              title={
                notificationPermission === 'granted'
                  ? 'Notifikasi Desktop Windows Aktif! Klik untuk tes bunyi & toast pop-up'
                  : 'Klik untuk mengizinkan notifikasi Windows Desktop'
              }
            >
              {notificationPermission === 'granted' ? (
                <>
                  <BellRing size={13} className="text-indigo-600 animate-pulse" />
                  <span className="hidden md:inline">Notif Desktop Aktif</span>
                  <span className="md:hidden">Notif ON</span>
                </>
              ) : (
                <>
                  <Bell size={13} className="text-slate-400" />
                  <span className="hidden md:inline">Aktifkan Notifikasi Desktop</span>
                  <span className="md:hidden">Aktifkan Notif</span>
                </>
              )}
            </button>
          )}

          <div className="relative w-48 sm:w-60">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter cards..."
              className="w-full rounded-xl border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-800 placeholder:text-slate-400 focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
            />
          </div>

          <button
            onClick={() => handleOpenNewTask('TODO')}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-black hover:shadow"
          >
            <Plus size={14} />
            <span>New task</span>
          </button>
        </div>
      </div>

      {/* Main Content Area (Fills remaining height) */}
      <div className="flex-1 min-h-0 overflow-hidden p-4">
        {activeView === 'board' && (
          <ScmKanbanBoard
            tasks={tasks}
            searchQuery={searchQuery}
            onOpenNewTask={handleOpenNewTask}
            onSelectTask={handleSelectTask}
            onMoveTaskStatus={handleMoveTaskStatus}
          />
        )}

        {activeView === 'table' && (
          <ScmNotionTaskTable
            tasks={filteredTasks}
            onSelectTask={handleSelectTask}
            onMoveTaskStatus={handleMoveTaskStatus}
            onOpenNewTask={() => handleOpenNewTask('TODO')}
            onQuickAdd={handleQuickAdd}
          />
        )}
      </div>

      {/* Modal Detail / Edit / Create Task */}
      <TaskModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        task={selectedTask}
        initialStatus={modalInitialStatus}
        onSave={handleSaveTask}
        onDelete={handleDeleteTask}
        onAttachmentsChange={(taskId, count) =>
          setTasks(prev => prev.map(task => (task.id === taskId ? { ...task, attachmentsCount: count } : task)))
        }
      />
    </div>
  )
}
