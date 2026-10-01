import Link from 'next/link'
import { CustomerStockMapClient } from '@/components/customer-stock-map/CustomerStockMapClient'
import { ArrowRight, BarChart3, Target, Boxes, ClipboardCheck, Users, Truck, ShieldAlert, Factory, Layers3, Weight, Activity } from 'lucide-react'
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

const toneMap: Record<string, string> = {
  blue: 'from-[#E5F2FC] via-white to-[#F7FBFF] text-[#2783DE] border-[#CDE6F8]',
  green: 'from-[#E8F1EC] via-white to-[#F8FCFA] text-[#46A171] border-[#D2E7DA]',
  orange: 'from-[#FBEBDE] via-white to-[#FFF9F4] text-[#D5803B] border-[#F2D2B7]',
  red: 'from-[#FCE9E7] via-white to-[#FFF8F7] text-[#E56458] border-[#F3C9C5]',
}

export default async function LandingPage() {
  const data = await getLandingPageData()

  const areas = [
    { n: '01', title: 'Strategy & Planning', desc: 'Control room untuk roadmap, target layanan, kapasitas, dan prioritas eksekusi SCM.', icon: iconMap.Target, tone: 'blue', metrics: data.areas[0].metrics },
    { n: '02', title: 'Inventory Management', desc: 'Pantau stok, movement, slow moving, safety stock, dan sinyal risiko kekurangan barang.', icon: iconMap.Boxes, tone: 'green', metrics: data.areas[1].metrics },
    { n: '03', title: 'Procurement', desc: 'Kelola kebutuhan pengadaan, supplier lead time, harga, dan pemenuhan PO.', icon: iconMap.ClipboardCheck, tone: 'orange', metrics: data.areas[2].metrics },
    { n: '04', title: 'Vendor Management', desc: 'Lihat performa vendor, SLA, POD, coverage, rate card, dan issue transport.', icon: iconMap.Users, tone: 'blue', metrics: data.areas[3].metrics },
    { n: '05', title: 'Logistics & Distribution', desc: 'Tracking shipment, rute, ETA, delay, status POD, dan pengiriman sampai selesai.', icon: iconMap.Truck, tone: 'red', metrics: data.areas[4].metrics },
    { n: '06', title: 'Risk Management', desc: 'Satu tempat untuk issue log, mitigasi, severity, owner, dan tindak lanjut operasional.', icon: iconMap.ShieldAlert, tone: 'orange', metrics: data.areas[5].metrics },
    { n: '07', title: 'Warehouse Management', desc: 'Monitor receiving, outbound, checklist gudang, staging, dock, equipment, dan produktivitas.', icon: iconMap.Factory, tone: 'green', metrics: data.areas[6].metrics },
  ]

  return (
    <main className="min-h-screen bg-[#F9F8F7] text-[#2C2C2B] selection:bg-[#2783DE] selection:text-white">
      <nav className="fixed top-0 z-50 w-full border-b border-black/5 bg-white/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 md:px-8">
          <a href="#top" className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#2C2C2B] text-sm font-semibold text-white">SC</span>
            <span className="font-semibold tracking-tight">SCM Control Tower</span>
          </a>
          <div className="hidden items-center gap-4 text-sm text-[#7D7A75] lg:flex">
            <Link href="/receiving" className="hover:text-[#2C2C2B]">Receiving</Link>
            <Link href="/outbound" className="hover:text-[#2C2C2B]">Outbound</Link>
            <Link href="/crossdocking" className="hover:text-[#2C2C2B]">Crossdocking</Link>
            <Link href="/shipment" className="hover:text-[#2C2C2B]">Shipment</Link>
            <Link href="/shipment-cost" className="hover:text-[#2C2C2B]">Shipment Cost</Link>
          </div>
        </div>
      </nav>

      <section id="intro" className="relative flex min-h-screen scroll-mt-24 snap-start items-center overflow-hidden px-5 pt-24 md:px-8">
        <div className="absolute left-1/2 top-28 h-72 w-72 -translate-x-1/2 rounded-full bg-[#2783DE]/15 blur-3xl" />
        <div className="absolute bottom-24 right-10 h-80 w-80 rounded-full bg-[#46A171]/15 blur-3xl" />
        <div className="mx-auto grid max-w-7xl items-center gap-12 md:grid-cols-[1.05fr_.95fr]">

          <div className="relative animate-rise">
            <div className="mb-6 inline-flex rounded-full border border-[#E6E5E3] bg-white px-4 py-2 text-sm text-[#7D7A75] shadow-sm">
              Supply Chain command center untuk operasi harian
            </div>
            <h1 className="max-w-4xl text-5xl font-semibold tracking-[-0.04em] md:text-7xl">
              Satu layar untuk membaca ritme seluruh supply chain.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[#7D7A75]">
              Landing page ini menjadi pintu masuk ke 7 area fungsi SCM — masing-masing punya dashboard ringkas, indikator risiko, dan akses maintain data untuk user yang berwenang.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href="/login" className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-[#2783DE] px-6 py-4 font-medium text-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
                Masuk ke Control Tower <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </Link>
              <a href="#areas" className="inline-flex items-center justify-center rounded-2xl border border-[#E6E5E3] bg-white px-6 py-4 font-medium transition hover:-translate-y-1 hover:shadow-sm">Lihat 7 area fungsi</a>
            </div>
          </div>

          <div className="relative animate-rise-delay">
            <div className="rounded-[2rem] border border-[#E6E5E3] bg-white/80 p-4 shadow-[0_24px_80px_rgba(44,44,43,.08)] backdrop-blur">
              <div className="rounded-[1.5rem] bg-[#F9F8F7] p-5">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-[#7D7A75]">Today overview</p>
                    <h2 className="text-xl font-semibold">SCM Pulse</h2>
                  </div>
                  <BarChart3 className="text-[#2783DE]" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Shipment', value: data.scmPulse.shipment },
                    { label: 'Receiving', value: data.scmPulse.receiving },
                    { label: 'Outbound', value: data.scmPulse.outbound },
                    { label: 'Inventory', value: data.scmPulse.inventory },
                  ].map((x, i) => (
                    <div key={x.label} className="rounded-2xl border border-[#E6E5E3] bg-white p-4">
                      <div className="text-xs text-[#7D7A75]">{x.label}</div>
                      <div className="mt-2 text-3xl font-semibold">{x.value}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-2xl border border-[#E6E5E3] bg-white p-4">
                  <div className="mb-3 flex justify-between text-sm"><span>Operational readiness</span><span className="font-medium text-[#46A171]">{data.scmPulse.operationalReadiness}%</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#E6E5E3]"><div className="h-full w-[84%] rounded-full bg-[#46A171]" style={{ width: `${data.scmPulse.operationalReadiness}%` }} /></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 py-10 md:px-8">
        <div className="mx-auto grid max-w-7xl gap-6 rounded-[2rem] border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-cyan-50 p-6 md:grid-cols-[1.1fr_.9fr] md:p-10">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-indigo-700">
              <Activity className="h-5 w-5" />
              Inbound load profile
            </div>
            <h2 className="mt-4 max-w-xl text-3xl font-semibold tracking-[-0.03em] text-[#2C2C2B] md:text-5xl">
              Receiving Insight
            </h2>
            <div className="mt-7 grid grid-cols-2 gap-3">
              <LoadMetric icon={<Layers3 className="h-4 w-4" />} label="Quantity" value={data.receivingAI.load.quantity.toLocaleString('id-ID')} />
              <LoadMetric icon={<Activity className="h-4 w-4" />} label="Volume" value={`${data.receivingAI.load.volumeCbm.toFixed(1)} m³`} />
              <LoadMetric icon={<Weight className="h-4 w-4" />} label="Tonase" value={`${data.receivingAI.load.tonnage.toFixed(1)} ton`} />
            </div>
            <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50/70 p-4">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-indigo-700">
                <span>Rata-rata load / bulan</span>
                <span>{data.receivingAI.trend.length} bulan</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div><div className="text-xs text-slate-500">Quantity</div><div className="font-bold text-slate-900">{data.receivingAI.monthlyAverage.quantity.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</div></div>
                <div><div className="text-xs text-slate-500">Volume</div><div className="font-bold text-slate-900">{data.receivingAI.monthlyAverage.volumeCbm.toFixed(1)} m³</div></div>
                <div><div className="text-xs text-slate-500">Tonase</div><div className="font-bold text-slate-900">{data.receivingAI.monthlyAverage.tonnage.toFixed(1)} ton</div></div>
                <div><div className="text-xs text-slate-500">Pallet</div><div className="font-bold text-slate-900">{data.receivingAI.monthlyAverage.pallets.toFixed(0)}</div></div>
              </div>
            </div>
            <div className="mt-4 rounded-xl border border-indigo-100 bg-white/70 p-4">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-indigo-700"><span>Lead time pengiriman</span><span>Rata-rata hari</span></div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-indigo-50 p-3"><div className="text-xs text-slate-500">NIJ · 1–3 hari</div><div className="mt-1 font-bold text-slate-900">{data.receivingAI.leadTime.nij.count} PTR</div><div className="text-xs text-slate-500">Rata-rata {data.receivingAI.leadTime.nij.averageDays.toFixed(1)} hari</div></div>
                <div className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-slate-500">From lainnya</div><div className="mt-1 font-bold text-slate-900">{data.receivingAI.leadTime.other.count} PTR</div><div className="text-xs text-slate-500">Rata-rata {data.receivingAI.leadTime.other.averageDays.toFixed(1)} hari</div></div>
              </div>
              <div className="mt-4 border-t border-slate-100 pt-3">
                <div className="mb-2 flex items-center gap-3 text-[10px] text-slate-500"><span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-indigo-500" /> NIJ</span><span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-slate-400" /> From lainnya</span></div>
                <div className="grid grid-cols-6 items-end gap-2">
                  {data.receivingAI.leadTimeTrend.map(point => {
                    const maxDays = Math.max(...data.receivingAI.leadTimeTrend.map(item => Math.max(item.nij, item.other)), 1)
                    return <div key={point.month} className="flex flex-col items-center gap-1"><div className="flex h-16 w-full items-end gap-0.5"><div className="w-1/2 rounded-t bg-indigo-500" style={{ height: `${Math.max(point.nij ? 8 : 0, (point.nij / maxDays) * 100)}%` }} /><div className="w-1/2 rounded-t bg-slate-400" style={{ height: `${Math.max(point.other ? 8 : 0, (point.other / maxDays) * 100)}%` }} /></div><span className="text-[10px] text-slate-500">{point.month.slice(5)}</span><span className="text-[9px] font-semibold text-slate-700">{point.nij.toFixed(1)} / {point.other.toFixed(1)}</span></div>
                  })}
                </div>
              </div>
            </div>
            <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-emerald-700">
                <span>PTR lead time &lt; 3 hari</span>
                <span>{data.receivingAI.fastPtrs.length} PTR</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {data.receivingAI.fastPtrs.length ? data.receivingAI.fastPtrs.map(ptr => <span key={ptr.ptrNo} className="rounded-md bg-white px-2 py-1 font-mono text-xs font-semibold text-slate-700 shadow-sm">{ptr.ptrNo} · {ptr.leadTime} hari</span>) : <span className="text-xs text-slate-500">Tidak ada PTR dengan lead time di bawah 3 hari.</span>}
              </div>
              <div className="mt-3 border-t border-emerald-100 pt-3 text-sm text-slate-600">
                Rata-rata setelah PTR &lt; 3 hari dikeluarkan: <strong className="text-slate-900">{data.receivingAI.averageAfterFast.toFixed(1)} hari</strong>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/80 bg-white/85 p-5 shadow-sm backdrop-blur">
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
                <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-slate-500"><span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-indigo-500" /> PTR</span><span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-cyan-500" /> Volume</span><span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-emerald-500" /> Pallet</span><span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-amber-500" /> Tonase</span></div>
                <div className="mt-3 grid grid-cols-6 items-end gap-2">
                  {data.receivingAI.trend.map(point => {
                    const maxCount = Math.max(...data.receivingAI.trend.map(item => item.count), 1)
                    const maxVolume = Math.max(...data.receivingAI.trend.map(item => item.volumeCbm), 1)
                    const maxPallets = Math.max(...data.receivingAI.trend.map(item => item.pallets), 1)
                    const maxTonnage = Math.max(...data.receivingAI.trend.map(item => item.tonnage), 1)
                    return <div key={point.month} className="flex flex-col items-center gap-1"><div className="flex h-12 w-full items-end gap-0.5"><div className="w-1/4 rounded-t bg-indigo-500" style={{ height: `${Math.max(10, (point.count / maxCount) * 100)}%` }} /><div className="w-1/4 rounded-t bg-cyan-500" style={{ height: `${Math.max(10, (point.volumeCbm / maxVolume) * 100)}%` }} /><div className="w-1/4 rounded-t bg-emerald-500" style={{ height: `${Math.max(10, (point.pallets / maxPallets) * 100)}%` }} /><div className="w-1/4 rounded-t bg-amber-500" style={{ height: `${Math.max(10, (point.tonnage / maxTonnage) * 100)}%` }} /></div><span className="text-[10px] text-slate-500">{point.month.slice(5)}</span><span className="text-[9px] font-semibold text-slate-700">{point.count} / {point.volumeCbm.toFixed(0)}m³</span><span className="text-[9px] text-slate-500">{point.pallets}P / {point.tonnage.toFixed(1)}T</span></div>
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

      <section id="areas" className="scroll-mt-24 space-y-6 px-5 py-10 md:px-8">
        {areas.map((area) => {
          const Icon = area.icon
          return (
            <section key={area.n} className={`mx-auto grid min-h-[92vh] scroll-mt-24 snap-start max-w-7xl items-center gap-10 rounded-[2rem] border bg-gradient-to-br p-6 md:grid-cols-[.9fr_1.1fr] md:p-12 ${toneMap[area.tone]}`}>
              <div>
                <div className="mb-4 text-sm font-semibold opacity-70">AREA {area.n}</div>
                <Icon className="mb-8 h-12 w-12" />
                <h2 className="text-4xl font-semibold tracking-[-0.03em] text-[#2C2C2B] md:text-6xl">{area.title}</h2>
                <p className="mt-5 max-w-xl text-lg leading-8 text-[#7D7A75]">{area.desc}</p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link href="/login" className="rounded-xl bg-[#2C2C2B] px-5 py-3 text-sm font-medium text-white transition hover:-translate-y-0.5">Maintain area</Link>
                  <a href="/dashboard" className="rounded-xl border border-current bg-white/70 px-5 py-3 text-sm font-medium transition hover:-translate-y-0.5">Lihat dashboard</a>
                </div>
              </div>
              <div className="rounded-[1.5rem] border border-white/70 bg-white/75 p-5 text-[#2C2C2B] shadow-sm backdrop-blur">
                <div className="mb-6 flex items-center justify-between"><span className="font-medium">Dashboard snapshot</span><span className="text-sm text-[#7D7A75]">Live module</span></div>
                <div className="grid gap-3">
                  {area.metrics.map((m, idx) => (
                    <div key={m.label} className="rounded-2xl border border-[#E6E5E3] bg-white p-5">
                      <div className="flex items-center justify-between"><span className="text-sm text-[#7D7A75]">{m.label}</span><span className="text-2xl font-semibold">{m.value}{m.unit}</span></div>
                      <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#F0EFED]"><div className="h-2 rounded-full bg-current" style={{ width: `${m.value}%` }} /></div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )
        })}
      </section>

      <section id="workflow" className="mx-auto max-w-7xl scroll-mt-24 snap-start px-5 py-24 md:px-8">
        <div className="rounded-[2rem] bg-[#2C2C2B] p-8 text-white md:p-12">
          <p className="text-sm text-white/60">Workflow</p>
          <h2 className="mt-3 max-w-3xl text-4xl font-semibold tracking-[-0.03em] md:text-5xl">User melihat ringkasan, masuk ke area, lalu maintain data sesuai role.</h2>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {['Review dashboard', 'Login sesuai role', 'Maintain & follow up'].map((x, i) => <div key={x} className="rounded-2xl border border-white/10 bg-white/5 p-6"><div className="mb-8 text-white/40">0{i+1}</div><div className="text-xl font-medium">{x}</div></div>)}
          </div>
        </div>
      </section>

      <section id="access" className="scroll-mt-24 snap-start px-5 pb-24 md:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-4xl font-semibold tracking-[-0.03em] md:text-5xl">Siap masuk ke ruang kendali?</h2>
          <p className="mx-auto mt-5 max-w-2xl text-[#7D7A75]">Landing page menjadi pintu depan. Data operasional tetap dijaga melalui login, role access, dan modul maintain per area fungsi.</p>
          <Link href="/login" className="mt-8 inline-flex rounded-2xl bg-[#2783DE] px-7 py-4 font-medium text-white transition hover:-translate-y-1 hover:shadow-lg">Login untuk maintain data</Link>
        </div>
      </section>
    </main>
  )
}

function LoadMetric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="rounded-xl border border-slate-200 bg-white/80 p-3"><div className="flex items-center gap-2 text-xs text-slate-500">{icon}{label}</div><div className="mt-1 text-xl font-bold text-slate-900">{value}</div></div>
}
