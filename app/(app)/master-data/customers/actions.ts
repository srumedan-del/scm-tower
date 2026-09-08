'use server'

import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function upsertCustomer(payload: Record<string, any>, id?: number) {
  if (id) {
    const { error } = await supabaseAdmin.from('customers').update(payload).eq('id', id)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await supabaseAdmin.from('customers').insert(payload)
    if (error) throw new Error(error.message)
  }
}

export async function deleteCustomer(id: number) {
  const { error } = await supabaseAdmin.from('customers').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
