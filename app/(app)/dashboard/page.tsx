import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { CustomerStockMapClient } from '@/components/customer-stock-map/CustomerStockMapClient'
import Link from 'next/link'
import {
  AlertTriangle, CheckCircle2, Clock3, MapPin,
  PackageCheck, Truck, XCircle, TrendingUp, TrendingDown,
  Minus, Package, Bell,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

async function getDashboardData() {
  // 6 bulan terakhir untuk OTD
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5)
  const fromDate = sixMonthsAgo.toISOString().slice(0, 7) + '-01'

  const today = new Date().toISOString().slice(0, 10)

  const [
    { count: vendorCount },
    { count: receivingCount },
    { count: issueCount },
    { data: customers },
    { data: openIssues },
    { data: activeShipments },
    { data: otdData },
    { count: outboundTotal },
    { data: lateShipments },
    { count: activeShipmentCount },
    { count: draftCount },
    { count: dispatchedCount },
    { count: inTransitCount },
    { count: deliveredTodayCount },
  ] = await Promise.all([
    supabase.from('vendors').select('*', { count: 'exact', head: true }),
    supabase.from('receiving_header').select('*', { count: 'exact', head: true }),
    supabase.from('issue_log').select('*', { count: 'exact', head: true }),
    supabase.from('customers').select('id, customer_name, city, is_active, machine_count, latitude, longitude').eq('is_active', true).limit(200),
    supabase.from('issue_log').select('issue_no, title, status, category, due_date').in('status', ['open', 'in_progress']).order('due_date', { ascending: true }).limit(5),
    // Shipment aktif dari shipment_tracking (bukan tabel shipments lama)
    supabase.from('shipment_tracking')
      .select('id, pss_no, status, customer_name, destination_city, promised_delivery_date, transporter_id, dispatch_time')
      .in('status', ['Draft', 'Dispatched', 'In Transit'])
      .order('promised_delivery_date', { ascending: true })
      .limit(8),
    // OTD: ambil data outbound_header 6 bulan terakhir
    supabase.from('outbound_header')
      .select('document_date, is_late, delivery_delay_days, project, customer_no')
      .gte('document_date', fromDate)
      .not('document_date', 'is', null)
      .not('is_late', 'is', null),
    supabase.from('outbound_header').select('*', { count: 'exact', head: true }),
    // Alert: shipment lewat promised_delivery_date tapi belum Delivered
    supabase.from('shipment_tracking')
      .select('id, pss_no, customer_name, promised_delivery_date, status, dispatch_time, destination_city, dk_lk')
      .lt('promised_delivery_date', today)
      .not('status', 'eq', 'Delivered')
      .not('promised_delivery_date', 'is', null)
      .order('promised_delivery_date', { ascending: true })
      .limit(20),
    // Count shipment aktif (non-Delivered)
    supabase.from('shipment_tracking').select('*', { count: 'exact', head: true }).not('status', 'eq', 'Delivered'),
    // Breakdown per status
    supabase.from('shipment_tracking').select('*', { count: 'exact', head: true }).eq('status', 'Draft'),
    supabase.from('shipment_tracking').select('*', { count: 'exact', head: true }).eq('status', 'Dispatched'),
    supabase.from('shipment_tracking').select('*', { count: 'exact', head: true }).eq('status', 'In Transit'),
    // Delivered hari ini
    supabase.from('shipment_tracking').select('*', { count: 'exact', head: true }).eq('status', 'Delivered').gte('delivery_time', today),
  ])

  return {
    counts: {
      vendors: vendorCount ?? 0,
      receiving: receivingCount ?? 0,
      issues: issueCount ?? 0,
      outbound: outboundTotal ?? 0,
      activeShipments: activeShipmentCount ?? 0,
      draft: draftCount ?? 0,
      dispatched: dispatchedCount ?? 0,
      inTransit: inTransitCount ?? 0,
      deliveredToday: deliveredTodayCount ?? 0,
    },
    customers: customers ?? [],
    openIssues: openIssues ?? [],
    activeShipments: (activeShipments ?? []) as {
      id: number
      pss_no: string | null
      status: string
      customer_name: string | null
      destination_city: string | null
      promised_delivery_date: string | null
      dispatch_time: string | null
    }[],
    otdRaw: (otdData ?? []) as {
      document_date: string
      is_late: boolean
      delivery_delay_days: number | null
      project: string | null
      customer_no: string | null
    }[],
    lateShipments: (lateShipments ?? []) as {
      id: number
      pss_no: string | null
      customer_name: string | null
      promised_delivery_date: string
      status: string
      dispatch_time: string | null
      destination_city: string | null
      dk_lk: string | null
    }[],
  }
}

function computeOtd(rows: { document_date: string; is_late: boolean; delivery_delay_days: number | null }[]) {
  if (!rows.length) return { rate: null, onTime: 0, late: 0, total: 0, avgDelay: null }

  const onTime = rows.filter((r) => r.is_late === false).length
  const late   = rows.filter((r) => r.is_late === true).length
  const total  = rows.length
  const rate   = Math.round((onTime / total) * 100)

  const lateRows = rows.filter((r) => r.is_late && r.delivery_delay_days != null)
  const avgDelay = lateRows.length
    ? Math.round(lateRows.reduce((s, r) => s + (r.delivery_delay_days ?? 0), 0) / lateRows.length)
    : 0

  return { rate, onTime, late, total, avgDelay }
}

function computeMonthlyOtd(rows: { document_date: string; is_late: boolean }[]) {
  const byMonth: Record<string, { onTime: number; total: number }> = {}

  for (const r of rows) {
    const m = r.document_date.slice(0, 7)
    if (!byMonth[m]) byMonth[m] = { onTime: 0, total: 0 }
    byMonth[m].total++
    if (!r.is_late) byMonth[m].onTime++
  }

  return Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, s]) => ({
      month,
      rate: Math.round((s.onTime / s.total) * 100),
      total: s.total,
      onTime: s.onTime,
    }))
}

export default async function DashboardPage() {
  const { counts, customers, openIssues, activeShipments, otdRaw, lateShipments } = await getDashboardData()

  const customerActive  = customers.length
  const totalMesinHD    = (customers as any[]).reduce((s: number, r: any) => s + (Number(r.machine_count) || 0), 0)
  const withLokasi      = (customers as any[]).filter((r: any) => r.latitude != null && r.longitude != null).length
  const lokasiCoverage  = customerActive ? Math.round(withLokasi * 100 / customerActive) : 0

  const otd        = computeOtd(otdRaw)
  const otdMonthly = computeMonthlyOtd(otdRaw)

  // Bandingkan bulan ini vs bulan lalu
  const lastTwo = otdMonthly.slice(-2)
  const trend   = lastTwo.length === 2 ? lastTwo[1].rate - lastTwo[0].rate : null

  // Hitung hari keterlambatan per shipment
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  function daysLate(promisedDate: string) {
    const d = new Date(promisedDate)
    d.setHours(0, 0, 0, 0)
    return Math.floor((today.getTime() - d.getTime()) / 86_400_000)
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-blue">
            <span className="h-2 w-2 rounded-full bg-blue" />
            Live control tower
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">SCM Dashboard</h1>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Clock3 size={16} /> Update terakhir: hari ini,{' '}
          {new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </header>

      {/* ── KPI Strip ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Link href="/receiving" className="rounded-xl border border-border bg-white p-4 hover:border-indigo-300 transition">
          <div className="flex items-center gap-2 text-xs text-gray-500"><PackageCheck size={14} /> Receiving</div>
          <div className="mt-2 text-3xl font-bold">{counts.receiving}</div>
          <div className="text-xs text-gray-500 mt-1">PTR Header masuk</div>
        </Link>
        <Link href="/outbound" className="rounded-xl border border-border bg-white p-4 hover:border-indigo-300 transition">
          <div className="flex items-center gap-2 text-xs text-gray-500"><Package size={14} /> Outbound PSS</div>
          <div className="mt-2 text-3xl font-bold">{counts.outbound.toLocaleString('id-ID')}</div>
          <div className="text-xs text-gray-500 mt-1">Total PSS header</div>
        </Link>
        <Link href="/shipment" className="rounded-xl border border-border bg-white p-4 hover:border-indigo-300 transition">
          <div className="flex items-center gap-2 text-xs text-gray-500"><Truck size={14} /> Shipment Aktif</div>
          <div className="mt-2 text-3xl font-bold">{counts.activeShipments}</div>
          <div className="mt-1 flex gap-2 flex-wrap">
            {counts.draft > 0 && <span className="text-xs bg-gray-100 text-gray-600 rounded px-1.5 py-0.5">{counts.draft} Draft</span>}
            {counts.dispatched > 0 && <span className="text-xs bg-blue-100 text-blue-700 rounded px-1.5 py-0.5">{counts.dispatched} Dispatched</span>}
            {counts.inTransit > 0 && <span className="text-xs bg-orange-100 text-orange-700 rounded px-1.5 py-0.5">{counts.inTransit} In Transit</span>}
          </div>
        </Link>
        <Link href="/issues" className="rounded-xl border border-border bg-white p-4 hover:border-indigo-300 transition">
          <div className="flex items-center gap-2 text-xs text-gray-500"><AlertTriangle size={14} /> Open Issues</div>
          <div className={`mt-2 text-3xl font-bold ${counts.issues > 0 ? 'text-orange-600' : 'text-gray-800'}`}>
            {counts.issues}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {counts.deliveredToday > 0 ? `${counts.deliveredToday} delivered hari ini` : 'Masalah operasional'}
          </div>
        </Link>
      </div>

      {/* ── OTD KPI Section ───────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <TrendingUp size={18} /> On-Time Delivery (OTD)
          </h2>
          <span className="text-xs text-gray-500">
            {otdRaw.length} pengiriman · 6 bulan terakhir
          </span>
        </div>

        {otdRaw.length === 0 ? (
          <div className="rounded-xl border border-border bg-white p-6 text-sm text-gray-400 text-center">
            Belum ada data outbound. Upload PSS Header & Detail di{' '}
            <Link href="/outbound" className="text-indigo-600 hover:underline">/outbound</Link>.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {/* OTD Rate card */}
            <div className="rounded-xl border border-border bg-white p-5">
              <div className="text-xs text-gray-500 mb-1">OTD Rate (6 bln)</div>
              <div className="flex items-end gap-2">
                <span
                  className={`text-4xl font-bold ${
                    (otd.rate ?? 0) >= 95
                      ? 'text-green-600'
                      : (otd.rate ?? 0) >= 80
                      ? 'text-yellow-600'
                      : 'text-red-600'
                  }`}
                >
                  {otd.rate ?? '-'}%
                </span>
                {trend !== null && (
                  <span
                    className={`mb-1 flex items-center gap-0.5 text-xs font-medium ${
                      trend > 0 ? 'text-green-600' : trend < 0 ? 'text-red-600' : 'text-gray-500'
                    }`}
                  >
                    {trend > 0 ? <TrendingUp size={12} /> : trend < 0 ? <TrendingDown size={12} /> : <Minus size={12} />}
                    {trend > 0 ? '+' : ''}{trend}% vs bln lalu
                  </span>
                )}
              </div>
              <div className="mt-2 flex gap-3 text-xs text-gray-500">
                <span className="text-green-600 font-medium">{otd.onTime} tepat waktu</span>
                <span className="text-red-500 font-medium">{otd.late} terlambat</span>
              </div>
              {/* Progress bar */}
              <div className="mt-3 h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                <div
                  className={`h-2 rounded-full transition-all ${
                    (otd.rate ?? 0) >= 95 ? 'bg-green-500' : (otd.rate ?? 0) >= 80 ? 'bg-yellow-400' : 'bg-red-500'
                  }`}
                  style={{ width: `${otd.rate ?? 0}%` }}
                />
              </div>
              <div className="mt-1 text-xs text-gray-400">Target ≥ 95%</div>
            </div>

            {/* Avg delay card */}
            <div className="rounded-xl border border-border bg-white p-5">
              <div className="text-xs text-gray-500 mb-1">Rata-rata Keterlambatan</div>
              <div className="text-4xl font-bold text-orange-500">
                {otd.avgDelay ?? 0}
                <span className="text-base font-normal text-gray-500 ml-1">hari</span>
              </div>
              <div className="mt-2 text-xs text-gray-500">
                Dari {otd.late} pengiriman terlambat
              </div>
              <div className="mt-3 text-xs text-gray-400">
                Dihitung dari: cust_receipt_date − promised_delivery_date
              </div>
            </div>

            {/* Monthly trend table */}
            <div className="rounded-xl border border-border bg-white p-5">
              <div className="text-xs text-gray-500 mb-3">Tren Bulanan</div>
              <div className="space-y-1.5">
                {otdMonthly.slice(-6).map(({ month, rate, total }) => {
                  const [yr, mo] = month.split('-')
                  const label = new Date(Number(yr), Number(mo) - 1).toLocaleDateString('id-ID', {
                    month: 'short', year: '2-digit',
                  })
                  return (
                    <div key={month} className="flex items-center gap-2">
                      <span className="w-16 text-xs text-gray-500">{label}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className={`h-1.5 rounded-full ${
                            rate >= 95 ? 'bg-green-500' : rate >= 80 ? 'bg-yellow-400' : 'bg-red-500'
                          }`}
                          style={{ width: `${rate}%` }}
                        />
                      </div>
                      <span
                        className={`w-10 text-right text-xs font-medium ${
                          rate >= 95 ? 'text-green-600' : rate >= 80 ? 'text-yellow-600' : 'text-red-600'
                        }`}
                      >
                        {rate}%
                      </span>
                      <span className="w-12 text-right text-xs text-gray-400">{total} PSS</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ── Alert Keterlambatan TMS ───────────────────────── */}
      {lateShipments.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold flex items-center gap-2 text-red-700">
              <Bell size={18} className="animate-pulse" />
              Alert Keterlambatan
              <span className="ml-1 rounded-full bg-red-600 text-white text-xs font-bold px-2 py-0.5">
                {lateShipments.length}
              </span>
            </h2>
            <Link href="/shipment" className="text-xs text-red-600 hover:underline font-medium">
              Kelola shipment →
            </Link>
          </div>

          <div className="rounded-xl border border-red-200 bg-red-50 overflow-hidden">
            <div className="px-4 py-2 bg-red-100 border-b border-red-200 text-xs text-red-700 font-medium">
              Shipment berikut sudah melewati Promised Delivery Date tapi belum berstatus Delivered
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-red-50 border-b border-red-100">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-xs font-bold uppercase text-red-600 whitespace-nowrap">Terlambat</th>
                    <th className="text-left px-4 py-2.5 text-xs font-bold uppercase text-red-600 whitespace-nowrap">PSS / Ref</th>
                    <th className="text-left px-4 py-2.5 text-xs font-bold uppercase text-red-600">Customer</th>
                    <th className="text-left px-4 py-2.5 text-xs font-bold uppercase text-red-600">Tujuan</th>
                    <th className="text-left px-4 py-2.5 text-xs font-bold uppercase text-red-600 whitespace-nowrap">Promised Date</th>
                    <th className="text-center px-4 py-2.5 text-xs font-bold uppercase text-red-600">Status</th>
                    <th className="text-center px-4 py-2.5 text-xs font-bold uppercase text-red-600">DK/LK</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-red-100">
                  {lateShipments.map((s) => {
                    const days = daysLate(s.promised_delivery_date)
                    const urgency = days >= 7 ? 'text-red-800 bg-red-200' : days >= 3 ? 'text-red-700 bg-red-100' : 'text-orange-700 bg-orange-100'
                    const statusColor: Record<string, string> = {
                      'Draft':      'bg-gray-100 text-gray-600',
                      'Dispatched': 'bg-blue-100 text-blue-700',
                      'In Transit': 'bg-orange-100 text-orange-700',
                    }
                    return (
                      <tr key={s.id} className="bg-white hover:bg-red-50 transition-colors">
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${urgency}`}>
                            <AlertTriangle size={10} />
                            {days} hari
                          </span>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs font-medium text-indigo-700 whitespace-nowrap">
                          {s.pss_no ?? `#${s.id}`}
                        </td>
                        <td className="px-4 py-2.5 text-xs max-w-[180px] truncate font-medium">
                          {s.customer_name ?? '—'}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-600">
                          {s.destination_city ?? '—'}
                        </td>
                        <td className="px-4 py-2.5 text-xs whitespace-nowrap text-gray-600">
                          {s.promised_delivery_date}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${statusColor[s.status] ?? 'bg-gray-100 text-gray-600'}`}>
                            {s.status}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {s.dk_lk ? (
                            <span className={`text-xs font-bold rounded px-1.5 py-0.5 ${s.dk_lk === 'DK' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                              {s.dk_lk}
                            </span>
                          ) : <span className="text-gray-300 text-xs">—</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {lateShipments.length >= 20 && (
              <div className="px-4 py-2 text-xs text-red-500 border-t border-red-100 text-center">
                Menampilkan 20 teratas — <Link href="/shipment" className="underline">lihat semua di Shipment Tracking</Link>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Jika tidak ada shipment_tracking sama sekali, tampilkan hint */}
      {lateShipments.length === 0 && counts.activeShipments === 0 && (
        <section className="rounded-xl border border-gray-100 bg-gray-50 p-4 flex items-center gap-3 text-sm text-gray-500">
          <Bell size={16} className="text-gray-400 shrink-0" />
          <span>
            Tidak ada alert keterlambatan TMS.{' '}
            {counts.activeShipments === 0
              ? <>Belum ada shipment aktif di <Link href="/shipment" className="text-indigo-600 hover:underline">Shipment Tracking</Link>.</>
              : 'Semua shipment aktif masih dalam batas waktu.'}
          </span>
        </section>
      )}

      {/* ── Customer Map ──────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <MapPin size={18} /> Customer Map
          </h2>
          <div className="text-xs text-gray-500">
            {customerActive} customer aktif · {totalMesinHD.toLocaleString('id-ID')} MESIN HD ·{' '}
            {withLokasi}/{customerActive} LOKASI ({lokasiCoverage}%)
          </div>
        </div>
        <CustomerStockMapClient />
      </section>

      {/* ── Shipments Aktif (TMS) + Open Issues ──────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between border-b border-border p-4">
            <h2 className="font-semibold flex items-center gap-2">
              <Truck size={16} /> Shipment Aktif
            </h2>
            <Link href="/shipment" className="text-xs text-blue-600 hover:underline">Lihat semua →</Link>
          </div>
          {activeShipments.length === 0 ? (
            <div className="p-6 text-sm text-gray-500 text-center">
              Belum ada shipment aktif.{' '}
              <Link href="/shipment" className="text-indigo-600 hover:underline">Tambah di Shipment Tracking</Link>.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {activeShipments.map((s) => {
                const isUrgent = s.promised_delivery_date
                  ? new Date(s.promised_delivery_date) <= new Date()
                  : false
                const statusColor: Record<string, string> = {
                  'Draft':      'bg-gray-100 text-gray-600',
                  'Dispatched': 'bg-blue-100 text-blue-700',
                  'In Transit': 'bg-orange-100 text-orange-700',
                }
                return (
                  <li key={s.id} className={`flex items-center gap-3 p-3 text-sm ${isUrgent ? 'bg-red-50' : ''}`}>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${statusColor[s.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {s.status}
                    </span>
                    <span className="font-mono text-xs text-indigo-600 shrink-0">
                      {s.pss_no ?? `#${s.id}`}
                    </span>
                    <span className="flex-1 truncate text-xs">{s.customer_name ?? '—'}</span>
                    <span className="text-xs text-gray-400 shrink-0">
                      {s.promised_delivery_date?.slice(0, 10) ?? '—'}
                    </span>
                    {isUrgent && <AlertTriangle size={12} className="text-red-500 shrink-0" />}
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section className="bg-white border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between border-b border-border p-4">
            <h2 className="font-semibold flex items-center gap-2"><AlertTriangle size={16} /> Open Issues</h2>
            <Link href="/issues" className="text-xs text-blue-600 hover:underline">Lihat semua →</Link>
          </div>
          {openIssues.length === 0 ? (
            <div className="p-6 text-sm text-gray-500 text-center">Tidak ada open issue. 🎉</div>
          ) : (
            <ul className="divide-y divide-border">
              {openIssues.map((iss: any) => (
                <li key={iss.issue_no} className="flex items-start gap-3 p-3 text-sm">
                  <span className="text-xs px-2 py-0.5 rounded bg-orange-100 text-orange-700 whitespace-nowrap">{iss.status}</span>
                  <div className="flex-1">
                    <div className="font-medium">{iss.title}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {iss.category}{iss.due_date && ` · Due ${iss.due_date}`}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* ── Quick links ───────────────────────────────────── */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Link href="/workflow" className="flex items-center gap-3 rounded-xl border border-border bg-white p-4 hover:border-indigo-300 transition">
          <span className="rounded-lg bg-blue-100 p-2"><CheckCircle2 className="text-blue-600" size={20} /></span>
          <div><div className="text-sm font-semibold">Workflow Overview</div><div className="text-xs text-gray-500">Status flow harian</div></div>
        </Link>
        <Link href="/master-data" className="flex items-center gap-3 rounded-xl border border-border bg-white p-4 hover:border-indigo-300 transition">
          <span className="rounded-lg bg-indigo-100 p-2"><Package className="text-indigo-600" size={20} /></span>
          <div><div className="text-sm font-semibold">Master Data</div><div className="text-xs text-gray-500">Vendor, Route, SKU</div></div>
        </Link>
        <Link href="/warehouse-checklist" className="flex items-center gap-3 rounded-xl border border-border bg-white p-4 hover:border-indigo-300 transition">
          <span className="rounded-lg bg-purple-100 p-2"><CheckCircle2 className="text-purple-600" size={20} /></span>
          <div><div className="text-sm font-semibold">Warehouse Checklist</div><div className="text-xs text-gray-500">Cek kesiapan gudang</div></div>
        </Link>
        <Link href="/settings" className="flex items-center gap-3 rounded-xl border border-border bg-white p-4 hover:border-indigo-300 transition">
          <span className="rounded-lg bg-gray-100 p-2"><XCircle className="text-gray-600" size={20} /></span>
          <div><div className="text-sm font-semibold">Settings</div><div className="text-xs text-gray-500">Status Supabase</div></div>
        </Link>
      </section>
    </div>
  )
}
