import type { ShipmentCostRow } from './actions'

export type CostSummary = {
  totalShipment: number
  totalBiaya: number
  totalInvoiceValue: number
  avgCostRatio: number | null
  byVendor: Record<string, { count: number; total: number }>
  byDkLk: Record<string, { count: number; total: number }>
}

export function computeCostSummary(rows: ShipmentCostRow[]): CostSummary {
  const byVendor: Record<string, { count: number; total: number }> = {}
  const byDkLk:  Record<string, { count: number; total: number }> = {}
  let totalBiaya = 0
  let totalInvoiceValue = 0
  let ratioCount = 0
  let ratioSum = 0

  for (const r of rows) {
    const biaya = r.total_biaya ?? 0
    totalBiaya += biaya
    if (r.cost_model !== 'Internal' && r.invoice_value) totalInvoiceValue += r.invoice_value
    if (r.cost_ratio != null) { ratioSum += r.cost_ratio; ratioCount++ }

    const notesVendor = r.notes?.match(/(?:^|\|\s*)Vendor:\s*([^|]+)/i)?.[1]?.trim()
    const vendor = r.transporter_name?.trim() || notesVendor || 'Vendor belum ditentukan'
    if (!byVendor[vendor]) byVendor[vendor] = { count: 0, total: 0 }
    byVendor[vendor].count++
    byVendor[vendor].total += biaya

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
    byVendor,
    byDkLk,
  }
}

/** Pencarian toolbar Shipment Cost: Trip, PSS/CD, customer, kota, vendor. */
export function matchesCostSearch(r: ShipmentCostRow, search: string) {
  const q = search.trim().toLowerCase()
  if (!q) return true
  const pss = r.pss_no ?? (r.crossdocking_id ? `cd-${r.crossdocking_id}` : '')
  return [r.trip_id, pss, r.customer_name, r.destination_city, r.transporter_name]
    .some((v) => (v ?? '').toLowerCase().includes(q))
}
