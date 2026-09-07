'use server'

import { supabaseAdmin } from '@/lib/supabaseAdmin'

export type RoutePayload = {
  route_code: string
  origin: string
  destination: string
  city: string | null
  standard_lead_time_hours: number | null
  dk_lk: 'D' | 'L' | null
  notes: string | null
}

/**
 * Auto-generate route code format MDN-L-0001 (Luar Kota) atau MDN-D-0001 (Dalam Kota).
 * Nomor urut per kategori DK/LK, numerik (tidak terpengaruh lexicographic sort).
 */
export async function generateRouteCode(dkLk: 'D' | 'L'): Promise<string> {
  const prefix = `MDN-${dkLk}-`

  const { data } = await supabaseAdmin
    .from('routes')
    .select('route_code')
    .like('route_code', `${prefix}%`)
    .not('route_code', 'is', null)

  let maxNum = 0
  for (const row of data ?? []) {
    const parts = (row.route_code as string).split('-')
    const n = parseInt(parts.at(-1) ?? '0', 10)
    if (!isNaN(n) && n > maxNum) maxNum = n
  }
  return `${prefix}${String(maxNum + 1).padStart(4, '0')}`
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
  await supabaseAdmin.from('shipment_tracking').update({ route_id: null }).eq('route_id', id)
  const { error } = await supabaseAdmin.from('routes').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
