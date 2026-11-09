'use server'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { ScmTask, TaskStatus, INITIAL_TASKS } from './types'
import { requireAuthenticatedUser } from '@/lib/requireUser'

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

    return {
      tasks: data.map(mapDbToTask),
      isSupabaseAvailable: true,
    }
  } catch (err: any) {
    console.warn('[getScmTasks] Exception querying Supabase:', err?.message)
    return { tasks: [], isSupabaseAvailable: false }
  }
}

/**
 * Menyimpan / memperbarui task ke Supabase.
 */
export async function saveScmTask(task: ScmTask): Promise<{ success: boolean; error?: string }> {
  await requireAuthenticatedUser()
  try {
    const payload = mapTaskToDb(task)
    const { error } = await supabaseAdmin
      .from('scm_tasks')
      .upsert(payload, { onConflict: 'id' })

    if (error) {
      console.error('[saveScmTask] Supabase error:', error.message)
      return { success: false, error: error.message }
    }

    return { success: true }
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
): Promise<{ success: boolean; error?: string }> {
  await requireAuthenticatedUser()
  try {
    const { error } = await supabaseAdmin
      .from('scm_tasks')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', taskId)

    if (error) {
      console.error('[updateScmTaskStatus] Supabase error:', error.message)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (err: any) {
    console.error('[updateScmTaskStatus] Exception:', err?.message)
    return { success: false, error: err?.message }
  }
}
