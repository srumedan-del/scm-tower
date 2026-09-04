import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { CustomerStockMapClient } from '@/components/customer-stock-map/CustomerStockMapClient'
import Link from 'next/link'
import {
  AlertTriangle, Box, CheckCircle2, Clock3, MapPin,
  PackageCheck, Truck, XCircle, TrendingUp, TrendingDown,
  Minus, Package,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

async function getDashboardData() {
  // 6 bulan terakhir untuk OTD
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5)
  const fromDate = sixMonthsAgo.toISOString().slice(0, 7) + '-01'

  const [
    { count: vendorCount },
    { count: shipmentCount },
    { count: receivingCount },
    { count: issueCount },
    { data: customers },
    { data: openIssues },
    { data: todayShipments },
    { data: otdData },
    { count: outboundTotal },
  ] = await Promise.all([
    supabase.from('vendors').select('*', { count: 'exact', head: true }),
    supabase.from('shipments').select('*', { count: 'exact', head: true }),
    supabase.from('receiving_header').select('*', { count: 'exact', head: true }),
    supabase.from('issue_log').select('*', { count: 'exact', head: true }),
    supabase.from('customers').select('id, customer_name, city, is_active, machine_count, latitude, longitude').eq('is_active', true).limit(200),
    supabase.from('issue_log').select('issue_no, title, status, category, due_date').in('status', ['open', 'in_progress']).order('due_date', { ascending: true }).limit(5),
    supabase.from('shipments').select('shipment_no, status, destination_city, vendor_name').in('status', ['planned', 'picking', 'loaded', 'in_transit']).order('shipment_date', { ascending: false }).limit(5),
    // OTD: ambil data outbound_header 6 bulan terakhir
    supabase.from('outbound_header')
      .select('document_date, is_late, delivery_delay_days, project, customer_no')
      .gte('document_date', fromDate)
      .not('document_date', 'is', null)
      .not('is_late', 'is', null),
    supabase.from('outbound_header').select('*', { count: 'exact', head: true }),
  ])

  return {
    counts: {
      vendors: vendorCount ?? 0,
      shipments: shipmentCount ?? 0,
      receiving: receivingCount ?? 0,
      issues: issueCount ?? 0,
      outbound: outboundTotal ?? 0,
    },
    customers: customers ?? [],
    openIssues: openIssues ?? [],
    todayShipments: todayShipments ?? [],
    otdRaw: (otdData ?? []) as {
      document_date: string
      is_late: boolean
      delivery_delay_days: number | null
      project: string | null
      customer_no: string | null
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
  const { counts, customers, openIssues, todayShipments, otdRaw } = await getDashboardData()

  const customerActive  = customers.length
  const totalMesinHD    = (customers as any[]).reduce((s: number, r: any) => s + (Number(r.machine_count) || 0), 0)
  const withLokasi      = (customers as any[]).filter((r: any) => r.latitude != null && r.longitude != null).length
  const lokasiCoverage  = customerActive ? Math.round(withLokasi * 100 / customerActive) : 0

  const otd        = computeOtd(otdRaw)
  const otdMonthly = computeMonthlyOtd(otdRaw)

  // Bandingkan bulan ini vs bulan lalu
  const lastTwo = otdMonthly.slice(-2)
  const trend   = lastTwo.length === 2 ? lastTwo[1].rate - lastTwo[0].rate : null

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
        <Link href="/vendor" className="rounded-xl border border-border bg-white p-4 hover:border-indigo-300 transition">
          <div className="flex items-center gap-2 text-xs text-gray-500"><Box size={14} /> Vendors</div>
          <div className="mt-2 text-3xl font-bold">{counts.vendors}</div>
          <div className="text-xs text-gray-500 mt-1">Master vendor transport</div>
        </Link>
        <Link href="/shipment" className="rounded-xl border border-border bg-white p-4 hover:border-indigo-300 transition">
          <div className="flex items-center gap-2 text-xs text-gray-500"><Truck size={14} /> Shipments</div>
          <div className="mt-2 text-3xl font-bold">{counts.shipments}</div>
          <div className="text-xs text-gray-500 mt-1">Total shipment tracking</div>
        </Link>
        <Link href="/receiving" className="rounded-xl border border-border bg-white p-4 hover:border-indigo-300 transition">
          <div className="flex items-center gap-2 text-xs text-gray-500"><PackageCheck size={14} /> Receiving</div>
          <div className="mt-2 text-3xl font-bold">{counts.receiving}</div>
          <div className="text-xs text-gray-500 mt-1">Penerimaan barang</div>
        </Link>
        <Link href="/outbound" className="rounded-xl border border-border bg-white p-4 hover:border-indigo-300 transition">
          <div className="flex items-center gap-2 text-xs text-gray-500"><Package size={14} /> Outbound PSS</div>
          <div className="mt-2 text-3xl font-bold">{counts.outbound.toLocaleString('id-ID')}</div>
          <div className="text-xs text-gray-500 mt-1">Total PSS header</div>
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

      {/* ── Shipments In Progress + Open Issues ───────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between border-b border-border p-4">
            <h2 className="font-semibold flex items-center gap-2"><Truck size={16} /> Shipments In Progress</h2>
            <Link href="/shipment" className="text-xs text-blue-600 hover:underline">Lihat semua →</Link>
          </div>
          {todayShipments.length === 0 ? (
            <div className="p-6 text-sm text-gray-500 text-center">
              Belum ada shipment in-progress.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {todayShipments.map((s: any, i: number) => (
                <li key={i} className="flex items-center gap-3 p-3 text-sm">
                  <span className="font-mono text-xs text-gray-500">{s.shipment_no}</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700">{s.status}</span>
                  <span className="flex-1 truncate">{s.destination_city}</span>
                  <span className="text-xs text-gray-500 truncate max-w-[140px]">{s.vendor_name ?? '-'}</span>
                </li>
              ))}
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
          <span className="rounded-lg bg-indigo-100 p-2"><Box className="text-indigo-600" size={20} /></span>
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
