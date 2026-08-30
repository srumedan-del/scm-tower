import Link from 'next/link'
import { CustomerStockMapClient } from '@/components/customer-stock-map/CustomerStockMapClient'
import { ArrowRight, BarChart3, Boxes, ClipboardCheck, Factory, ShieldAlert, Target, Truck, Users } from 'lucide-react'

const areas = [
  { n: '01', title: 'Strategy & Planning', desc: 'Control room untuk roadmap, target layanan, kapasitas, dan prioritas eksekusi SCM.', icon: Target, tone: 'blue', metrics: ['Service level', 'Capacity plan', 'Weekly priorities'] },
  { n: '02', title: 'Inventory Management', desc: 'Pantau stok, movement, slow moving, safety stock, dan sinyal risiko kekurangan barang.', icon: Boxes, tone: 'green', metrics: ['Available stock', 'Low stock alert', 'Stock movement'] },
  { n: '03', title: 'Procurement', desc: 'Kelola kebutuhan pengadaan, supplier lead time, harga, dan pemenuhan PO.', icon: ClipboardCheck, tone: 'orange', metrics: ['PR to PO lead time', 'Supplier SLA', 'Cost variance'] },
  { n: '04', title: 'Vendor Management', desc: 'Lihat performa vendor, SLA, POD, coverage, rate card, dan issue transport.', icon: Users, tone: 'blue', metrics: ['On-time rate', 'POD completion', 'Vendor score'] },
  { n: '05', title: 'Logistics & Distribution', desc: 'Tracking shipment, rute, ETA, delay, status POD, dan pengiriman sampai selesai.', icon: Truck, tone: 'red', metrics: ['Shipment status', 'Delay reason', 'Delivery lead time'] },
  { n: '06', title: 'Risk Management', desc: 'Satu tempat untuk issue log, mitigasi, severity, owner, dan tindak lanjut operasional.', icon: ShieldAlert, tone: 'orange', metrics: ['Open issues', 'Risk level', 'Mitigation status'] },
  { n: '07', title: 'Warehouse Management', desc: 'Monitor receiving, outbound, checklist gudang, staging, dock, equipment, dan produktivitas.', icon: Factory, tone: 'green', metrics: ['Checklist rate', 'Inbound flow', 'Outbound readiness'] },
]

const toneMap: Record<string, string> = {
  blue: 'from-[#E5F2FC] via-white to-[#F7FBFF] text-[#2783DE] border-[#CDE6F8]',
  green: 'from-[#E8F1EC] via-white to-[#F8FCFA] text-[#46A171] border-[#D2E7DA]',
  orange: 'from-[#FBEBDE] via-white to-[#FFF9F4] text-[#D5803B] border-[#F2D2B7]',
  red: 'from-[#FCE9E7] via-white to-[#FFF8F7] text-[#E56458] border-[#F3C9C5]',
}

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[#F9F8F7] text-[#2C2C2B] selection:bg-[#2783DE] selection:text-white">
      <nav className="fixed top-0 z-50 w-full border-b border-black/5 bg-white/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 md:px-8">
          <a href="#top" className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#2C2C2B] text-sm font-semibold text-white">SC</span>
            <span className="font-semibold tracking-tight">SCM Control Tower</span>
          </a>
          <div className="hidden items-center gap-6 text-sm text-[#7D7A75] md:flex">
            <a href="#areas" className="hover:text-[#2C2C2B]">7 Area</a>
            <a href="#top" className="hover:text-[#2C2C2B]">Customer Map</a>
            <a href="#workflow" className="hover:text-[#2C2C2B]">Workflow</a>
            <a href="#access" className="hover:text-[#2C2C2B]">Access</a>
          </div>
          <Link href="/login" className="rounded-xl bg-[#2C2C2B] px-4 py-2 text-sm font-medium text-white transition hover:-translate-y-0.5 hover:bg-black">Login</Link>
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
                  {['Shipment', 'Receiving', 'Outbound', 'Inventory'].map((x, i) => (
                    <div key={x} className="rounded-2xl border border-[#E6E5E3] bg-white p-4">
                      <div className="text-xs text-[#7D7A75]">{x}</div>
                      <div className="mt-2 text-3xl font-semibold">{[18, 7, 32, 5][i]}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-2xl border border-[#E6E5E3] bg-white p-4">
                  <div className="mb-3 flex justify-between text-sm"><span>Operational readiness</span><span className="font-medium text-[#46A171]">84%</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#E6E5E3]"><div className="h-full w-[84%] rounded-full bg-[#46A171]" /></div>
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
                    <div key={m} className="rounded-2xl border border-[#E6E5E3] bg-white p-5">
                      <div className="flex items-center justify-between"><span className="text-sm text-[#7D7A75]">{m}</span><span className="text-2xl font-semibold">{[92, 18, 7][idx]}{idx === 0 ? '%' : ''}</span></div>
                      <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#F0EFED]"><div className="h-full rounded-full bg-current" style={{ width: `${[78, 52, 34][idx]}%` }} /></div>
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
