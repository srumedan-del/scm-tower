'use server'

import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function upsertWarehouse(payload: Record<string, any>, id?: number) {
  if (id) {
    const { error } = await supabaseAdmin.from('warehouses').update(payload).eq('id', id)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await supabaseAdmin.from('warehouses').insert(payload)
    if (error) throw new Error(error.message)
  }
}

export async function deleteWarehouse(id: number) {
  const { error } = await supabaseAdmin.from('warehouses').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
