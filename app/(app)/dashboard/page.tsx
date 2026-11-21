import Link from 'next/link'
import { AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, Clock3, Info, Minus } from 'lucide-react'
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import DashboardPeriodSelect from '@/components/dashboard/DashboardPeriodSelect'
import { FulfillmentTrend, TransporterOtif } from '@/components/dashboard/FulfillmentCharts'
import { addWorkingDaysAt, jakartaToday, workingDaysSince, PTS_PENDING_REMINDER_DAYS } from '@/lib/sla'
import { parseWib, wibToday } from '@/lib/wib-time'
import { getPendingPts } from '@/app/(app)/crossdocking/actions'
import { getChargeOnlyPss } from '@/lib/charge-only-pss'
import { OTIF_TARGET, byTransporter, loadFulfillmentItems, summarize, weeklyTrend, type FulfillmentSummary } from '@/lib/fulfillment-metrics'

export const dynamic = 'force-dynamic'

/**
 * Dashboard L1 "Pengiriman & Fulfillment" (docs/dashboard-spec.md, skill bi-dashboard-design +
 * supply-chain-order-fulfillment-dashboard). Tepat waktu = SLA DK 1 / LK 5 hari kerja dari jam dokumen.
 */

// Data aktual dimulai dari November 2026.
const DATA_START = '2026-11-01'

function addMonths(month: string, delta: number) {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return d.toISOString().slice(0, 7)
}

function monthLabel(month: string) {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('id-ID', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

function availableMonths() {
  const months: string[] = []
  for (let m = jakartaToday().slice(0, 7); m >= DATA_START.slice(0, 7); m = addMonths(m, -1)) months.push(m)
  return months
}

const fmtPct = (v: number | null) => (v == null ? '-' : `${v.toLocaleString('id-ID', { maximumFractionDigits: 1 })}%`)
// Waktu kirim: jam bila kurang dari 2 hari (kebanyakan DK), selain itu hari.
const fmtDays = (v: number | null) => (v == null ? '-' : v < 2 ? `${(v * 24).toLocaleString('id-ID', { maximumFractionDigits: 1 })} jam` : `${v.toLocaleString('id-ID', { maximumFractionDigits: 1 })} hari`)
const fmtRp = (v: number | null) => (v == null ? '-' : `Rp ${v >= 1_000_000 ? `${(v / 1_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} jt` : `${Math.round(v / 1000).toLocaleString('id-ID')} rb`}`)
const fmtWib = (d: Date, withTime = true) =>
  d.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}) })

type ActionRow = { kind: 'Lewat SLA' | 'Jatuh tempo' | 'Belum dikirim' | 'Crossdocking' | 'PTS'; ref: string; who: string; due: Date | null; note: string; href: string }

async function getDashboardData(period: string) {
  const now = new Date()
  const today = jakartaToday(now)
  const prior = addMonths(period, -1)
  const periodEnd = `${addMonths(period, 1)}-01`

  // Semua PSS sejak awal data (untuk tren, backlog dan bulan pembanding), lalu dipilah per bulan dokumen.
  const items = await loadFulfillmentItems(supabase, DATA_START, `${addMonths(today.slice(0, 7), 1)}-01`)
  const monthOf = (d: Date) => wibToday(d).slice(0, 7)
  const current = items.filter(i => monthOf(i.createdAt) === period)
  const previous = items.filter(i => monthOf(i.createdAt) === prior)

  // PSS di Outbound yang belum dibuat shipment (selain ongkos kirim).
  const { data: outbound } = await supabase
    .from('outbound_header')
    .select('pss_no, shipment_no, customer_name, document_created_at, document_date, customer_no')
    .gte('document_date', DATA_START).lt('document_date', periodEnd)
  const outboundNos = (outbound ?? []).map((r: any) => String(r.pss_no ?? r.shipment_no ?? '').trim()).filter(Boolean)
  const [chargeOnly, tracked, customers] = await Promise.all([
    getChargeOnlyPss(supabase, outboundNos),
    outboundNos.length
      ? supabase.from('shipment_tracking').select('pss_no').in('pss_no', outboundNos).neq('status', 'Failed Delivery')
      : Promise.resolve({ data: [] as any[] }),
    supabase.from('customers').select('customer_code, dk_lk'),
  ])
  const trackedSet = new Set(((tracked as any).data ?? []).map((r: any) => String(r.pss_no).trim()))
  const dkLkByCode = new Map(((customers as any).data ?? []).map((c: any) => [String(c.customer_code), c.dk_lk]))
  const untracked = (outbound ?? [])
    .map((r: any) => ({ ...r, key: String(r.pss_no ?? r.shipment_no ?? '').trim() }))
    .filter((r: any) => r.key && !trackedSet.has(r.key) && !chargeOnly.has(r.key))
    .map((r: any) => {
      const created = parseWib(r.document_created_at || r.document_date) ?? now
      const dkLk = dkLkByCode.get(String(r.customer_no)) === 'DK' ? 'DK' : 'LK'
      return { ref: r.key, who: r.customer_name ?? '-', due: addWorkingDaysAt(created, dkLk === 'DK' ? 1 : 5), dkLk, month: monthOf(created) }
    })

  // Shipment terbuka (semua bulan): lewat jatuh tempo, atau jatuh tempo sampai akhir hari kerja berikutnya.
  const soon = addWorkingDaysAt(new Date(`${today}T23:59:00+07:00`), 1)
  const open = items.filter(i => !i.deliveredAt && i.status !== 'Failed Delivery')
  const overdueOpen = open.filter(i => i.dueAt < now)

  const [crossdocking, pendingPts] = await Promise.all([
    supabase.from('crossdocking_header')
      .select('id, crossdocking_no, customer_name, promised_delivery_date, status')
      .lte('promised_delivery_date', wibToday(new Date(now.getTime() + 3 * 86_400_000)))
      .gte('promised_delivery_date', DATA_START)
      .not('status', 'eq', 'Delivered')
      .order('promised_delivery_date', { ascending: true }).limit(20),
    getPendingPts(DATA_START).catch(() => []),
  ])
  const shippedCd = new Set(items.filter(i => i.key.startsWith('CD:') && i.status !== 'Failed Delivery').map(i => Number(i.key.slice(3))))

  const actions: ActionRow[] = [
    ...overdueOpen.map(i => ({ kind: 'Lewat SLA' as const, ref: i.ref, who: i.customer ?? '-', due: i.dueAt, note: `${i.dkLk} · ${i.transporter}`, href: '/shipment' })),
    ...open.filter(i => i.dueAt >= now && i.dueAt <= soon).map(i => ({ kind: 'Jatuh tempo' as const, ref: i.ref, who: i.customer ?? '-', due: i.dueAt, note: `${i.dkLk} · ${i.transporter}`, href: '/shipment' })),
    ...untracked.filter(u => u.due <= soon).map(u => ({ kind: 'Belum dikirim' as const, ref: u.ref, who: u.who, due: u.due, note: `${u.dkLk} · belum ada shipment`, href: '/shipment' })),
    ...((crossdocking.data ?? []) as any[]).filter(c => !shippedCd.has(Number(c.id))).map(c => ({
      kind: 'Crossdocking' as const, ref: c.crossdocking_no ?? `CD-${c.id}`, who: c.customer_name ?? '-',
      due: parseWib(c.promised_delivery_date), note: 'Promised date mepet', href: '/crossdocking',
    })),
    ...pendingPts.map(p => ({ ...p, days: workingDaysSince(p.document_date, today) })).filter(p => p.days > PTS_PENDING_REMINDER_DAYS).map(p => ({
      kind: 'PTS' as const, ref: p.pts_no, who: 'Belum Crossdocking / Realokasi', due: null, note: `${p.days} hari kerja`, href: '/crossdocking',
    })),
  ].sort((a, b) => (a.due?.getTime() ?? Infinity) - (b.due?.getTime() ?? Infinity))

  return {
    now,
    period,
    prior,
    current: summarize(current, now),
    previous: summarize(previous, now),
    backlog: { untracked: untracked.filter(u => u.month <= period).length, overdueOpen: overdueOpen.length },
    trend: weeklyTrend(items, now),
    transporters: byTransporter(current, now),
    actions,
  }
}

// ─── komponen ─────────────────────────────────────────────────────────────────

function Delta({ now, before, unit, higherIsBetter }: { now: number | null; before: number | null; unit: 'pp' | 'hari' | 'rp'; higherIsBetter: boolean }) {
  if (now == null || before == null) return <span className="text-xs text-slate-400">Bln lalu: belum ada data</span>
  const diff = now - before
  const flat = Math.abs(diff) < (unit === 'rp' ? 1000 : unit === 'hari' ? 0.02 : 0.05)
  const good = flat ? null : (diff > 0) === higherIsBetter
  const text = unit === 'pp'
    ? `${diff > 0 ? '+' : ''}${diff.toLocaleString('id-ID', { maximumFractionDigits: 1 })} pp`
    : unit === 'hari'
      ? `${diff > 0 ? '+' : ''}${Math.abs(diff) < 2 ? `${(diff * 24).toLocaleString('id-ID', { maximumFractionDigits: 1 })} jam` : `${diff.toLocaleString('id-ID', { maximumFractionDigits: 1 })} hari`}`
      : `${diff > 0 ? '+' : '−'}${fmtRp(Math.abs(diff)).replace('Rp ', 'Rp ')}`
  const Icon = flat ? Minus : diff > 0 ? ArrowUpRight : ArrowDownRight
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${good == null ? 'text-slate-500' : good ? 'text-[#2F6B44]' : 'text-[#9D3D31]'}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />{text} <span className="font-normal text-slate-400">vs bln lalu</span>
    </span>
  )
}

function KpiCard({ label, value, hint, status, children, href }: {
  label: string; value: string; hint: string; status?: 'good' | 'warn' | 'bad'; children?: React.ReactNode; href?: string
}) {
  const dot = status === 'good' ? 'bg-[#2F6B44]' : status === 'warn' ? 'bg-[#9A6C20]' : status === 'bad' ? 'bg-[#9D3D31]' : null
  const statusLabel = status === 'good' ? 'Sesuai target' : status === 'warn' ? 'Mendekati target' : status === 'bad' ? 'Di bawah target' : undefined
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-[13px] font-medium text-slate-500">
          {dot && <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} title={statusLabel} aria-label={statusLabel} role="img" />}
          {label}
        </span>
        <span title={hint} className="text-slate-300"><Info className="h-3.5 w-3.5" aria-label={hint} /></span>
      </div>
      <div className="kpi-value mt-2">{value}</div>
      <div className="mt-1.5 min-h-4">{children}</div>
    </>
  )
  const className = 'block rounded-xl border border-slate-200 bg-white p-5'
  return href ? <Link href={href} className={className}>{body}</Link> : <div className={className}>{body}</div>
}

function statusFor(value: number | null, target: number) {
  if (value == null) return undefined
  return value >= target ? 'good' : value >= target - 15 ? 'warn' : 'bad'
}

function FailureSplit({ s }: { s: FulfillmentSummary }) {
  const rows = [
    { label: 'Terlambat (lewat SLA)', value: s.failures.late, color: '#B7623A' },
    { label: 'Gagal kirim', value: s.failures.failed, color: '#355B73' },
    { label: 'Lewat SLA, belum terkirim', value: s.failures.overdueOpen, color: '#9D3D31' },
  ]
  const total = rows.reduce((sum, r) => sum + r.value, 0)
  if (!total) return <p className="py-10 text-center text-sm text-slate-400">Tidak ada PSS gagal OTIF. 🎉</p>
  return (
    <div className="space-y-4">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100" role="img" aria-label="Komposisi PSS yang gagal OTIF">
        {rows.filter(r => r.value).map(r => <div key={r.label} style={{ width: `${(r.value / total) * 100}%`, background: r.color }} />)}
      </div>
      <ul className="space-y-2.5">
        {rows.map(r => (
          <li key={r.label} className="flex items-center gap-2.5 text-sm">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: r.color }} aria-hidden="true" />
            <span className="flex-1 text-slate-600">{r.label}</span>
            <span className="font-semibold tabular-nums text-slate-900">{r.value}</span>
            <span className="w-12 text-right text-xs tabular-nums text-slate-400">{Math.round((r.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-slate-400">{total} dari {s.measurable} PSS terukur tidak OTIF.</p>
    </div>
  )
}

const KIND_STYLE: Record<ActionRow['kind'], string> = {
  'Lewat SLA': 'bg-red-50 text-[#9D3D31]',
  'Jatuh tempo': 'bg-amber-50 text-[#9A6C20]',
  'Belum dikirim': 'bg-orange-50 text-orange-700',
  Crossdocking: 'bg-slate-100 text-slate-700',
  PTS: 'bg-slate-100 text-slate-700',
}

function Panel({ title, subtitle, action, children, className = '' }: { title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white p-4 ${className}`}>
      <header className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  )
}

// ─── halaman ──────────────────────────────────────────────────────────────────

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const params = await searchParams
  const months = availableMonths()
  const period = months.includes(params.period ?? '') ? (params.period as string) : months[0]
  const d = await getDashboardData(period)
  const c = d.current
  const p = d.previous
  const backlogTotal = d.backlog.untracked + d.backlog.overdueOpen
  const counts = d.actions.reduce<Record<string, number>>((acc, a) => ({ ...acc, [a.kind]: (acc[a.kind] ?? 0) + 1 }), {})

  return (
    <div className="space-y-4">
      {/* Header: judul, cakupan, basis ukur, waktu data, filter periode */}
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Pengiriman & Fulfillment</h1>
          {/* div, bukan p: globals.css menyembunyikan "h1 + p" di halaman lain. */}
          <div className="mt-1 text-sm text-slate-500">
            {monthLabel(d.period)} · per PSS · tepat waktu = SLA DK 1 / LK 5 hari kerja dari jam dokumen · data {fmtWib(d.now)} WIB
          </div>
        </div>
        <DashboardPeriodSelect period={d.period} months={months} />
      </header>

      {/* Baris 1: KPI (hasil → pendorong → kesehatan) */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="OTIF" value={fmtPct(c.otif)} status={statusFor(c.otif, OTIF_TARGET)} href="/shipment"
          hint="On Time In Full: terkirim sebelum jatuh tempo SLA dan tanpa gagal kirim, dibagi PSS terukur (sudah terkirim, gagal, atau lewat jatuh tempo).">
          <div className="text-xs text-slate-500">Target {OTIF_TARGET}% · {c.otifCount}/{c.measurable} PSS</div>
          <Delta now={c.otif} before={p.otif} unit="pp" higherIsBetter />
        </KpiCard>
        <KpiCard label="On-time" value={fmtPct(c.onTime)} hint="Terkirim sebelum jatuh tempo SLA (DK 1 / LK 5 hari kerja), dibagi PSS terukur.">
          <Delta now={c.onTime} before={p.onTime} unit="pp" higherIsBetter />
        </KpiCard>
        <KpiCard label="Terkirim tanpa gagal" value={fmtPct(c.success)} hint="PSS yang terkirim tanpa pernah tercatat gagal kirim, dibagi PSS terukur (pengganti 'In Full').">
          <Delta now={c.success} before={p.success} unit="pp" higherIsBetter />
        </KpiCard>
        <KpiCard label="Waktu kirim" value={fmtDays(c.cycleDays)} hint="Median waktu dari jam dokumen PSS dibuat sampai diterima customer (hari kalender).">
          <Delta now={c.cycleDays} before={p.cycleDays} unit="hari" higherIsBetter={false} />
        </KpiCard>
        <KpiCard label="Backlog" value={`${backlogTotal} PSS`} status={backlogTotal ? 'bad' : 'good'} href="/shipment"
          hint="PSS belum dibuat shipment ditambah shipment terbuka yang sudah lewat jatuh tempo SLA. Target 0.">
          <div className="text-xs text-slate-500">{d.backlog.untracked} belum dikirim · {d.backlog.overdueOpen} lewat SLA</div>
        </KpiCard>
        <KpiCard label="Biaya per PSS" value={fmtRp(c.costPerPss)} href="/shipment-cost"
          hint="Rata-rata total biaya kirim per PSS terkirim yang biayanya sudah diisi di Shipment Cost.">
          <div className="text-xs text-slate-500">dari {c.costedCount} PSS berbiaya</div>
          <Delta now={c.costPerPss} before={p.costPerPss} unit="rp" higherIsBetter={false} />
        </KpiCard>
      </div>

      {/* Baris 2: tren (8 kolom) + komposisi gagal (4 kolom) */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        <Panel className="lg:col-span-8" title="OTIF per minggu" subtitle="Minggu dokumen dibuat · garis putus-putus = target">
          <FulfillmentTrend data={d.trend} target={OTIF_TARGET} />
          <div className="mt-2 flex gap-4 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-[#1F3B34]" />OTIF</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-[#A9813F]" />On-time</span>
          </div>
        </Panel>
        <Panel className="lg:col-span-4" title="Kenapa tidak OTIF?" subtitle={monthLabel(d.period)}>
          <FailureSplit s={c} />
        </Panel>
      </div>

      {/* Baris 3: transporter (6 kolom) + tabel tindakan (6 kolom) */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        <Panel className="lg:col-span-6" title="OTIF per transporter" subtitle={`${monthLabel(d.period)} · (jumlah PSS) · garis = target ${OTIF_TARGET}%`}>
          <TransporterOtif data={d.transporters} target={OTIF_TARGET} />
        </Panel>
        <Panel
          className="lg:col-span-6"
          title="Perlu tindakan"
          subtitle={Object.entries(counts).map(([k, v]) => `${v} ${k.toLowerCase()}`).join(' · ') || 'Tidak ada yang mendesak'}
          action={<Link href="/shipment" className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900">Shipment <ArrowRight className="h-3.5 w-3.5" /></Link>}
        >
          {d.actions.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">Semua aman. Tidak ada PSS lewat atau mendekati SLA.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="pb-2 pr-2">Jenis</th><th className="pb-2 pr-2">Dokumen</th><th className="pb-2 pr-2">Customer</th><th className="pb-2 text-right">Jatuh tempo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {d.actions.slice(0, 7).map(a => (
                  <tr key={`${a.kind}-${a.ref}`}>
                    <td className="py-2 pr-2"><span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${KIND_STYLE[a.kind]}`}>{a.kind === 'Lewat SLA' ? <AlertTriangle className="h-3 w-3" /> : <Clock3 className="h-3 w-3" />}{a.kind}</span></td>
                    <td className="py-2 pr-2"><Link href={a.href} className="font-mono text-xs font-semibold text-slate-800 hover:underline">{a.ref}</Link></td>
                    <td className="max-w-0 py-2 pr-2"><div className="truncate text-slate-700" title={a.who}>{a.who}</div><div className="truncate text-xs text-slate-400">{a.note}</div></td>
                    <td className="whitespace-nowrap py-2 text-right text-xs tabular-nums text-slate-600">{a.due ? fmtWib(a.due) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {d.actions.length > 7 && <p className="mt-2 text-xs text-slate-400">+{d.actions.length - 7} lainnya di halaman Shipment dan Crossdocking.</p>}
        </Panel>
      </div>

      <footer className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
        <span>Definisi: arahkan kursor ke ikon <Info className="inline h-3 w-3" /> di setiap kartu.</span>
        <span>PSS ongkos kirim (BIA-…) tidak dihitung.</span>
        <span>Data sejak {monthLabel(DATA_START.slice(0, 7))}.</span>
      </footer>
    </div>
  )
}
