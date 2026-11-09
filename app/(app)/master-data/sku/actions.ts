'use server'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireAuthenticatedUser } from '@/lib/requireUser'

export async function upsertSku(payload: Record<string, any>, id?: number) {
  await requireAuthenticatedUser()
  if (id) {
    const { error } = await supabaseAdmin.from('master_sku').update(payload).eq('id', id)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await supabaseAdmin.from('master_sku').insert(payload)
    if (error) throw new Error(error.message)
  }
}

export async function deleteSku(id: number) {
  await requireAuthenticatedUser()
  const { error } = await supabaseAdmin.from('master_sku').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
