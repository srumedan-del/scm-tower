'use server'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireAuthenticatedUser } from '@/lib/requireUser'

export async function upsertCustomer(payload: Record<string, any>, id?: number) {
  await requireAuthenticatedUser()
  if (id) {
    const { error } = await supabaseAdmin.from('customers').update(payload).eq('id', id)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await supabaseAdmin.from('customers').insert(payload)
    if (error) throw new Error(error.message)
  }
}

export async function deleteCustomer(id: number) {
  await requireAuthenticatedUser()
  const { error } = await supabaseAdmin.from('customers').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
