import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Biaya tingkat trip (BBM, hotel, tol, uang makan) dicatat sekali per trip di satu PSS "pembawa".
 * Parkir dan TKBM tetap per PSS karena dibayar di tiap titik antar.
 */
export const TRIP_COST_FIELDS = ['bbm_liter', 'bbm_rupiah', 'hotel_cost', 'uang_makan_driver', 'uang_makan_helper', 'toll_cost'] as const

type CostRow = { id: number } & Partial<Record<(typeof TRIP_COST_FIELDS)[number], number | string | null>>

/** PSS pembawa: yang sudah memegang biaya trip (data lama), selain itu PSS pertama trip (id terkecil). */
export function pickTripCostAnchor<T extends CostRow>(rowsById: T[]): T | null {
  const sorted = [...rowsById].sort((a, b) => Number(a.id) - Number(b.id))
  return sorted.find((row) => TRIP_COST_FIELDS.some((field) => Number(row[field]) > 0)) ?? sorted[0] ?? null
}

export async function tripCostAnchorId(db: SupabaseClient<any>, tripNo: string): Promise<number | null> {
  const { data, error } = await db.from('shipment_tracking').select(`id, ${TRIP_COST_FIELDS.join(', ')}`).eq('trip_id', tripNo).order('id')
  if (error) throw error
  const anchor = pickTripCostAnchor((data ?? []) as unknown as CostRow[])
  return anchor ? Number(anchor.id) : null
}
