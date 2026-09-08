'use server'

import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function upsertRateCard(payload: Record<string, any>, id?: number) {
  if (id) {
    const { error } = await supabaseAdmin.from('transport_rate_card').update(payload).eq('id', id)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await supabaseAdmin.from('transport_rate_card').insert(payload)
    if (error) throw new Error(error.message)
  }
}

export async function deleteRateCard(id: number) {
  const { error } = await supabaseAdmin.from('transport_rate_card').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
