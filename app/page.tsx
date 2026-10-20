import Link from 'next/link'
import { CustomerStockMapClient } from '@/components/customer-stock-map/CustomerStockMapClient'
import { LogoutButton } from '@/components/auth/LogoutButton'
import { ArrowLeftRight, ArrowRight, BarChart3, Boxes, ChartNoAxesCombined, ClipboardCheck, DollarSign, Factory, Home, Layers3, Package, ShieldAlert, Target, Truck, Users, Warehouse, Weight, Activity } from 'lucide-react'
import { getLandingPageData } from '@/lib/landing-page-data'

const iconMap = {
  Target,
  Boxes,
  ClipboardCheck,
  Users,
  Truck,
  ShieldAlert,
  Factory,
}

const desktopNavItems = [
  ['Receiving', '/receiving', Package],
  ['Outbound', '/outbound', Truck],
  ['Crossdocking', '/crossdocking', ArrowLeftRight],
  ['Shipment', '/shipment', Truck],
  ['Shipment Cost', '/shipment-cost', DollarSign],
] as const

const toneMap: Record<string, string> = {
  blue: 'text-[#007AFF] border-[#E5E5EA]',
  green: 'text-[#248A3D] border-[#E5E5EA]',
  orange: 'text-[#C93400] border-[#E5E5EA]',
  red: 'text-[#D70015] border-[#E5E5EA]',
}

export default async function LandingPage() {
  const data = await getLandingPageData()

  const areas = [
    { n: '01', title: 'Strategy & Planning', desc: 'Control room untuk roadmap, target layanan, kapasitas, dan prioritas eksekusi SCM.', href: '/dashboard', icon: iconMap.Target, tone: 'blue', metrics: data.areas[0].metrics },
    { n: '02', title: 'Inventory Management', desc: 'Pantau stok, movement, slow moving, safety stock, dan sinyal risiko kekurangan barang.', href: '/inventory', icon: iconMap.Boxes, tone: 'green', metrics: data.areas[1].metrics },
    { n: '03', title: 'Procurement', desc: 'Kelola kebutuhan pengadaan, supplier lead time, harga, dan pemenuhan PO.', href: '/master-data', icon: iconMap.ClipboardCheck, tone: 'orange', metrics: data.areas[2].metrics },
    { n: '04', title: 'Vendor Management', desc: 'Lihat performa vendor, SLA, POD, coverage, rate card, dan issue transport.', href: '/vendor', icon: iconMap.Users, tone: 'blue', metrics: data.areas[3].metrics },
    { n: '05', title: 'Logistics & Distribution', desc: 'Tracking shipment, rute, ETA, delay, status POD, dan pengiriman sampai selesai.', href: '/shipment', icon: iconMap.Truck, tone: 'red', metrics: data.areas[4].metrics },
    { n: '06', title: 'Risk Management', desc: 'Satu tempat untuk issue log, mitigasi, severity, owner, dan tindak lanjut operasional.', href: '/issues', icon: iconMap.ShieldAlert, tone: 'orange', metrics: data.areas[5].metrics },
    { n: '07', title: 'Warehouse Management', desc: 'Monitor receiving, outbound, checklist gudang, staging, dock, equipment, dan produktivitas.', href: '/receiving', icon: iconMap.Factory, tone: 'green', metrics: data.areas[6].metrics },
  ]

  return (
    <main className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F] selection:bg-[#007AFF] selection:text-white lg:pl-64">
      <nav aria-label="Navigasi Control Tower" className="fixed inset-x-0 top-0 z-50 border-b border-[#D2D2D7]/70 bg-white/80 backdrop-blur-2xl lg:inset-y-0 lg:right-auto lg:w-64 lg:border-b-0 lg:border-r">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 md:px-8 lg:h-full lg:max-w-none lg:flex-col lg:items-stretch lg:justify-start lg:px-4 lg:py-6">
          <a href="#intro" className="flex items-center gap-3 rounded-xl px-2 py-1.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#1D1D1F] text-sm font-semibold text-white shadow-sm">SC</span>
            <span><span className="block text-sm font-semibold tracking-tight">SCM Control Tower</span><span className="mt-0.5 block text-xs text-[#6E6E73]">Medan workspace</span></span>
          </a>
          <div className="hidden w-full space-y-7 pt-10 lg:block">
            <div>
              <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#86868B]">Workspace</p>
              <a href="#intro" className="flex items-center gap-3 rounded-xl bg-[#007AFF]/10 px-3 py-2.5 text-sm font-medium text-[#0066CC]">
                <Home size={17} aria-hidden="true" />
                <span>Overview</span>
              </a>
            </div>
            <div>
              <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#86868B]">Operations</p>
              <div className="space-y-1">
                {desktopNavItems.map(([label, href, Icon]) => (
                  <Link key={href} href={href} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[#6E6E73] transition-colors hover:bg-black/[0.04] hover:text-[#1D1D1F]">
                    <Icon size={17} aria-hidden="true" />
                    <span>{label}</span>
                  </Link>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#86868B]">Monitoring</p>
              <div className="space-y-1">
                <Link href="/inventory" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[#6E6E73] transition-colors hover:bg-black/[0.04] hover:text-[#1D1D1F]"><Warehouse size={17} aria-hidden="true" /><span>Inventory</span></Link>
                <Link href="/issues" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[#6E6E73] transition-colors hover:bg-black/[0.04] hover:text-[#1D1D1F]"><ChartNoAxesCombined size={17} aria-hidden="true" /><span>Issue Log</span></Link>
              </div>
            </div>
          </div>
          <div className="ml-auto lg:mt-auto lg:ml-0 lg:w-full lg:border-t lg:border-[#E5E5EA] lg:pt-4">
            <LogoutButton />
          </div>
        </div>
      </nav>

      <section id="intro" className="relative min-h-screen scroll-mt-24 snap-start overflow-hidden px-5 pb-12 pt-24 md:px-8 md:pb-16 lg:flex lg:items-center lg:py-24">
        <div className="absolute left-1/2 top-28 h-72 w-72 -translate-x-1/2 rounded-full bg-[#007AFF]/10 blur-3xl" />
        <div className="absolute bottom-24 right-10 h-80 w-80 rounded-full bg-[#A7C7FF]/15 blur-3xl" />
        <div className="mx-auto grid w-full max-w-7xl items-center gap-10 lg:grid-cols-[1.05fr_.95fr] lg:gap-12">

          <div className="relative animate-rise">
            <div className="mb-4 inline-flex rounded-full border border-[#D2D2D7] bg-white/80 px-4 py-2 text-sm text-[#6E6E73]">
              Supply Chain command center untuk operasi harian
            </div>
            <h1 className="max-w-4xl text-4xl font-semibold leading-[1.1] tracking-[-0.04em] sm:text-5xl xl:text-6xl">
              Satu layar untuk membaca ritme seluruh supply chain.
            </h1>
            <p className="mt-4 max-w-none text-base leading-7 text-[#6E6E73] sm:text-lg xl:max-w-2xl">
              Ringkasan 7 area fungsi SCM dalam satu tempat — dengan indikator operasional dan akses langsung ke modul sesuai hak pengguna.
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <Link href="/dashboard" className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#007AFF] px-6 py-3 font-medium text-white transition-colors hover:bg-[#0066D6]">
                Buka Dashboard <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </Link>
              <a href="#areas" className="inline-flex min-h-12 items-center justify-center rounded-full border border-[#D2D2D7] bg-white/80 px-6 py-3 font-medium transition-colors hover:bg-white">Lihat 7 area fungsi</a>
            </div>
          </div>

          <div className="relative animate-rise-delay">
            <div className="rounded-[1.75rem] border border-[#E5E5EA] bg-white/80 p-4 shadow-[0_8px_30px_rgba(0,0,0,0.06)] backdrop-blur-2xl">
              <div className="rounded-[1.25rem] bg-[#F5F5F7] p-5">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-[#7D7A75]">Today overview</p>
                    <h2 className="text-xl font-semibold">SCM Pulse</h2>
                  </div>
                  <BarChart3 className="text-[#007AFF]" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Shipment', value: data.scmPulse.shipment, unavailable: false },
                    { label: 'Receiving', value: data.scmPulse.receiving, unavailable: false },
                    { label: 'Outbound', value: data.scmPulse.outbound, unavailable: false },
                    { label: 'Inventory', value: data.scmPulse.inventory, unavailable: data.scmPulse.inventory == null },
                  ].map((x) => (
                    <div key={x.label} className="rounded-2xl border border-[#E5E5EA] bg-white p-4">
                      <div className="text-xs text-[#6E6E73]">{x.label}</div>
                      <div className="mt-2 text-3xl font-semibold">{x.value ?? '—'}</div>
                      {x.unavailable && <div className="mt-1 text-xs text-[#6E6E73]">Data belum tersedia</div>}
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-2xl border border-[#E5E5EA] bg-white p-4">
                  <div className="mb-3 flex justify-between gap-3 text-sm"><span>On-time delivery (OTD)</span><span className="font-medium text-[#248A3D]">{data.scmPulse.operationalReadiness == null ? '—' : `${data.scmPulse.operationalReadiness}%`}</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#E5E5EA]"><div className="h-full rounded-full bg-[#248A3D]" style={{ width: `${data.scmPulse.operationalReadiness ?? 0}%` }} /></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 py-10 md:px-8">
        <div className="mx-auto grid max-w-7xl gap-6 rounded-[1.75rem] border border-[#E5E5EA] bg-white/80 p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)] md:p-10 xl:grid-cols-[1.1fr_.9fr] xl:gap-10">
          <div className="xl:grid xl:grid-cols-2 xl:content-start xl:gap-4">
            <div className="xl:col-span-2">
              <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-[#007AFF]">
                <Activity className="h-5 w-5" />
                Inbound load profile
              </div>
              <h2 className="mt-4 max-w-xl text-3xl font-semibold leading-[1.15] tracking-[-0.03em] text-[#1D1D1F] md:text-4xl">
                Receiving Insight
              </h2>
            </div>
            <div className="mt-7 grid grid-cols-2 gap-3 xl:col-span-2 xl:mt-0 xl:grid-cols-3">
              <LoadMetric icon={<Layers3 className="h-4 w-4" />} label="Quantity" value={data.receivingAI.load.quantity.toLocaleString('id-ID')} />
              <LoadMetric icon={<Activity className="h-4 w-4" />} label="Volume" value={`${data.receivingAI.load.volumeCbm.toFixed(1)} m³`} />
              <LoadMetric icon={<Weight className="h-4 w-4" />} label="Tonase" value={`${data.receivingAI.load.tonnage.toFixed(1)} ton`} />
            </div>
            <div className="mt-4 rounded-xl border border-[#E5E5EA] bg-[#F5F5F7] p-4 xl:mt-0">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-[#6E6E73]">
                <span>Rata-rata load / bulan</span>
                <span>{data.receivingAI.trend.length} bulan</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm xl:grid-cols-4">
                <div><div className="text-xs text-slate-500">Quantity</div><div className="font-bold text-slate-900">{data.receivingAI.monthlyAverage.quantity.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</div></div>
                <div><div className="text-xs text-slate-500">Volume</div><div className="font-bold text-slate-900">{data.receivingAI.monthlyAverage.volumeCbm.toFixed(1)} m³</div></div>
                <div><div className="text-xs text-slate-500">Tonase</div><div className="font-bold text-slate-900">{data.receivingAI.monthlyAverage.tonnage.toFixed(1)} ton</div></div>
                <div><div className="text-xs text-slate-500">Pallet</div><div className="font-bold text-slate-900">{data.receivingAI.monthlyAverage.pallets.toFixed(0)}</div></div>
              </div>
            </div>
            <div className="mt-4 rounded-xl border border-[#E5E5EA] bg-white p-4 xl:mt-0">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-[#6E6E73]"><span>Lead time pengiriman</span><span>Rata-rata hari</span></div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-indigo-50 p-3"><div className="text-xs text-slate-500">NIJ · 1–3 hari</div><div className="mt-1 font-bold text-slate-900">{data.receivingAI.leadTime.nij.count} PTR</div><div className="text-xs text-slate-500">Rata-rata {data.receivingAI.leadTime.nij.averageDays.toFixed(1)} hari</div></div>
                <div className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-slate-500">From lainnya</div><div className="mt-1 font-bold text-slate-900">{data.receivingAI.leadTime.other.count} PTR</div><div className="text-xs text-slate-500">Rata-rata {data.receivingAI.leadTime.other.averageDays.toFixed(1)} hari</div></div>
              </div>
              <div className="mt-4 border-t border-slate-100 pt-3">
                <div className="mb-2 flex items-center gap-3 text-xs text-slate-600"><span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-indigo-500" /> NIJ</span><span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-slate-400" /> From lainnya</span></div>
                <div className="grid grid-cols-3 items-end gap-3 sm:grid-cols-6 xl:grid-cols-3">
                  {data.receivingAI.leadTimeTrend.map(point => {
                    const maxDays = Math.max(...data.receivingAI.leadTimeTrend.map(item => Math.max(item.nij, item.other)), 1)
                    return <div key={point.month} className="flex flex-col items-center gap-1"><div className="flex h-16 w-full items-end gap-0.5"><div className="w-1/2 rounded-t bg-indigo-500" style={{ height: `${Math.max(point.nij ? 8 : 0, (point.nij / maxDays) * 100)}%` }} /><div className="w-1/2 rounded-t bg-slate-400" style={{ height: `${Math.max(point.other ? 8 : 0, (point.other / maxDays) * 100)}%` }} /></div><span className="text-xs text-slate-600">{point.month.slice(5)}</span><span className="text-xs font-semibold text-slate-700">{point.nij.toFixed(1)} / {point.other.toFixed(1)}</span></div>
                  })}
                </div>
              </div>
            </div>
            <div className="mt-4 rounded-xl border border-[#CDECCF] bg-[#F2FBF3] p-4 xl:col-span-2 xl:mt-0">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-[#248A3D]">
                <span>PTR lead time &lt; 3 hari</span>
                <span>{data.receivingAI.fastPtrs.length} PTR</span>
              </div>
              {data.receivingAI.fastPtrs.length ? (
                <details className="mt-2">
                  <summary className="w-fit cursor-pointer rounded-lg px-2 py-2 text-sm font-medium text-[#187A2F] underline decoration-[#248A3D]/40 underline-offset-4 hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF]">
                    Lihat {data.receivingAI.fastPtrs.length} PTR
                  </summary>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {data.receivingAI.fastPtrs.map(ptr => <li key={ptr.ptrNo} className="rounded-md bg-white px-2 py-1 font-mono text-xs font-semibold text-slate-700 shadow-sm">{ptr.ptrNo} · {ptr.leadTime} hari</li>)}
                  </ul>
                </details>
              ) : <p className="mt-2 text-sm text-slate-600">Tidak ada PTR dengan lead time di bawah 3 hari.</p>}
              <div className="mt-3 border-t border-[#CDECCF] pt-3 text-sm text-slate-600">
                Rata-rata setelah PTR &lt; 3 hari dikeluarkan: <strong className="text-slate-900">{data.receivingAI.averageAfterFast.toFixed(1)} hari</strong>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[#E5E5EA] bg-[#F5F5F7] p-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Receiving load trend</p>
              <span className="text-xs font-semibold text-indigo-600">6 bulan</span>
            </div>
            <div className="mt-5 space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="text-xs text-slate-500">Volume</div><div className="mt-1 text-lg font-bold text-slate-900">{data.receivingAI.load.volumeCbm.toFixed(1)} m³</div></div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="text-xs text-slate-500">Tonase</div><div className="mt-1 text-lg font-bold text-slate-900">{data.receivingAI.load.tonnage.toFixed(1)} ton</div></div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="text-xs text-slate-500">Pallet</div><div className="mt-1 text-lg font-bold text-slate-900">{data.receivingAI.load.pallets.toLocaleString('id-ID')}</div></div>
              </div>
              <div className="border-t border-slate-100 pt-4">
                <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-400"><span>Inbound trend / bulan</span><span>{data.receivingAI.trend.reduce((sum, point) => sum + point.count, 0)} PTR</span></div>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-600"><span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-indigo-500" /> PTR</span><span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-cyan-500" /> Volume</span><span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-emerald-500" /> Pallet</span><span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-amber-500" /> Tonase</span></div>
                <div className="mt-3 grid grid-cols-3 items-end gap-3 sm:grid-cols-6">
                  {data.receivingAI.trend.map(point => {
                    const maxCount = Math.max(...data.receivingAI.trend.map(item => item.count), 1)
                    const maxVolume = Math.max(...data.receivingAI.trend.map(item => item.volumeCbm), 1)
                    const maxPallets = Math.max(...data.receivingAI.trend.map(item => item.pallets), 1)
                    const maxTonnage = Math.max(...data.receivingAI.trend.map(item => item.tonnage), 1)
                    return <div key={point.month} className="flex flex-col items-center gap-1"><div className="flex h-12 w-full items-end gap-0.5"><div className="w-1/4 rounded-t bg-indigo-500" style={{ height: `${Math.max(10, (point.count / maxCount) * 100)}%` }} /><div className="w-1/4 rounded-t bg-cyan-500" style={{ height: `${Math.max(10, (point.volumeCbm / maxVolume) * 100)}%` }} /><div className="w-1/4 rounded-t bg-emerald-500" style={{ height: `${Math.max(10, (point.pallets / maxPallets) * 100)}%` }} /><div className="w-1/4 rounded-t bg-amber-500" style={{ height: `${Math.max(10, (point.tonnage / maxTonnage) * 100)}%` }} /></div><span className="text-xs text-slate-600">{point.month.slice(5)}</span><span className="text-xs font-semibold text-slate-700">{point.count} / {point.volumeCbm.toFixed(0)}m³</span><span className="text-xs text-slate-600">{point.pallets}P / {point.tonnage.toFixed(1)}T</span></div>
                  })}
                </div>
              </div>
              <div className="border-t border-slate-100 pt-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Top item receiving</div>
                <div className="mt-2 space-y-2">
                  {data.receivingAI.topItems.slice(0, 3).map(([item, quantity]) => <div key={item} className="flex items-center justify-between gap-3 text-xs"><span className="min-w-0 truncate text-slate-600" title={item}>{item}</span><span className="shrink-0 font-semibold text-slate-900">{quantity.toLocaleString('id-ID')}</span></div>)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="top" className="scroll-mt-24 px-5 py-10 md:px-8">
        <div className="mx-auto max-w-7xl">
          <CustomerStockMapClient publicOnly />
        </div>
      </section>

      <section id="areas" className="scroll-mt-24 px-5 py-14 md:px-8">
        <div className="mx-auto mb-7 max-w-7xl">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#6E6E73]">Control Tower</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-[#1D1D1F] sm:text-4xl">Area operasional</h2>
          <p className="mt-3 max-w-2xl text-base leading-7 text-[#6E6E73]">Pilih area untuk melihat indikator utama dan membuka modul operasional terkait.</p>
        </div>
        <div className="mx-auto grid max-w-7xl gap-5 xl:grid-cols-2">
        {areas.map((area) => {
          const Icon = area.icon
          return (
            <section key={area.n} className={`grid items-start gap-6 rounded-[1.5rem] border bg-white p-6 shadow-[0_2px_8px_rgba(0,0,0,0.035)] transition-shadow hover:shadow-[0_8px_24px_rgba(0,0,0,0.07)] md:p-8 xl:grid-cols-[.9fr_1.1fr] ${toneMap[area.tone]}`}>
              <div>
                <div className="mb-4 text-xs font-semibold tracking-[0.12em] text-[#6E6E73]">AREA {area.n}</div>
                <Icon className="mb-5 h-9 w-9" />
                <h3 className="text-2xl font-semibold leading-[1.15] tracking-[-0.025em] text-[#1D1D1F]">{area.title}</h3>
                <p className="mt-3 max-w-xl text-sm leading-6 text-[#6E6E73]">{area.desc}</p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link href={area.href} className="rounded-full bg-[#007AFF] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#0066D6]">Buka area</Link>
                  <Link href="/dashboard" className="rounded-full border border-[#D2D2D7] bg-white px-5 py-2.5 text-sm font-medium text-[#1D1D1F] transition-colors hover:bg-[#F5F5F7]">Dashboard utama</Link>
                </div>
              </div>
              <div className="rounded-[1.125rem] border border-[#E5E5EA] bg-[#F5F5F7] p-4 text-[#1D1D1F]">
                <div className="mb-4 flex items-center justify-between"><span className="text-sm font-medium">Dashboard snapshot</span><span className="text-xs text-[#6E6E73]">Live module</span></div>
                <div className="grid gap-2.5">
                  {area.metrics.map((m, idx) => (
                    <div key={m.label} className="rounded-xl border border-[#E5E5EA] bg-white px-4 py-3">
                      <div className="flex items-center justify-between gap-3"><span className="text-xs text-[#6E6E73]">{m.label}</span><span className="text-xl font-semibold text-[#1D1D1F]">{m.value}{m.unit}</span></div>
                      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#E5E5EA]"><div className="h-1.5 rounded-full bg-[#007AFF]" style={{ width: `${m.value}%` }} /></div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )
        })}
        </div>
      </section>

      <section id="workflow" className="mx-auto max-w-7xl scroll-mt-24 snap-start px-5 py-24 md:px-8">
        <div className="rounded-[1.75rem] border border-[#E5E5EA] bg-white p-8 text-[#1D1D1F] md:p-12">
          <p className="text-sm font-medium text-[#6E6E73]">Workflow</p>
          <h2 className="mt-3 max-w-3xl text-3xl font-semibold leading-[1.15] tracking-[-0.03em] sm:text-4xl">User melihat ringkasan, masuk ke area, lalu maintain data sesuai role.</h2>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {['Review dashboard', 'Pilih area operasional', 'Maintain & follow up'].map((x, i) => <div key={x} className="rounded-2xl border border-[#E5E5EA] bg-[#F5F5F7] p-6"><div className="mb-8 text-sm text-[#6E6E73]">0{i+1}</div><div className="text-lg font-medium">{x}</div></div>)}
          </div>
        </div>
      </section>

      <section id="access" className="scroll-mt-24 snap-start px-5 pb-24 md:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-3xl font-semibold leading-[1.15] tracking-[-0.03em] sm:text-4xl">Lanjutkan ke ruang kendali</h2>
          <p className="mx-auto mt-5 max-w-2xl text-[#6E6E73]">Pilih area operasional untuk melihat ringkasan dan menindaklanjuti data sesuai akses Anda.</p>
          <Link href="/dashboard" className="mt-8 inline-flex rounded-full bg-[#007AFF] px-7 py-3.5 font-medium text-white transition-colors hover:bg-[#0066D6]">Kembali ke Dashboard</Link>
        </div>
      </section>
    </main>
  )
}

function LoadMetric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="rounded-xl border border-slate-200 bg-white/80 p-3"><div className="flex items-center gap-2 text-xs text-slate-500">{icon}{label}</div><div className="mt-1 text-xl font-bold text-slate-900">{value}</div></div>
}
