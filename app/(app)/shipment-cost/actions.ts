'use server'

import { supabaseAdmin } from '@/lib/supabaseAdmin'

export type ShipmentCostRow = {
  id: number
  source_type: string
  pss_no: string | null
  crossdocking_id: number | null
  trip_id: string | null
  customer_name: string | null
  destination_city: string | null
  dk_lk: string | null
  document_date: string | null
  promised_delivery_date: string | null
  status: string
  dispatch_time: string | null
  delivery_time: string | null
  is_on_time: boolean | null
  cost_model: string | null
  // Internal
  payment_voucher_no: string | null
  bbm_liter: number | null
  bbm_rupiah: number | null
  bongkar_muat_cost: number | null
  hotel_cost: number | null
  uang_makan_driver: number | null
  uang_makan_helper: number | null
  toll_cost: number | null
  parkir_cost: number | null
  kirim_paket_cost: number | null
  // Eksternal
  invoice_no_eksternal: string | null
  total_biaya_eksternal: number | null
  // Summary
  invoice_value: number | null
  total_biaya: number | null
  cost_ratio: number | null
  // Joined (dari notes jika vendor eksternal)
  transporter_name: string | null
  notes: string | null
}

export async function getShipmentCosts(filters?: {
  status?: string
  cost_model?: string
  dk_lk?: string
  from_date?: string
  to_date?: string
}): Promise<ShipmentCostRow[]> {
  let q = supabaseAdmin
    .from('vw_shipment_tms')
    .select(`
      id, source_type, pss_no, crossdocking_id, trip_id,
      customer_name, destination_city, dk_lk,
      document_date, promised_delivery_date, status,
      dispatch_time, delivery_time, is_on_time,
      cost_model, payment_voucher_no,
      bbm_liter, bbm_rupiah, bongkar_muat_cost, hotel_cost,
      uang_makan_driver, uang_makan_helper, toll_cost, parkir_cost, kirim_paket_cost,
      invoice_no_eksternal, total_biaya_eksternal,
      invoice_value, total_biaya, cost_ratio,
      transporter_name, notes
    `)
    .order('document_date', { ascending: false })
    .order('trip_id', { ascending: true })
    .limit(500)

  if (filters?.status && filters.status !== 'all') q = q.eq('status', filters.status)
  if (filters?.cost_model && filters.cost_model !== 'all') q = q.eq('cost_model', filters.cost_model)
  if (filters?.dk_lk && filters.dk_lk !== 'all') q = q.eq('dk_lk', filters.dk_lk)
  if (filters?.from_date) q = q.gte('document_date', filters.from_date)
  if (filters?.to_date) q = q.lte('document_date', filters.to_date)

  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as ShipmentCostRow[]
}

export type CostSummary = {
  totalShipment: number
  totalBiaya: number
  totalInvoiceValue: number
  avgCostRatio: number | null
  byModel: Record<string, { count: number; total: number }>
  byDkLk: Record<string, { count: number; total: number }>
}

export function computeCostSummary(rows: ShipmentCostRow[]): CostSummary {
  const byModel: Record<string, { count: number; total: number }> = {}
  const byDkLk: Record<string, { count: number; total: number }> = {}
  let totalBiaya = 0
  let totalInvoiceValue = 0
  let ratioCount = 0
  let ratioSum = 0

  for (const r of rows) {
    const biaya = r.total_biaya ?? 0
    totalBiaya += biaya
    if (r.invoice_value) totalInvoiceValue += r.invoice_value
    if (r.cost_ratio != null) { ratioSum += r.cost_ratio; ratioCount++ }

    const model = r.cost_model ?? 'Belum diisi'
    if (!byModel[model]) byModel[model] = { count: 0, total: 0 }
    byModel[model].count++
    byModel[model].total += biaya

    const dk = r.dk_lk ?? '-'
    if (!byDkLk[dk]) byDkLk[dk] = { count: 0, total: 0 }
    byDkLk[dk].count++
    byDkLk[dk].total += biaya
  }

  return {
    totalShipment: rows.length,
    totalBiaya,
    totalInvoiceValue,
    avgCostRatio: ratioCount > 0 ? Math.round((ratioSum / ratioCount) * 10) / 10 : null,
    byModel,
    byDkLk,
  }
}
