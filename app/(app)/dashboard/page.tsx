import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import DashboardPeriodSelect from '@/components/dashboard/DashboardPeriodSelect'
import Link from 'next/link'
import { jakartaToday, slaDueAt, slaDueDate, slaWorkingDaysLeft, workingDaysSince, PTS_PENDING_REMINDER_DAYS } from '@/lib/sla'
import { getPendingPts } from '@/app/(app)/crossdocking/actions'
import { CountUp } from '@/components/ui/CountUp'
import { AlertTriangle, ArrowLeftRight, Bell, CheckCircle2, Clock3, Minus, Package, PackageCheck, TrendingDown, TrendingUp, Truck, Warehouse } from 'lucide-react'
import { statusClass } from '@/lib/status-style'

export const dynamic = 'force-dynamic'

// ─── helpers ────────────────────────────────────────────────────────────────

function currentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function nextMonthStart(month: string) {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function monthLabel(month: string) {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
}

// Data aktual dimulai dari November 2026
const DATA_START = '2026-11-01'

function availableMonths() {
  const months: string[] = []
  const now = new Date()
  const startY = 2026, startM = 11
  const curY = now.getFullYear(), curM = now.getMonth() + 1
  for (let y = curY; y >= startY; y--) {
    const fromM = y === curY ? curM : 12
    const toM   = y === startY ? startM : 1
    for (let m = fromM; m >= toM; m--)
      months.push(`${y}-${String(m).padStart(2, '0')}`)
  }
  return months
}

// ─── data fetching (3 batch, dioptimasi) ─────────────────────────────────────

async function getDashboardData(period: string) {
  const from  = `${period}-01`
  const to    = nextMonthStart(period)
  const today = jakartaToday()

  const sevenDaysStr = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10)
  const threeDaysStr = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10)

  // ── Batch 1: query ringan (count-only + list kecil) ──────────────────────
  const [
    { count: receivingMonth },
    { count: crossdockingActive },
    { count: deliveredToday },
    { data: openIssues },
    { data: crossdockingDeadlineRaw },
    { data: recentPtr },
  ] = await Promise.all([
    supabase.from('receiving_header').select('*', { count: 'exact', head: true })
      .gte('posting_date', from).lt('posting_date', to),

    supabase.from('crossdocking_header').select('*', { count: 'exact', head: true })
      .not('status', 'eq', 'Delivered').gte('received_from_hq_date', DATA_START),

    supabase.from('shipment_tracking').select('*', { count: 'exact', head: true })
      .eq('status', 'Delivered').gte('delivery_time', today),

    supabase.from('issue_log')
      .select('issue_no, title, status, category, due_date')
      .in('status', ['Open', 'In Progress'])
      .order('due_date', { ascending: true }).limit(5),


    supabase.from('crossdocking_header')
      .select('id, crossdocking_no, customer_name, destination_city, promised_delivery_date, status')
      .lte('promised_delivery_date', threeDaysStr)
      .not('status', 'eq', 'Delivered')
      .not('promised_delivery_date', 'is', null)
      .gte('promised_delivery_date', DATA_START)
      .order('promised_delivery_date', { ascending: true }).limit(20),

    supabase.from('receiving_header')
      .select('id, ptr_no, transfer_from_code, transfer_to_code, posting_date, ship_to_posting_days')
      .gte('posting_date', from).lt('posting_date', to)
      .order('posting_date', { ascending: false }).limit(5),
  ])

  // ── Batch 2: dua query besar (shipment + outbound) secara paralel ─────────
  const [
    { data: shipmentRows },
    { data: outboundRows },
  ] = await Promise.all([
    // SATU query semua shipment Nov 2026+ — tanpa FK join, semua agregasi di JS
    supabase.from('shipment_tracking')
      .select('id, pss_no, crossdocking_id, source_type, status, customer_name, destination_city, document_date, dk_lk, dispatch_time, delivery_time')
      .gte('document_date', DATA_START)
      .order('document_date', { ascending: false })
      .limit(1000),

    // Outbound bulan ini — hanya customer_no untuk lookup DK/LK
    supabase.from('outbound_header')
      .select('pss_no, shipment_no, customer_no')
      .gte('document_date', from).lt('document_date', to),
  ])

  // ── Batch 3: lookup DK/LK — hanya jika ada customer unik ─────────────────
  const customerNos = [...new Set(
    (outboundRows ?? []).map((r: any) => r.customer_no).filter(Boolean)
  )] as string[]

  const dkLkMap = new Map<string, string>()
  if (customerNos.length) {
    const { data: custData } = await supabase
      .from('customers').select('customer_code, dk_lk')
      .in('customer_code', customerNos)
    for (const c of custData ?? [])
      if (c.customer_code && c.dk_lk) dkLkMap.set(c.customer_code, c.dk_lk)
  }

  // ── Proses shipmentRows — semua derivasi dari satu array ─────────────────
  const allShipments = (shipmentRows ?? []) as {
    id: number; pss_no: string | null; crossdocking_id: number | null; source_type: string
    status: string; customer_name: string | null; destination_city: string | null
    document_date: string; dk_lk: string | null; dispatch_time: string | null
    delivery_time: string | null
  }[]

  // Count status
  const cntDraft      = allShipments.filter(s => s.status === 'Draft').length
  const cntDispatched = allShipments.filter(s => s.status === 'Dispatched').length
  const cntInTransit  = allShipments.filter(s => s.status === 'In Transit').length

  // PSS untracked bulan ini
  const trackedPssSet = new Set(
    allShipments
      .filter(s => s.pss_no && s.status !== 'Failed Delivery' && s.document_date >= from && s.document_date < to)
      .map(s => String(s.pss_no).trim())
  )
  const untrackedCount = (outboundRows ?? []).filter((r: any) => {
    const key = String(r.pss_no ?? r.shipment_no ?? '').trim()
    return key && !trackedPssSet.has(key)
  }).length

  // OTD bulan ini
  const otdRows = allShipments.filter(s =>
    s.status === 'Delivered' && s.delivery_time &&
    s.delivery_time >= from && s.delivery_time < to && s.document_date
  )
  const otdOnTime = otdRows.filter(s => new Date(s.delivery_time!) <= slaDueAt(s.document_date, s.dk_lk)).length
  const otdTotal  = otdRows.length
  const otdRate   = otdTotal > 0 ? Math.round((otdOnTime / otdTotal) * 100) : null

  // Overdue
  const overdueFiltered = allShipments
    .filter(s => s.status !== 'Delivered' && s.status !== 'Closed' && s.status !== 'Failed Delivery' && s.document_date && today > slaDueDate(s.document_date, s.dk_lk))
    .sort((a, b) => a.document_date.localeCompare(b.document_date))

  // Aktif (Dispatched / In Transit)
  const activeToday = allShipments
    .filter(s => s.status === 'Dispatched' || s.status === 'In Transit')
    .sort((a, b) => (b.dispatch_time ?? '').localeCompare(a.dispatch_time ?? ''))
    .slice(0, 10)

  // Crossdocking deadline — exclude yang sudah punya shipment aktif
  const shippedCdIds = new Set(
    allShipments
      .filter(s => s.crossdocking_id && ['Dispatched', 'In Transit', 'Delivered', 'Closed'].includes(s.status))
      .map(s => s.crossdocking_id!)
  )
  const crossdockingDeadline = (crossdockingDeadlineRaw ?? [])
    .filter((c: any) => !shippedCdIds.has(c.id)) as {
      id: number; crossdocking_no: string; customer_name: string | null
      destination_city: string | null; promised_delivery_date: string; status: string
    }[]

  // PTS yang lebih dari 2 hari kerja belum diputuskan (Crossdocking atau Realokasi)
  const pendingPts = (await getPendingPts(DATA_START).catch(() => []))
    .map(row => ({ ...row, days: workingDaysSince(row.document_date, today) }))
    .filter(row => row.days > PTS_PENDING_REMINDER_DAYS)

  // Outbound counts
  const outboundMonth = outboundRows?.length ?? 0
  const outboundDK    = (outboundRows ?? []).filter((r: any) => dkLkMap.get(r.customer_no) === 'DK').length
  const outboundLK    = (outboundRows ?? []).filter((r: any) => dkLkMap.get(r.customer_no) === 'LK').length


  return {
    period, today,
    counts: {
      outboundMonth, outboundDK, outboundLK,
      receivingMonth: receivingMonth ?? 0,
      crossdockingActive: crossdockingActive ?? 0,
      deliveredToday: deliveredToday ?? 0,
      draft: cntDraft, dispatched: cntDispatched, inTransit: cntInTransit,
      untrackedPss: untrackedCount,
    },
    otd: { rate: otdRate, onTime: otdOnTime, late: otdTotal - otdOnTime, total: otdTotal },
    overdueShipments: overdueFiltered,
    crossdockingDeadline,
    pendingPts,
    activeToday,
    recentPtr: (recentPtr ?? []) as {
      id: number; ptr_no: string | null; transfer_from_code: string | null
      transfer_to_code: string | null; posting_date: string | null; ship_to_posting_days: number | null
    }[],
    openIssues: (openIssues ?? []) as {
      issue_no: string; title: string; status: string; category: string | null; due_date: string | null
    }[],
  }
}

// ─── sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${statusClass(status)}`}>{status}</span>
}

function SlaStatus({ documentDate, dkLk, today }: { documentDate: string | null; dkLk: string | null; today: string }) {
  if (!documentDate) return <span className="text-xs text-gray-400">—</span>
  const diffDays = slaWorkingDaysLeft(documentDate, dkLk, today)
  if (diffDays < 0) {
    const late = Math.abs(diffDays)
    return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${late >= 3 ? 'bg-red-200 text-red-800' : 'bg-orange-100 text-orange-700'}`}><AlertTriangle size={9} /> {late}h terlambat</span>
  }
  if (diffDays === 0) return <span className="text-xs font-bold text-orange-600">Deadline hari ini</span>
  return <span className={`text-xs font-bold ${diffDays <= 1 ? 'text-orange-500' : 'text-gray-400'}`}>{dkLk ?? 'LK'} · sisa {diffDays}h</span>
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const params = await searchParams
  const months = availableMonths()
  const defaultPeriod = months[0] ?? currentMonth()
  const period = /^\d{4}-(0[1-9]|1[0-2])$/.test(params.period ?? '') && months.includes(params.period as string)
    ? (params.period as string) : defaultPeriod

  const d = await getDashboardData(period)

  const totalAlerts = d.overdueShipments.length + d.crossdockingDeadline.length + d.counts.untrackedPss + d.pendingPts.length

  return (
    <div className="space-y-6">

      {/* HEADER */}
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-blue-600">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
            </span>
            Live · {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900">SCM Dashboard</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Periode KPI</span>
          <DashboardPeriodSelect period={period} months={months} />
        </div>
      </header>

      {/* ZONA 1 — ALERT AKTIF */}
      {totalAlerts > 0 && (
        <section aria-label="Alert aktif">
          <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-red-700">
            <Bell size={16} className="animate-pulse" />
            Alert Aktif
            <span className="rounded-full bg-red-600 text-white text-xs font-bold px-2 py-0.5">{totalAlerts}</span>
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">

            <Link href="/shipment" className={`rounded-xl border p-4 transition-all hover:-translate-y-0.5 hover:shadow-md ${d.overdueShipments.length > 0 ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white opacity-50'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-red-600 flex items-center gap-1"><Truck size={13} /> Shipment Overdue</span>
                <span className={`text-2xl font-bold ${d.overdueShipments.length > 0 ? 'text-red-600' : 'text-gray-400'}`}><CountUp value={d.overdueShipments.length} /></span>
              </div>
              <p className="text-xs text-gray-500">Lewat SLA (DK 1, LK 5 hari kerja dari tanggal dokumen), belum Delivered</p>
              {d.overdueShipments.slice(0, 2).map(s => {
                const late = Math.abs(slaWorkingDaysLeft(s.document_date, s.dk_lk, d.today))
                return (
                  <div key={s.id} className="mt-1.5 flex items-center gap-1.5 text-xs text-red-700">
                    <AlertTriangle size={10} />
                    <span className="truncate font-medium">{s.customer_name ?? s.pss_no ?? `#${s.id}`}</span>
                    <span className="shrink-0 text-red-400">{s.dk_lk ?? 'LK'} · {late}h</span>
                  </div>
                )
              })}
              {d.overdueShipments.length > 2 && <p className="mt-1 text-xs text-red-400">+{d.overdueShipments.length - 2} lainnya →</p>}
            </Link>

            <Link href="/shipment" className={`rounded-xl border p-4 transition-all hover:-translate-y-0.5 hover:shadow-md ${d.counts.untrackedPss > 0 ? 'border-orange-200 bg-orange-50' : 'border-gray-200 bg-white opacity-50'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-orange-600 flex items-center gap-1"><Package size={13} /> PSS Belum Dikirim</span>
                <span className={`text-2xl font-bold ${d.counts.untrackedPss > 0 ? 'text-orange-600' : 'text-gray-400'}`}><CountUp value={d.counts.untrackedPss} /></span>
              </div>
              <p className="text-xs text-gray-500">PSS {monthLabel(period)} belum dibuat shipment</p>
              <p className="mt-2 text-xs text-orange-500 font-medium">Buka tab "For Transport Planning" →</p>
            </Link>

            <Link href="/crossdocking" className={`rounded-xl border p-4 transition-all hover:-translate-y-0.5 hover:shadow-md ${d.crossdockingDeadline.length > 0 ? 'border-amber-200 bg-amber-50' : 'border-gray-200 bg-white opacity-50'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-amber-700 flex items-center gap-1"><ArrowLeftRight size={13} /> Crossdocking Deadline</span>
                <span className={`text-2xl font-bold ${d.crossdockingDeadline.length > 0 ? 'text-amber-700' : 'text-gray-400'}`}><CountUp value={d.crossdockingDeadline.length} /></span>
              </div>
              <p className="text-xs text-gray-500">Promised date ≤ 3 hari, belum Delivered</p>
              {d.crossdockingDeadline.slice(0, 2).map(c => (
                <div key={c.id} className="mt-1.5 flex items-center gap-1.5 text-xs text-amber-700">
                  <Clock3 size={10} />
                  <span className="truncate font-medium">{c.customer_name ?? c.crossdocking_no}</span>
                  <span className="shrink-0 text-amber-500">{c.promised_delivery_date}</span>
                </div>
              ))}
              {d.crossdockingDeadline.length > 2 && <p className="mt-1 text-xs text-amber-500">+{d.crossdockingDeadline.length - 2} lainnya →</p>}
            </Link>

            <Link href="/crossdocking" className={`rounded-xl border p-4 transition-all hover:-translate-y-0.5 hover:shadow-md ${d.pendingPts.length > 0 ? 'border-gold-200 bg-gold-50' : 'border-gray-200 bg-white opacity-50'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gold-700 flex items-center gap-1"><Package size={13} /> PTS Belum Diputuskan</span>
                <span className={`text-2xl font-bold ${d.pendingPts.length > 0 ? 'text-gold-700' : 'text-gray-400'}`}><CountUp value={d.pendingPts.length} /></span>
              </div>
              <p className="text-xs text-gray-500">Lebih dari {PTS_PENDING_REMINDER_DAYS} hari kerja, belum Crossdocking atau Realokasi</p>
              {d.pendingPts.slice(0, 2).map(p => (
                <div key={p.id} className="mt-1.5 flex items-center gap-1.5 text-xs text-gold-700">
                  <Clock3 size={10} />
                  <span className="truncate font-medium">{p.pts_no}</span>
                  <span className="shrink-0 text-gold-500">{p.days}h kerja</span>
                </div>
              ))}
              {d.pendingPts.length > 2 && <p className="mt-1 text-xs text-gold-500">+{d.pendingPts.length - 2} lainnya →</p>}
            </Link>

          </div>
        </section>
      )}

      {/* ZONA 2 — KPI BULAN INI */}
      <section aria-label={`KPI ${monthLabel(period)}`}>
        <h2 className="mb-3 text-base font-semibold text-gray-700 flex items-center gap-2">
          <TrendingUp size={16} /> KPI — {monthLabel(period)}
        </h2>

        {/* Row 1 Outbound — 3 card: Total, DK, LK */}
        <div className="mb-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-0.5">Outbound</p>
          <div className="grid grid-cols-3 gap-3">
            <Link href="/outbound" className="rounded-xl border border-gray-200 bg-white p-4 transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-indigo-300">
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 mb-2">
                <span className="rounded-md p-1 bg-indigo-50"><Package size={15} /></span>
                Total PSS
              </div>
              <div className="text-3xl font-bold text-indigo-900"><CountUp value={d.counts.outboundMonth} /></div>
              <div className="text-xs text-gray-400 mt-0.5">dokumen keluar</div>
            </Link>
            <Link href="/outbound" className="rounded-xl border border-gray-200 bg-white p-4 transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-blue-300">
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 mb-2">
                <span className="rounded-md p-1 bg-blue-50"><Package size={15} /></span>
                Dalam Kota (DK)
              </div>
              <div className="text-3xl font-bold text-indigo-900"><CountUp value={d.counts.outboundDK} /></div>
              <div className="text-xs text-gray-400 mt-0.5">SLA 1 hari kerja</div>
            </Link>
            <Link href="/outbound" className="rounded-xl border border-gray-200 bg-white p-4 transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-gold-300">
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-gold-600 mb-2">
                <span className="rounded-md p-1 bg-gold-50"><Package size={15} /></span>
                Luar Kota (LK)
              </div>
              <div className="text-3xl font-bold text-indigo-900"><CountUp value={d.counts.outboundLK} /></div>
              <div className="text-xs text-gray-400 mt-0.5">SLA 5 hari kerja</div>
            </Link>
          </div>
        </div>

        {/* Row 2 Receiving + Crossdocking + Delivered */}
        <div className="mb-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-0.5">Operasional</p>
          <div className="grid grid-cols-3 gap-3">
            <Link href="/receiving" className="rounded-xl border border-gray-200 bg-white p-4 transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-emerald-300">
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 mb-2">
                <span className="rounded-md p-1 bg-emerald-50"><Warehouse size={15} /></span>
                Receiving PTR
              </div>
              <div className="text-3xl font-bold text-indigo-900"><CountUp value={d.counts.receivingMonth} /></div>
              <div className="text-xs text-gray-400 mt-0.5">dokumen masuk</div>
            </Link>
            <Link href="/crossdocking" className="rounded-xl border border-gray-200 bg-white p-4 transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-amber-300">
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 mb-2">
                <span className="rounded-md p-1 bg-amber-50"><ArrowLeftRight size={15} /></span>
                Crossdocking Aktif
              </div>
              <div className="text-3xl font-bold text-indigo-900"><CountUp value={d.counts.crossdockingActive} /></div>
              <div className="text-xs text-gray-400 mt-0.5">belum Delivered</div>
            </Link>
            <Link href="/shipment" className="rounded-xl border border-gray-200 bg-white p-4 transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-green-300">
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-600 mb-2">
                <span className="rounded-md p-1 bg-green-50"><PackageCheck size={15} /></span>
                Delivered Hari Ini
              </div>
              <div className="text-3xl font-bold text-indigo-900"><CountUp value={d.counts.deliveredToday} /></div>
              <div className="text-xs text-gray-400 mt-0.5">selesai hari ini</div>
            </Link>
          </div>
        </div>

        {/* Row 3: OTD + Status Shipment */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-gray-700">On-Time Delivery (OTD)</span>
              <span className="text-xs text-gray-400">{monthLabel(period)}</span>
            </div>
            {d.otd.total === 0 ? (
              <div className="text-sm text-gray-400 py-2">Belum ada shipment Delivered dengan data lengkap bulan ini.</div>
            ) : (
              <>
                <div className="flex items-end gap-3 mb-3">
                  <span className={`text-4xl font-bold ${(d.otd.rate ?? 0) >= 95 ? 'text-green-600' : (d.otd.rate ?? 0) >= 80 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {d.otd.rate ?? '—'}%
                  </span>
                  <div className="mb-1 text-xs text-gray-500 space-y-0.5">
                    <div className="text-green-600 font-medium">{d.otd.onTime} tepat waktu</div>
                    <div className="text-red-500 font-medium">{d.otd.late} terlambat</div>
                    <div className="text-gray-400">{d.otd.total} total</div>
                  </div>
                </div>
                <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                  <div className={`h-2 rounded-full ${(d.otd.rate ?? 0) >= 95 ? 'bg-green-500' : (d.otd.rate ?? 0) >= 80 ? 'bg-yellow-400' : 'bg-red-500'}`} style={{ width: `${d.otd.rate ?? 0}%` }} />
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-gray-400">
                  <span>Target ≥ 95%</span>
                  {(d.otd.rate ?? 0) >= 95
                    ? <span className="flex items-center gap-1 text-green-600"><TrendingUp size={11} /> Tercapai</span>
                    : <span className="flex items-center gap-1 text-red-500"><TrendingDown size={11} /> Di bawah target</span>}
                </div>
              </>
            )}
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-gray-700">Status Shipment Berjalan</span>
              <Link href="/shipment" className="text-xs text-indigo-600 hover:underline">Kelola →</Link>
            </div>
            <div className="space-y-2">
              {[
                { label: 'Draft', count: d.counts.draft, bar: 'bg-gray-400', text: 'text-gray-600' },
                { label: 'Dispatched', count: d.counts.dispatched, bar: 'bg-blue-400', text: 'text-blue-700' },
                { label: 'In Transit', count: d.counts.inTransit, bar: 'bg-orange-400', text: 'text-orange-700' },
              ].map(({ label, count, bar, text }) => {
                const total = d.counts.draft + d.counts.dispatched + d.counts.inTransit
                const pct = total > 0 ? Math.round((count / total) * 100) : 0
                return (
                  <div key={label} className="flex items-center gap-3">
                    <span className={`w-20 text-xs font-medium ${text}`}>{label}</span>
                    <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div className={`h-2 rounded-full ${bar}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className={`w-8 text-right text-sm font-bold ${text}`}>{count}</span>
                  </div>
                )
              })}
              <div className="pt-1 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
                <span>Total aktif</span>
                <span className="font-bold text-gray-600">{d.counts.draft + d.counts.dispatched + d.counts.inTransit}</span>
              </div>
              {d.counts.deliveredToday > 0 && (
                <div className="flex items-center gap-2 text-xs text-green-600 font-medium">
                  <CheckCircle2 size={12} /><span>{d.counts.deliveredToday} selesai hari ini</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ZONA 3 — AKTIVITAS HARI INI */}
      <section aria-label="Aktivitas hari ini">
        <h2 className="mb-3 text-base font-semibold text-gray-700 flex items-center gap-2">
          <Truck size={16} /> Aktivitas Hari Ini
        </h2>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">

          <div className="lg:col-span-2 rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <span className="text-sm font-semibold text-gray-700 flex items-center gap-2"><Truck size={14} /> Sedang Berjalan</span>
              <Link href="/shipment" className="text-xs text-indigo-600 hover:underline">Lihat semua →</Link>
            </div>
            {d.activeToday.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-400">Tidak ada shipment aktif saat ini.</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {d.activeToday.map((s: any) => {
                  const isLate = s.document_date ? d.today > slaDueDate(s.document_date, s.dk_lk) : false
                  return (
                    <div key={s.id} className={`flex items-center gap-3 px-4 py-3 ${isLate ? 'bg-red-50' : ''}`}>
                      <StatusBadge status={s.status} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-800 truncate">{s.customer_name ?? s.pss_no ?? `#${s.id}`}</div>
                        <div className="text-xs text-gray-400 truncate">{s.pss_no ?? (s.crossdocking_id ? `CD-${s.crossdocking_id}` : '')}{s.destination_city ? ` · ${s.destination_city}` : ''}</div>
                      </div>
                      <SlaStatus documentDate={s.document_date} dkLk={s.dk_lk ?? null} today={d.today} />
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
              <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                <span className="text-sm font-semibold text-gray-700 flex items-center gap-2"><Warehouse size={14} /> Receiving Terbaru</span>
                <Link href="/receiving" className="text-xs text-indigo-600 hover:underline">Lihat →</Link>
              </div>
              {d.recentPtr.length === 0 ? (
                <div className="px-4 py-4 text-xs text-gray-400">Belum ada PTR bulan ini.</div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {d.recentPtr.map(ptr => (
                    <div key={ptr.id} className="flex items-center justify-between px-4 py-2.5">
                      <div>
                        <div className="text-xs font-semibold text-gray-700">{ptr.ptr_no ?? '—'}</div>
                        <div className="text-xs text-gray-400">{ptr.transfer_from_code} → {ptr.transfer_to_code}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-gray-500">{ptr.posting_date?.slice(0, 10) ?? '—'}</div>
                        {ptr.ship_to_posting_days != null && (
                          <div className={`text-xs font-medium ${ptr.ship_to_posting_days > 7 ? 'text-red-500' : 'text-green-600'}`}>{ptr.ship_to_posting_days}h lead</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
              <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                <span className="text-sm font-semibold text-gray-700 flex items-center gap-2"><AlertTriangle size={14} /> Open Issues</span>
                <Link href="/issues" className="text-xs text-indigo-600 hover:underline">Lihat →</Link>
              </div>
              {d.openIssues.length === 0 ? (
                <div className="px-4 py-4 text-xs text-gray-400 flex items-center gap-2"><CheckCircle2 size={14} className="text-green-500" /> Tidak ada open issue.</div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {d.openIssues.map(iss => (
                    <div key={iss.issue_no} className="flex items-start gap-2 px-4 py-2.5">
                      <span className={`mt-0.5 shrink-0 text-xs rounded px-1.5 py-0.5 font-medium ${iss.status === 'In Progress' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'}`}>{iss.status}</span>
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-gray-700 truncate">{iss.title}</div>
                        {iss.due_date && <div className="text-xs text-gray-400">Due {iss.due_date}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      </section>

      {/* ZONA 4 — MENU CEPAT */}
      <section aria-label="Menu cepat">
        <h2 className="mb-3 text-base font-semibold text-gray-700 flex items-center gap-2">
          <Minus size={16} /> Menu Cepat
        </h2>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-6">
          {[
            { href: '/receiving',               label: 'Receiving',        icon: <Warehouse size={16} />,     color: 'text-emerald-600 bg-emerald-50' },
            { href: '/outbound',                label: 'Outbound',         icon: <Package size={16} />,        color: 'text-indigo-600 bg-indigo-50' },
            { href: '/crossdocking',            label: 'Crossdocking',     icon: <ArrowLeftRight size={16} />, color: 'text-amber-600 bg-amber-50' },
            { href: '/shipment',                label: 'Shipment',         icon: <Truck size={16} />,          color: 'text-blue-600 bg-blue-50' },
            { href: '/shipment-cost',           label: 'Shipment Cost',    icon: <TrendingUp size={16} />,     color: 'text-gold-600 bg-gold-50' },
            { href: '/service-level',           label: 'Service Level',    icon: <CheckCircle2 size={16} />,   color: 'text-teal-600 bg-teal-50' },
            { href: '/inventory',               label: 'Inventory',        icon: <Warehouse size={16} />,      color: 'text-orange-600 bg-orange-50' },
            { href: '/issues',                  label: 'Issue Log',        icon: <AlertTriangle size={16} />,  color: 'text-red-600 bg-red-50' },
            { href: '/master-data',             label: 'Master Data',      icon: <Minus size={16} />,          color: 'text-gray-600 bg-gray-100' },
            { href: '/shipment/budget-request', label: 'Pengajuan Dana',   icon: <TrendingDown size={16} />,   color: 'text-pink-600 bg-pink-50' },
            { href: '/warehouse-checklist',     label: 'Warehouse Check',  icon: <CheckCircle2 size={16} />,   color: 'text-green-600 bg-green-50' },
          ].map(({ href, label, icon, color }) => (
            <Link key={href} href={href} className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-700 transition-all hover:border-gray-300 hover:bg-gray-50 hover:-translate-y-0.5 hover:shadow-sm">
              <span className={`rounded-lg p-1.5 ${color}`}>{icon}</span>
              {label}
            </Link>
          ))}
        </div>
      </section>

    </div>
  )
}
