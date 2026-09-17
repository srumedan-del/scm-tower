'use server'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireAuthenticatedUser } from '@/lib/requireUser'

export type RoutePayload = {
  route_code: string
  origin: string
  destination: string
  city: string | null
  standard_lead_time_hours: number | null
  distance_km: number | null
  dk_lk: 'D' | 'L' | null
  notes: string | null
}

const normalizeRoutePlace = (value: string) => value.trim().replace(/\s+/g, ' ').toUpperCase()

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
  await requireAuthenticatedUser()
  const origin = normalizeRoutePlace(payload.origin)
  const destination = normalizeRoutePlace(payload.destination)

  if (!origin || !destination) throw new Error('Origin dan destination wajib diisi.')

  // The database trigger below is the final safeguard; this check gives the user
  // a clear message before attempting the write.
  const { data: existing, error: lookupError } = await supabaseAdmin
    .from('routes')
    .select('id, route_code, origin, destination')
    .limit(2000)
  if (lookupError) throw new Error(lookupError.message)

  const duplicate = (existing ?? []).find(route =>
    route.id !== id &&
    normalizeRoutePlace(String(route.origin ?? '')) === origin &&
    normalizeRoutePlace(String(route.destination ?? '')) === destination
  )
  if (duplicate) {
    throw new Error(`Rute ${origin} → ${destination} sudah terdaftar (${duplicate.route_code}).`)
  }

  const normalizedPayload = { ...payload, origin, destination, city: destination }
  if (id) {
    const { error } = await supabaseAdmin.from('routes').update(normalizedPayload).eq('id', id)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await supabaseAdmin.from('routes').insert(normalizedPayload)
    if (error) throw new Error(error.message)
  }
}

export async function deleteRoute(id: number) {
  await requireAuthenticatedUser()
  await supabaseAdmin.from('shipment_tracking').update({ route_id: null }).eq('route_id', id)
  const { error } = await supabaseAdmin.from('routes').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
