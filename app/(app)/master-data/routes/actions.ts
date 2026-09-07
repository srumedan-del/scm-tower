'use server'

import { supabaseAdmin } from '@/lib/supabaseAdmin'

export type RoutePayload = {
  route_code: string
  origin: string
  destination: string
  city: string | null           // diisi sama dengan destination untuk kompatibilitas kolom DB
  standard_lead_time_hours: number | null
  notes: string | null
}

export async function upsertRoute(payload: RoutePayload, id?: number) {
  if (id) {
    const { error } = await supabaseAdmin.from('routes').update(payload).eq('id', id)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await supabaseAdmin.from('routes').insert(payload)
    if (error) throw new Error(error.message)
  }
}

export async function deleteRoute(id: number) {
  // Null-kan FK di shipment_tracking sebelum hapus
  await supabaseAdmin.from('shipment_tracking').update({ route_id: null }).eq('route_id', id)
  const { error } = await supabaseAdmin.from('routes').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
