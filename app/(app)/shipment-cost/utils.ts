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

/**
 * Shipment vendor eksternal yang belum punya biaya. PSS lain dalam trip yang sama yang sudah
 * berbiaya dianggap menanggung biaya trip, jadi tidak ditanyakan lagi.
 */
export function externalRowsWithoutCost(rows: ShipmentCostRow[]) {
  const tripsWithCost = new Set(rows.filter((r) => r.trip_id && Number(r.total_biaya ?? 0) > 0).map((r) => r.trip_id))
  return rows.filter((r) =>
    r.cost_model !== 'Internal' && !(Number(r.total_biaya ?? 0) > 0) && !(r.trip_id && tripsWithCost.has(r.trip_id)))
}

/** Crossdocking = pengiriman tujuan Riau & Sumatera Barat lewat crossdock. */
export const isCrossdocking = (row: Pick<ShipmentCostRow, 'source_type' | 'crossdocking_id'>) =>
  row.source_type === 'Crossdocking' || row.crossdocking_id != null
