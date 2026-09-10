'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { AlertTriangle, BarChart3, CheckCircle2, Clock3, Filter, PackageCheck, Truck } from 'lucide-react'
import { getServiceLevelShipments, type ServiceLevelShipmentRow } from '@/app/(app)/shipment/actions'

type GroupRow = {
  name: string
  total: number
  delivered: number
  onTime: number
  late: number
  open: number
}

const STATUS_ORDER = ['Draft', 'Dispatched', 'In Transit', 'Delivered'] as const

function currentMonth(offset = 0) {
  const now = new Date()
  const date = new Date(now.getFullYear(), now.getMonth() + offset, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function rangeForMonth(month: string) {
  const [year, monthNumber] = month.split('-').map(Number)
  const lastDay = new Date(year, monthNumber, 0).getDate()
  return { start: `${month}-01`, end: `${month}-${String(lastDay).padStart(2, '0')}` }
}

function vendorName(row: ServiceLevelShipmentRow) {
  if (row.transporter_name) return row.transporter_name
  const match = row.notes?.match(/(?:^|\|\s*)Vendor:\s*([^|]+)/i)
  return match?.[1].trim() || 'Belum tercatat'
}

function slaHours(row: ServiceLevelShipmentRow) {
  return row.dk_lk === 'DK' ? 24 : 72
}

function slaDueAt(row: ServiceLevelShipmentRow) {
  if (!row.document_created_at) return null
  const documentCreatedAt = new Date(row.document_created_at)
  if (Number.isNaN(documentCreatedAt.getTime())) return null
  return new Date(documentCreatedAt.getTime() + slaHours(row) * 60 * 60 * 1000)
}

function isOnTime(row: ServiceLevelShipmentRow) {
  const dueAt = slaDueAt(row)
  if (!row.delivery_time || !dueAt) return false
  const deliveryAt = new Date(row.delivery_time)
  return !Number.isNaN(deliveryAt.getTime()) && deliveryAt <= dueAt
}

function needsAttention(row: ServiceLevelShipmentRow, now = new Date()) {
  const dueAt = slaDueAt(row)
  if (!dueAt) return false
  if (row.status === 'Delivered') return !isOnTime(row)
  return now > dueAt
}

function formatDateTime(value: Date | null) {
  if (!value) return 'Timestamp belum tersedia'
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(value)
}

function groupRows(rows: ServiceLevelShipmentRow[], key: (row: ServiceLevelShipmentRow) => string): GroupRow[] {
  const grouped = new Map<string, GroupRow>()
  for (const row of rows) {
    const name = key(row) || 'Belum tercatat'
    const item = grouped.get(name) ?? { name, total: 0, delivered: 0, onTime: 0, late: 0, open: 0 }
    item.total += 1
    if (row.status === 'Delivered') {
      item.delivered += 1
      if (isOnTime(row)) item.onTime += 1
      else item.late += 1
    } else item.open += 1
    grouped.set(name, item)
  }
  return [...grouped.values()].sort((a, b) => b.total - a.total)
}

function pct(value: number, total: number) {
  return total ? Math.round((value / total) * 100) : 0
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    Draft: 'bg-gray-100 text-gray-600',
    Dispatched: 'bg-blue-100 text-blue-700',
    'In Transit': 'bg-amber-100 text-amber-700',
    Delivered: 'bg-green-100 text-green-700',
  }
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${colors[status] ?? 'bg-gray-100 text-gray-600'}`}>{status}</span>
}

function PerformanceTable({ title, rows }: { title: string; rows: GroupRow[] }) {
  return (
    <section className="rounded-xl border border-border bg-white overflow-hidden">
      <div className="border-b px-4 py-3">
        <h2 className="font-semibold text-gray-800">{title}</h2>
        <p className="text-xs text-gray-500 mt-0.5">OTD dihitung dari shipment yang sudah Delivered.</p>
      </div>
      <div className="max-h-80 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-2.5 text-left">Nama</th>
              <th className="px-3 py-2.5 text-center">Total</th>
              <th className="px-3 py-2.5 text-center">Selesai</th>
              <th className="px-3 py-2.5 text-center">OTD</th>
              <th className="px-4 py-2.5 text-center">Tertunda</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.length === 0 ? <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Belum ada data pada filter ini.</td></tr> : rows.map(row => (
              <tr key={row.name}>
                <td className="max-w-48 truncate px-4 py-3 font-medium text-gray-700" title={row.name}>{row.name}</td>
                <td className="px-3 py-3 text-center">{row.total}</td>
                <td className="px-3 py-3 text-center text-green-700">{row.delivered}</td>
                <td className={`px-3 py-3 text-center font-semibold ${pct(row.onTime, row.delivered) >= 95 ? 'text-green-700' : 'text-amber-700'}`}>
                  {row.delivered ? `${pct(row.onTime, row.delivered)}%` : '-'}
                </td>
                <td className="px-4 py-3 text-center text-amber-700">{row.open}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default function ServiceLevelPage() {
  const [period, setPeriod] = useState(currentMonth())
  const [rows, setRows] = useState<ServiceLevelShipmentRow[]>([])
  const [customer, setCustomer] = useState('all')
  const [vendor, setVendor] = useState('all')
  const [loading, startLoading] = useTransition()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const { start, end } = rangeForMonth(period)
    startLoading(async () => {
      setError(null)
      try {
        setRows(await getServiceLevelShipments(start, end))
      } catch (err: any) {
        setError(err.message ?? 'Laporan service level tidak dapat dimuat.')
      }
    })
  }, [period])

  const customers = useMemo(() => [...new Set(rows.map(row => row.customer_name || 'Belum tercatat'))].sort(), [rows])
  const vendors = useMemo(() => [...new Set(rows.map(vendorName))].sort(), [rows])
  const filtered = useMemo(() => rows.filter(row =>
    (customer === 'all' || (row.customer_name || 'Belum tercatat') === customer) &&
    (vendor === 'all' || vendorName(row) === vendor)
  ), [rows, customer, vendor])

  const statusCounts = useMemo(() => Object.fromEntries(STATUS_ORDER.map(status => [status, filtered.filter(row => row.status === status).length])), [filtered]) as Record<string, number>
  const delivered = statusCounts.Delivered ?? 0
  const onTime = filtered.filter(row => row.status === 'Delivered' && isOnTime(row)).length
  const late = filtered.filter(row => row.status === 'Delivered' && slaDueAt(row) && !isOnTime(row)).length
  const open = filtered.length - delivered
  const customerRows = useMemo(() => groupRows(filtered, row => row.customer_name || 'Belum tercatat'), [filtered])
  const vendorRows = useMemo(() => groupRows(filtered, vendorName), [filtered])
  const attentionRows = useMemo(() => filtered
    .filter(row => needsAttention(row))
    .slice(0, 8), [filtered])
  const overdue = attentionRows.filter(row => row.status !== 'Delivered').length

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">SERVICE LEVEL</h1>
          <p className="mt-1 text-sm text-gray-500">Laporan kualitas pengiriman untuk evaluasi customer dan vendor.</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500"><Clock3 className="h-4 w-4" /> Berdasarkan Document Date</div>
      </header>

      <section className="rounded-xl border border-border bg-white p-4">
        <div className="flex items-end gap-3 flex-wrap">
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-gray-600">PERIODE</span>
            <input type="month" value={period} onChange={e => setPeriod(e.target.value)} className="inp" />
          </label>
          <button onClick={() => setPeriod(currentMonth())} className="btn-secondary">Bulan berjalan</button>
          <button onClick={() => setPeriod(currentMonth(-1))} className="btn-secondary">Bulan lalu</button>
          <div className="w-px self-stretch bg-gray-200 mx-1" />
          <label className="block min-w-48">
            <span className="mb-1 flex items-center gap-1 text-xs font-bold text-gray-600"><Filter className="h-3 w-3" /> CUSTOMER</span>
            <select value={customer} onChange={e => setCustomer(e.target.value)} className="inp">
              <option value="all">Semua customer</option>
              {customers.map(name => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
          <label className="block min-w-48">
            <span className="mb-1 flex items-center gap-1 text-xs font-bold text-gray-600"><Filter className="h-3 w-3" /> VENDOR</span>
            <select value={vendor} onChange={e => setVendor(e.target.value)} className="inp">
              <option value="all">Semua vendor</option>
              {vendors.map(name => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
        </div>
      </section>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi icon={<Truck />} label="Total Shipment" value={filtered.length} detail="Dalam periode terpilih" color="blue" />
        <Kpi icon={<PackageCheck />} label="Completion Rate" value={`${pct(delivered, filtered.length)}%`} detail={`${delivered} shipment selesai`} color="green" />
        <Kpi icon={<CheckCircle2 />} label="On-Time Delivery" value={delivered ? `${pct(onTime, delivered)}%` : '-'} detail={`${onTime} tepat waktu dari ${delivered} selesai`} color="emerald" />
        <Kpi icon={<AlertTriangle />} label="Butuh Perhatian" value={open + late} detail={`${open} masih berjalan · ${late} terlambat`} color="amber" />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
        <div className="rounded-xl border border-border bg-white p-4">
          <div className="mb-4 flex items-center gap-2"><BarChart3 className="h-5 w-5 text-indigo-600" /><h2 className="font-semibold">Status Pengiriman</h2></div>
          <div className="space-y-4">
            {STATUS_ORDER.map(status => {
              const count = statusCounts[status] ?? 0
              const color = status === 'Delivered' ? 'bg-green-500' : status === 'Dispatched' ? 'bg-blue-500' : status === 'In Transit' ? 'bg-amber-500' : 'bg-gray-400'
              return <div key={status}>
                <div className="mb-1 flex justify-between text-sm"><StatusBadge status={status} /><span className="font-semibold text-gray-700">{count} · {pct(count, filtered.length)}%</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-gray-100"><div className={`h-full rounded-full ${color}`} style={{ width: `${pct(count, filtered.length)}%` }} /></div>
              </div>
            })}
          </div>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h2 className="font-semibold text-amber-900">Fokus Manajemen</h2>
          <ul className="mt-3 space-y-3 text-sm text-amber-900">
            <li><strong>{open}</strong> shipment belum selesai dan perlu follow-up operasional.</li>
            <li><strong>{late}</strong> delivery selesai melewati promised date; gunakan tabel customer/vendor untuk akar masalah.</li>
            <li>Target OTD dapat dijadikan SLA vendor dan customer; indikator hijau mulai <strong>95%</strong>.</li>
          </ul>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <PerformanceTable title="Service Level per Customer" rows={customerRows} />
        <PerformanceTable title="Service Level per Vendor" rows={vendorRows} />
      </section>

      <section className="rounded-xl border border-border bg-white overflow-hidden">
        <div className="border-b px-4 py-3"><h2 className="font-semibold text-gray-800">Shipment Butuh Perhatian</h2><p className="text-xs text-gray-500 mt-0.5">Melewati SLA dari Document Created Date/Time: DK 24 jam · LK 72 jam.</p></div>
        <div className="max-h-72 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-50 text-xs uppercase text-gray-500"><tr><th className="px-4 py-2.5 text-left">PSS</th><th className="px-4 py-2.5 text-left">Customer</th><th className="px-4 py-2.5 text-left">Vendor</th><th className="px-4 py-2.5 text-left">Batas SLA</th><th className="px-4 py-2.5 text-center">Status</th></tr></thead>
            <tbody className="divide-y">
              {loading ? <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Memuat laporan...</td></tr> : attentionRows.length === 0 ? <tr><td colSpan={5} className="px-4 py-8 text-center text-green-700">Tidak ada shipment yang melampaui SLA.</td></tr> : attentionRows.map(row => <tr key={row.id}><td className="px-4 py-3 font-mono text-xs text-indigo-700">{row.pss_no ?? '-'}</td><td className="px-4 py-3">{row.customer_name ?? '-'}</td><td className="px-4 py-3">{vendorName(row)}</td><td className="px-4 py-3"><div>{formatDateTime(slaDueAt(row))}</div><div className="text-xs text-gray-500">{row.dk_lk === 'DK' ? 'DK · 24 jam' : 'LK · 72 jam'}</div></td><td className="px-4 py-3 text-center"><StatusBadge status={row.status} /></td></tr>)}
            </tbody>
          </table>
        </div>
      </section>

      <style>{`.inp{width:100%;border:1px solid #e5e7eb;border-radius:.5rem;padding:.5rem .75rem;font-size:.875rem}.inp:focus{outline:none;border-color:#6366f1}.btn-secondary{border:1px solid #e5e7eb;border-radius:.5rem;padding:.5rem .75rem;font-size:.875rem;color:#374151;background:white}.btn-secondary:hover{background:#f9fafb}`}</style>
    </div>
  )
}

function Kpi({ icon, label, value, detail, color }: { icon: React.ReactNode; label: string; value: string | number; detail: string; color: 'blue' | 'green' | 'emerald' | 'amber' }) {
  const colors = { blue: 'bg-blue-50 text-blue-600', green: 'bg-green-50 text-green-600', emerald: 'bg-emerald-50 text-emerald-600', amber: 'bg-amber-50 text-amber-600' }
  return <div className="rounded-xl border border-border bg-white p-4"><div className={`mb-3 inline-flex rounded-lg p-2 ${colors[color]}`}>{icon}</div><p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p><p className="mt-1 text-2xl font-bold text-gray-800">{value}</p><p className="mt-1 text-xs text-gray-500">{detail}</p></div>
}
