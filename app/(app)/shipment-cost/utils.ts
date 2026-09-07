import type { ShipmentCostRow } from './actions'

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
  const byDkLk:  Record<string, { count: number; total: number }> = {}
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
