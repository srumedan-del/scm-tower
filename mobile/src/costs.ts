import * as Print from 'expo-print'
import { File } from 'expo-file-system'
import { apiGet, type Driver } from './api'
import { getKv, setKv } from './db'
import type { Trip } from './trips'

/** Jenis biaya driver, sama dengan komponen form Shipment Cost di SCM Tower. */
export const EXPENSE_TYPES = ['TKBM / SPSI', 'Hotel', 'Tol', 'Makan Driver', 'Makan Helper', 'Parkir', 'Lainnya'] as const
export type ExpenseType = typeof EXPENSE_TYPES[number]

export type FuelLog = {
  id: number
  spbu_name_location: string | null
  fuel_type: string | null
  liters: number
  amount_rupiah: number
  odometer_after: number | null
  logged_at: string
}

export type ExpenseLog = {
  id: number
  expense_type: string
  amount_rupiah: number
  notes: string
  recorded_at: string
  pss_no: string | null
}

export type TripCosts = {
  trip: { trip_no: string; odometer_start: number | null; odometer_end: number | null; started_at: string | null; completed_at: string | null } | null
  shipments: { id: number; pss_no: string | null; customer_name: string | null; destination_city: string | null }[]
  fuel: FuelLog[]
  expenses: ExpenseLog[]
}

export function fetchTripCosts(tripNo: string) {
  return apiGet<TripCosts>(`costs?trip_id=${encodeURIComponent(tripNo)}`)
}

// ── Server cetak (aplikasi Cetak Foto BBM di PC kantor) ──────────────────────

const PRINT_SERVER_KEY = 'print_server_url'

export function getPrintServer() {
  return getKv<string>(PRINT_SERVER_KEY) ?? ''
}

export function setPrintServer(url: string) {
  setKv(PRINT_SERVER_KEY, normalizePrintServer(url))
}

/** "192.168.1.10" atau "192.168.1.10:3101" menjadi "http://192.168.1.10:3101". */
export function normalizePrintServer(input: string) {
  let url = input.trim().replace(/\/+$/, '')
  if (!url) return ''
  if (!/^https?:\/\//i.test(url)) url = `http://${url}`
  if (!/:\d+$/.test(url.replace(/^https?:\/\//i, ''))) url = `${url}:3101`
  return url
}

// ── Dokumen realisasi biaya ──────────────────────────────────────────────────

const rp = (value: number) => `Rp ${Math.round(value).toLocaleString('id-ID')}`
const escape = (value: unknown) => String(value ?? '').replace(/[&<>"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]!))
const dateTime = (value: string | null | undefined) => value
  ? new Date(value).toLocaleString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : '-'

export function costTotals(costs: TripCosts) {
  const fuel = costs.fuel.reduce((sum, row) => sum + row.amount_rupiah, 0)
  const liters = costs.fuel.reduce((sum, row) => sum + row.liters, 0)
  const byType = new Map<string, number>()
  for (const row of costs.expenses) byType.set(row.expense_type, (byType.get(row.expense_type) ?? 0) + row.amount_rupiah)
  const expenses = costs.expenses.reduce((sum, row) => sum + row.amount_rupiah, 0)
  return { fuel, liters, byType, expenses, total: fuel + expenses }
}

export function buildRealizationHtml(costs: TripCosts, trip: Trip, driver: Driver | null) {
  const totals = costTotals(costs)
  const vehicle = trip.vehicle?.vehicle_no ? [trip.vehicle.vehicle_no, trip.vehicle.vehicle_type].filter(Boolean).join(' · ') : '-'
  const kmStart = costs.trip?.odometer_start ?? trip.odometer_start
  const kmEnd = costs.trip?.odometer_end ?? null
  const fuelRows = costs.fuel.map((row, index) => `
    <tr><td>${index + 1}</td><td>${escape(dateTime(row.logged_at))}</td><td>${escape(row.spbu_name_location ?? 'SPBU')}<br><small>${escape(row.fuel_type ?? '')}${row.odometer_after ? ` · KM ${row.odometer_after.toLocaleString('id-ID')}` : ''}</small></td>
    <td class="r">${row.liters.toLocaleString('id-ID', { maximumFractionDigits: 2 })} L</td><td class="r">${rp(row.amount_rupiah)}</td></tr>`).join('')
  const expenseRows = costs.expenses.map((row, index) => `
    <tr><td>${index + 1}</td><td>${escape(dateTime(row.recorded_at))}</td><td>${escape(row.expense_type)}${row.pss_no ? ` · ${escape(row.pss_no)}` : ''}${row.notes ? `<br><small>${escape(row.notes)}</small>` : ''}</td>
    <td class="r">${rp(row.amount_rupiah)}</td></tr>`).join('')
  const summaryRows = [
    ['BBM', totals.fuel],
    ...[...totals.byType.entries()],
  ].map(([label, amount]) => `<tr><td>${escape(label)}</td><td class="r">${rp(Number(amount))}</td></tr>`).join('')

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: A4; margin: 14mm; }
    body { font-family: 'Segoe UI', Calibri, Arial, sans-serif; color: #1F1E1D; font-size: 11pt; }
    h1 { font-size: 16pt; margin: 0 0 2px; } h2 { font-size: 11.5pt; margin: 16px 0 6px; color: #8C4127; text-transform: uppercase; letter-spacing: .04em; }
    .muted { color: #5F5C54; font-size: 9.5pt; }
    table { width: 100%; border-collapse: collapse; } th, td { border: 1px solid #D9D6CC; padding: 5px 7px; vertical-align: top; text-align: left; }
    th { background: #F0EEE6; font-size: 9.5pt; } td.r, th.r { text-align: right; white-space: nowrap; } small { color: #5F5C54; }
    .info td { border: 0; padding: 2px 8px 2px 0; } .total td { font-weight: 700; background: #FAF9F5; }
    .sign { margin-top: 36px; display: flex; justify-content: space-between; } .sign div { width: 30%; text-align: center; } .sign .line { margin-top: 60px; border-top: 1px solid #1F1E1D; padding-top: 4px; }
  </style></head><body>
    <h1>Realisasi Biaya Perjalanan</h1>
    <div class="muted">SCM Tower · PT Sinar Roda Utama Medan · dicetak ${escape(dateTime(new Date().toISOString()))}</div>
    <table class="info" style="margin-top:12px"><tr><td>No. Trip</td><td><b>${escape(trip.trip_no)}</b></td><td>Driver</td><td><b>${escape(driver?.driver_name ?? '-')}</b></td></tr>
      <tr><td>Kendaraan</td><td>${escape(vehicle)}</td><td>KM awal / akhir</td><td>${kmStart != null ? kmStart.toLocaleString('id-ID') : '-'} / ${kmEnd != null ? kmEnd.toLocaleString('id-ID') : '-'}</td></tr>
      <tr><td>Tujuan</td><td colspan="3">${escape(costs.shipments.map(row => `${row.pss_no ?? ''} ${row.customer_name ?? ''}`.trim()).join('; ') || '-')}</td></tr></table>
    <h2>Pengisian BBM (${costs.fuel.length}x · ${totals.liters.toLocaleString('id-ID', { maximumFractionDigits: 2 })} liter)</h2>
    ${costs.fuel.length ? `<table><tr><th>#</th><th>Waktu</th><th>SPBU</th><th class="r">Liter</th><th class="r">Nominal</th></tr>${fuelRows}</table>` : '<p class="muted">Tidak ada pengisian BBM.</p>'}
    <h2>Biaya perjalanan (${costs.expenses.length})</h2>
    ${costs.expenses.length ? `<table><tr><th>#</th><th>Waktu</th><th>Jenis</th><th class="r">Nominal</th></tr>${expenseRows}</table>` : '<p class="muted">Tidak ada biaya lain.</p>'}
    <h2>Ringkasan</h2>
    <table>${summaryRows}<tr class="total"><td>Total realisasi</td><td class="r">${rp(totals.total)}</td></tr></table>
    <div class="sign"><div>Driver<div class="line">${escape(driver?.driver_name ?? '')}</div></div><div>Diperiksa<div class="line">&nbsp;</div></div><div>Disetujui<div class="line">&nbsp;</div></div></div>
  </body></html>`
}

export type PrintResult = { via: 'server' | 'dialog'; message: string }

/** Kirim ke server cetak kantor; bila tidak terjangkau, buka dialog cetak Android. */
export async function printRealization(html: string): Promise<PrintResult> {
  const { uri } = await Print.printToFileAsync({ html, base64: false })
  const server = getPrintServer()
  if (server) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 20_000)
    try {
      const form = new FormData()
      form.append('document', new File(uri) as unknown as Blob, 'realisasi-biaya.pdf')
      const response = await fetch(`${server}/api/print-document`, { method: 'POST', body: form, signal: controller.signal })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error ?? 'Server cetak menolak dokumen')
      return { via: 'server', message: body.message ?? 'Dokumen dikirim ke printer kantor' }
    } catch (error) {
      const reason = error instanceof Error && error.name !== 'AbortError' ? error.message : 'Server cetak tidak terjangkau'
      await Print.printAsync({ uri })
      return { via: 'dialog', message: `${reason}. Dicetak lewat dialog cetak HP.` }
    } finally {
      clearTimeout(timer)
    }
  }
  await Print.printAsync({ uri })
  return { via: 'dialog', message: 'Dicetak lewat dialog cetak HP.' }
}
