'use server'

import { supabaseAdmin } from '@/lib/supabaseAdmin'

export type RateCardRouteOption = {
  id: number
  route_code: string
  origin: string
  destination: string
}

export async function getRateCardRoutes() {
  const { data, error } = await supabaseAdmin
    .from('routes')
    .select('id, route_code, origin, destination')
    .order('route_code')
    .limit(500)
  if (error) throw new Error(error.message)
  return (data ?? []) as RateCardRouteOption[]
}

export async function upsertRateCard(payload: Record<string, any>, id?: number) {
  const save = (data: Record<string, any>) => id
    ? supabaseAdmin.from('transport_rate_card').update(data).eq('id', id)
    : supabaseAdmin.from('transport_rate_card').insert(data)

  const result = await save(payload)
  if (!result.error) return

  // Keep the UI usable before migration_v26 has been applied to Supabase.
  // The route is still retained in origin/destination for legacy rate cards.
  if (payload.route_id !== undefined && /route_id.*schema cache|column.*route_id/i.test(result.error.message)) {
    const legacyPayload = { ...payload }
    delete legacyPayload.route_id
    const fallback = await save(legacyPayload)
    if (!fallback.error) return
    throw new Error(fallback.error.message)
  }

  throw new Error(result.error.message)
}

export async function deleteRateCard(id: number) {
  const { error } = await supabaseAdmin.from('transport_rate_card').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
