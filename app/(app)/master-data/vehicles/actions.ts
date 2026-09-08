'use server'

import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function upsertFleet(payload: Record<string, any>, id?: number) {
  if (id) {
    const { error } = await supabaseAdmin.from('transport_fleet').update(payload).eq('id', id)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await supabaseAdmin.from('transport_fleet').insert(payload)
    if (error) throw new Error(error.message)
  }
}

export async function deleteFleet(id: number) {
  // Null-kan FK di shipment_tracking sebelum hapus
  await supabaseAdmin.from('shipment_tracking').update({ vehicle_id: null }).eq('vehicle_id', id)
  const { error } = await supabaseAdmin.from('transport_fleet').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
