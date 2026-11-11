'use server'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireAuthenticatedUser } from '@/lib/requireUser'

export type TaskAttachment = {
  id: number
  label: string
  location: string
  added_by: string | null
  created_at: string
}

const COLUMNS = 'id, label, location, added_by, created_at'

/** Tautan web atau path folder Windows (UNC \\server\share atau huruf drive). */
function normalizeLocation(value: string) {
  const location = value.trim()
  if (!location) throw new Error('Tautan atau path file wajib diisi.')
  if (location.length > 1000) throw new Error('Tautan terlalu panjang.')
  if (/^https?:\/\/\S+$/i.test(location)) return location
  if (/^\\\\[^\\]+\\[^\\]+/.test(location) || /^[a-z]:\\/i.test(location)) return location
  throw new Error('Isi dengan tautan https://... atau path folder seperti \\\\server\\folder\\file.pdf atau H:\\folder\\file.pdf.')
}

export async function listTaskAttachments(taskId: string): Promise<TaskAttachment[]> {
  await requireAuthenticatedUser()
  const { data, error } = await supabaseAdmin
    .from('scm_task_attachments')
    .select(COLUMNS)
    .eq('task_id', taskId)
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as TaskAttachment[]
}

export async function addTaskAttachment(input: { taskId: string; label: string; location: string }): Promise<TaskAttachment> {
  const user = await requireAuthenticatedUser()
  const location = normalizeLocation(input.location)
  const fallbackLabel = location.split(/[\\/]/).filter(Boolean).pop() ?? location
  const label = (input.label.trim() || fallbackLabel).slice(0, 200)

  const { data: task, error: taskError } = await supabaseAdmin.from('scm_tasks').select('id').eq('id', input.taskId).maybeSingle()
  if (taskError) throw new Error(taskError.message)
  if (!task) throw new Error('Task belum tersimpan. Simpan task dulu sebelum menambah lampiran.')

  const { data, error } = await supabaseAdmin
    .from('scm_task_attachments')
    .insert({ task_id: input.taskId, label, location, added_by: user.email ?? null })
    .select(COLUMNS)
    .single()
  if (error) throw new Error(error.message)
  return data as TaskAttachment
}

export async function deleteTaskAttachment(id: number) {
  await requireAuthenticatedUser()
  const { error } = await supabaseAdmin.from('scm_task_attachments').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
