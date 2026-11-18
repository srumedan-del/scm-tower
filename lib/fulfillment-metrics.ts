import type { SupabaseClient } from '@supabase/supabase-js'
import { addWorkingDaysAt } from '@/lib/sla'
import { parseWib, wibToday } from '@/lib/wib-time'
import { inferDkLk } from '@/lib/dklk-rule'
import { getChargeOnlyPss } from '@/lib/charge-only-pss'

/**
 * Metrik fulfillment Dashboard (lihat docs/dashboard-spec.md, skill supply-chain-order-fulfillment-dashboard).
 * Grain: satu PSS/CD (setara "order line"). Acuan tepat waktu = jatuh tempo SLA: DK 1 / LK 5 hari kerja
 * dari jam dokumen dibuat (Sabtu-Minggu libur). "In full" = terkirim tanpa Failed Delivery, karena SCM Tower
 * tidak mencatat kirim sebagian. PSS lewat jatuh tempo yang belum terkirim dihitung gagal.
 */

export const OTIF_TARGET = 95

type Row = {
  id: number
  source_type: string | null
  pss_no: string | null
  crossdocking_id: number | null
  customer_code: string | null
  customer_name: string | null
  destination_city: string | null
  dk_lk: string | null
  document_date: string | null
  status: string
  delivery_time: string | null
  transporter_name: string | null
  cost_model: string | null
  total_biaya: number | null
}

export type FulfillmentItem = {
  key: string
  ref: string
  customer: string | null
  city: string | null
  dkLk: 'DK' | 'LK'
  transporter: string
  createdAt: Date
  dueAt: Date
  deliveredAt: Date | null
  failedAttempt: boolean
  status: string
  cost: number
}

export type FulfillmentSummary = {
  measurable: number
  otifCount: number
  onTimeCount: number
  successCount: number
  otif: number | null
  onTime: number | null
  success: number | null
  cycleDays: number | null
  costPerPss: number | null
  costedCount: number
  failures: { late: number; failed: number; overdueOpen: number }
}

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : null)

function median(values: number[]) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function transporterOf(row: Row) {
  const name = row.transporter_name?.trim()
  if (name) return name
  return row.cost_model === 'Internal' ? 'SRU MEDAN' : 'Lainnya'
}

/** PSS/CD dengan dokumen di rentang [from, to), sudah digabung per dokumen (percobaan gagal + kirim ulang). */
export async function loadFulfillmentItems(db: SupabaseClient<any>, from: string, to: string): Promise<FulfillmentItem[]> {
  const { data, error } = await db
    .from('vw_shipment_tms')
    .select('id, source_type, pss_no, crossdocking_id, customer_code, customer_name, destination_city, dk_lk, document_date, status, delivery_time, transporter_name, cost_model, total_biaya')
    .gte('document_date', from)
    .lt('document_date', to)
    .neq('status', 'Closed')
    .limit(3000)
  if (error) throw error
  const rows = (data ?? []) as Row[]

  const pssNos = [...new Set(rows.map(r => r.pss_no?.trim()).filter(Boolean))] as string[]
  const codes = [...new Set(rows.map(r => r.customer_code).filter(Boolean))] as string[]
  const [chargeOnly, headers, customers] = await Promise.all([
    getChargeOnlyPss(db, pssNos),
    pssNos.length ? db.from('outbound_header').select('pss_no, document_created_at').in('pss_no', pssNos) : Promise.resolve({ data: [] as any[] }),
    codes.length ? db.from('customers').select('customer_code, dk_lk').in('customer_code', codes) : Promise.resolve({ data: [] as any[] }),
  ])
  const createdByPss = new Map<string, string | null>(((headers as any).data ?? []).map((h: any) => [String(h.pss_no).trim(), h.document_created_at as string | null]))
  const dkLkByCode = new Map<string, string | null>(((customers as any).data ?? []).map((c: any) => [String(c.customer_code), c.dk_lk as string | null]))

  const byKey = new Map<string, Row[]>()
  for (const row of rows) {
    const key = row.pss_no?.trim() ? `PSS:${row.pss_no.trim()}` : row.crossdocking_id != null ? `CD:${row.crossdocking_id}` : `ID:${row.id}`
    if (row.pss_no && chargeOnly.has(row.pss_no.trim())) continue
    byKey.set(key, [...(byKey.get(key) ?? []), row])
  }

  const items: FulfillmentItem[] = []
  for (const [key, group] of byKey) {
    // Baris utama: yang terkirim, selain itu yang terbaru (kirim ulang setelah gagal).
    const main = group.find(r => r.status === 'Delivered') ?? [...group].sort((a, b) => b.id - a.id)[0]
    const pss = main.pss_no?.trim() ?? null
    const created = parseWib((pss && createdByPss.get(pss)) || main.document_date)
    if (!created) continue
    const label = (main.customer_code && dkLkByCode.get(main.customer_code)) || main.dk_lk || inferDkLk(main.destination_city) || 'LK'
    const dkLk = label === 'DK' ? 'DK' : 'LK'
    items.push({
      key,
      ref: pss ?? (main.crossdocking_id != null ? `CD-${main.crossdocking_id}` : `#${main.id}`),
      customer: main.customer_name,
      city: main.destination_city,
      dkLk,
      transporter: transporterOf(main),
      createdAt: created,
      dueAt: addWorkingDaysAt(created, dkLk === 'DK' ? 1 : 5),
      deliveredAt: main.status === 'Delivered' && main.delivery_time ? new Date(main.delivery_time) : null,
      failedAttempt: group.some(r => r.status === 'Failed Delivery'),
      status: main.status,
      cost: group.reduce((sum, r) => sum + (Number(r.total_biaya) || 0), 0),
    })
  }
  return items
}

/** Ringkasan KPI untuk sekumpulan PSS. `now` menentukan PSS terbuka yang sudah lewat jatuh tempo. */
export function summarize(items: FulfillmentItem[], now = new Date()): FulfillmentSummary {
  // Terukur: sudah terkirim, gagal kirim, atau jatuh tempo sudah lewat.
  const measurable = items.filter(i => i.deliveredAt || i.status === 'Failed Delivery' || i.dueAt < now)
  const onTime = measurable.filter(i => i.deliveredAt && i.deliveredAt <= i.dueAt)
  const success = measurable.filter(i => i.deliveredAt && !i.failedAttempt)
  const otif = measurable.filter(i => i.deliveredAt && i.deliveredAt <= i.dueAt && !i.failedAttempt)
  const delivered = items.filter(i => i.deliveredAt)
  const costed = delivered.filter(i => i.cost > 0)
  return {
    measurable: measurable.length,
    otifCount: otif.length,
    onTimeCount: onTime.length,
    successCount: success.length,
    otif: pct(otif.length, measurable.length),
    onTime: pct(onTime.length, measurable.length),
    success: pct(success.length, measurable.length),
    cycleDays: median(delivered.map(i => (i.deliveredAt!.getTime() - i.createdAt.getTime()) / 86_400_000)),
    costPerPss: costed.length ? Math.round(costed.reduce((s, i) => s + i.cost, 0) / costed.length) : null,
    costedCount: costed.length,
    failures: {
      late: measurable.filter(i => i.deliveredAt && i.deliveredAt > i.dueAt && !i.failedAttempt).length,
      failed: measurable.filter(i => i.failedAttempt).length,
      overdueOpen: measurable.filter(i => !i.deliveredAt && i.status !== 'Failed Delivery').length,
    },
  }
}

/** Awal minggu (Senin) WIB untuk sebuah waktu, "YYYY-MM-DD". */
function weekStart(at: Date) {
  const day = wibToday(at)
  const date = new Date(`${day}T00:00:00Z`)
  const offset = (date.getUTCDay() + 6) % 7
  return new Date(date.getTime() - offset * 86_400_000).toISOString().slice(0, 10)
}

export type WeekPoint = { week: string; label: string; otif: number | null; onTime: number | null; count: number }

/** Tren mingguan (berdasarkan minggu dokumen dibuat). */
export function weeklyTrend(items: FulfillmentItem[], now = new Date()): WeekPoint[] {
  const groups = new Map<string, FulfillmentItem[]>()
  for (const item of items) {
    const week = weekStart(item.createdAt)
    groups.set(week, [...(groups.get(week) ?? []), item])
  }
  return [...groups.keys()].sort().slice(-13).map(week => {
    const s = summarize(groups.get(week)!, now)
    const [, m, d] = week.split('-')
    return { week, label: `${d}/${m}`, otif: s.otif, onTime: s.onTime, count: s.measurable }
  })
}

export type TransporterPoint = { name: string; otif: number | null; count: number }

export function byTransporter(items: FulfillmentItem[], now = new Date()): TransporterPoint[] {
  const groups = new Map<string, FulfillmentItem[]>()
  for (const item of items) groups.set(item.transporter, [...(groups.get(item.transporter) ?? []), item])
  return [...groups.entries()]
    .map(([name, list]) => { const s = summarize(list, now); return { name, otif: s.otif, count: s.measurable } })
    .filter(t => t.count > 0)
    .sort((a, b) => (b.otif ?? -1) - (a.otif ?? -1) || b.count - a.count)
    .slice(0, 10)
}
