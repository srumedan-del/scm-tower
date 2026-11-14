'use server'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { ScmTask, TaskStatus, INITIAL_TASKS } from './types'
import { requireAuthenticatedUser } from '@/lib/requireUser'
import { nextOccurrenceDate } from './recurrence'

function mapDbToTask(row: any): ScmTask {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    status: (row.status as TaskStatus) || 'TODO',
    deadline: row.deadline ? String(row.deadline).slice(0, 10) : new Date().toISOString().slice(0, 10),
    pic: row.pic || 'Erwin',
    assigner: row.assigner || 'Erwin',
    frequency: row.frequency || 'Sekali saja',
    tags: Array.isArray(row.tags) ? row.tags : [],
    warningCount: Number(row.warning_count ?? 0),
    commentsCount: Number(row.comments_count ?? 0),
    subtasks: row.subtasks ?? undefined,
    icon: row.icon ?? undefined,
  }
}

function mapTaskToDb(task: ScmTask): any {
  return {
    id: task.id,
    name: task.name,
    description: task.description || null,
    status: task.status,
    deadline: task.deadline || null,
    pic: task.pic || 'Erwin',
    assigner: task.assigner || 'Erwin',
    frequency: task.frequency || 'Sekali saja',
    tags: task.tags && task.tags.length > 0 ? task.tags : [],
    warning_count: task.warningCount ?? 0,
    comments_count: task.commentsCount ?? 0,
    subtasks: task.subtasks || null,
    icon: task.icon || null,
    updated_at: new Date().toISOString(),
  }
}

/**
 * Mengambil semua tasks dari database Supabase (tabel scm_tasks).
 * Jika tabel belum dibuat, mengembalikan status isSupabaseAvailable: false.
 */
export async function getScmTasks(): Promise<{ tasks: ScmTask[]; isSupabaseAvailable: boolean }> {
  await requireAuthenticatedUser()
  try {
    const { data, error } = await supabaseAdmin
      .from('scm_tasks')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.warn('[getScmTasks] Supabase query error (table might not exist yet):', error.message)
      return { tasks: [], isSupabaseAvailable: false }
    }

    if (!data) {
      return { tasks: [], isSupabaseAvailable: true }
    }

    // Jumlah lampiran per task; tabel lampiran mungkin belum dibuat (migration v42).
    const counts = new Map<string, number>()
    const { data: attachments } = await supabaseAdmin.from('scm_task_attachments').select('task_id')
    for (const row of attachments ?? []) counts.set(row.task_id, (counts.get(row.task_id) ?? 0) + 1)

    return {
      tasks: data.map(row => ({ ...mapDbToTask(row), attachmentsCount: counts.get(row.id) ?? 0 })),
      isSupabaseAvailable: true,
    }
  } catch (err: any) {
    console.warn('[getScmTasks] Exception querying Supabase:', err?.message)
    return { tasks: [], isSupabaseAvailable: false }
  }
}

type SaveResult = { success: boolean; error?: string; next?: ScmTask }

/**
 * Tugas berulang (Harian/Mingguan/Bulanan) yang baru saja DONE: buat tugas periode berikutnya
 * berstatus TODO. Tugas yang selesai tetap di DONE sebagai riwayat.
 * Tidak dibuat bila sudah ada tugas dengan nama + frekuensi sama yang belum DONE.
 */
async function spawnNextOccurrence(row: any): Promise<ScmTask | undefined> {
  const frequency = row?.frequency
  if (!frequency || frequency === 'Sekali saja') return undefined
  const { data: open } = await supabaseAdmin
    .from('scm_tasks')
    .select('id')
    .eq('name', row.name)
    .eq('frequency', frequency)
    .neq('status', 'DONE')
    .neq('id', row.id)
    .limit(1)
  if (open?.length) return undefined

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())
  const deadline = nextOccurrenceDate(frequency, row.deadline ? String(row.deadline).slice(0, 10) : today, today)
  if (!deadline) return undefined
  const next = {
    id: `t-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name: row.name,
    description: row.description ?? null,
    status: 'TODO',
    deadline,
    pic: row.pic || 'Erwin',
    assigner: row.assigner || 'Erwin',
    frequency,
    tags: Array.isArray(row.tags) ? row.tags.filter((tag: string) => tag !== 'needs_input') : [],
    warning_count: 0,
    comments_count: 0,
    subtasks: null,
    icon: row.icon ?? null,
    updated_at: new Date().toISOString(),
  }
  const { data, error } = await supabaseAdmin.from('scm_tasks').insert(next).select('*').single()
  if (error) {
    console.error('[spawnNextOccurrence] Supabase error:', error.message)
    return undefined
  }
  return { ...mapDbToTask(data), attachmentsCount: 0 }
}

/**
 * Menyimpan / memperbarui task ke Supabase.
 */
export async function saveScmTask(task: ScmTask): Promise<SaveResult> {
  await requireAuthenticatedUser()
  try {
    const { data: before } = await supabaseAdmin.from('scm_tasks').select('status').eq('id', task.id).maybeSingle()
    const payload = mapTaskToDb(task)
    const { error } = await supabaseAdmin
      .from('scm_tasks')
      .upsert(payload, { onConflict: 'id' })

    if (error) {
      console.error('[saveScmTask] Supabase error:', error.message)
      return { success: false, error: error.message }
    }

    const next = task.status === 'DONE' && before?.status !== 'DONE' ? await spawnNextOccurrence(payload) : undefined
    return { success: true, next }
  } catch (err: any) {
    console.error('[saveScmTask] Exception:', err?.message)
    return { success: false, error: err?.message }
  }
}

/**
 * Menghapus task dari Supabase secara permanen.
 */
export async function deleteScmTask(taskId: string): Promise<{ success: boolean; error?: string }> {
  await requireAuthenticatedUser()
  try {
    const { error } = await supabaseAdmin
      .from('scm_tasks')
      .delete()
      .eq('id', taskId)

    if (error) {
      console.error('[deleteScmTask] Supabase error:', error.message)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (err: any) {
    console.error('[deleteScmTask] Exception:', err?.message)
    return { success: false, error: err?.message }
  }
}

/**
 * Mengubah status kolom task di Supabase (misal drag-and-drop atau switch status).
 */
export async function updateScmTaskStatus(
  taskId: string,
  newStatus: TaskStatus
): Promise<SaveResult> {
  await requireAuthenticatedUser()
  try {
    const { data: before } = await supabaseAdmin.from('scm_tasks').select('*').eq('id', taskId).maybeSingle()
    const { error } = await supabaseAdmin
      .from('scm_tasks')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', taskId)

    if (error) {
      console.error('[updateScmTaskStatus] Supabase error:', error.message)
      return { success: false, error: error.message }
    }

    const next = newStatus === 'DONE' && before && before.status !== 'DONE' ? await spawnNextOccurrence(before) : undefined
    return { success: true, next }
  } catch (err: any) {
    console.error('[updateScmTaskStatus] Exception:', err?.message)
    return { success: false, error: err?.message }
  }
}
