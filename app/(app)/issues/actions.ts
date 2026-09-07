'use server'

import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function generateIssueNo(issueDate: string): Promise<string> {
  const d = new Date(issueDate)
  const yy = String(d.getFullYear()).slice(2)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const prefix = `ISS-${yy}${mm}-`

  const { data } = await supabaseAdmin
    .from('issue_log')
    .select('issue_no')
    .like('issue_no', `${prefix}%`)
    .order('issue_no', { ascending: false })
    .limit(1)

  let next = 1
  if (data && data.length > 0 && data[0].issue_no) {
    const last = parseInt(data[0].issue_no.split('-').at(-1) ?? '0', 10)
    next = isNaN(last) ? 1 : last + 1
  }
  return `${prefix}${String(next).padStart(4, '0')}`
}

export async function upsertIssue(payload: Record<string, any>, id?: number) {
  if (id) {
    const { error } = await supabaseAdmin.from('issue_log').update(payload).eq('id', id)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await supabaseAdmin.from('issue_log').insert(payload)
    if (error) throw new Error(error.message)
  }
}

export async function deleteIssue(id: number) {
  const { error } = await supabaseAdmin.from('issue_log').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
