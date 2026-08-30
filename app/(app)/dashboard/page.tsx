import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { CustomerStockMapClient } from '@/components/customer-stock-map/CustomerStockMapClient'
import Link from 'next/link'
import { AlertTriangle, Box, CheckCircle2, Clock3, MapPin, PackageCheck, Truck, XCircle } from 'lucide-react'

export const dynamic = 'force-dynamic'

async function getDashboardData() {
  const [
    { count: vendorCount },
    { count: shipmentCount },
    { count: receivingCount },
    { count: issueCount },
    { data: customers },
    { data: openIssues },
    { data: todayShipments },
  ] = await Promise.all([
    supabase.from('vendors').select('*', { count: 'exact', head: true }),
    supabase.from('shipments').select('*', { count: 'exact', head: true }),
    supabase.from('receiving_header').select('*', { count: 'exact', head: true }),
    supabase.from('issue_log').select('*', { count: 'exact', head: true }),
    supabase.from('customers').select('id, customer_name, city, is_active, machine_count, latitude, longitude').eq('is_active', true).limit(200),
    supabase.from('issue_log').select('issue_no, title, status, category, due_date').in('status', ['open', 'in_progress']).order('due_date', { ascending: true }).limit(5),
    supabase.from('shipments').select('shipment_no, status, destination_city, vendor_name').in('status', ['planned', 'picking', 'loaded', 'in_transit']).order('shipment_date', { ascending: false }).limit(5),
  ])

  return {
    counts: {
      vendors: vendorCount ?? 0,
      shipments: shipmentCount ?? 0,
      receiving: receivingCount ?? 0,
      issues: issueCount ?? 0,
    },
    customers: customers ?? [],
    openIssues: openIssues ?? [],
    todayShipments: todayShipments ?? [],
  }
}

export default async function DashboardPage() {
  const { counts, customers, openIssues, todayShipments } = await getDashboardData()
  const customerActive = customers.length
  const totalMesinHD = (customers as any[]).reduce((s:number,r:any)=> s + (Number(r.machine_count)||0), 0)
  const withLokasi = (customers as any[]).filter((r:any)=> r.latitude!=null && r.longitude!=null).length
  const lokasiCoverage = customerActive ? Math.round(withLokasi*100/customerActive) : 0

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-blue">
            <span className="h-2 w-2 rounded-full bg-blue"/>
            Live control tower
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">SCM Dashboard</h1>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Clock3 size={16}/> Update terakhir: hari ini, {new Date().toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'})}
        </div>
      </header>

      {/* Top KPI strip — linked to other pages */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Link href="/vendor" className="rounded-xl border border-border bg-white p-4 hover:border-blue transition">
          <div className="flex items-center gap-2 text-xs text-gray-500"><Box size={14}/> Vendors</div>
          <div className="mt-2 text-3xl font-bold">{counts.vendors}</div>
          <div className="text-xs text-gray-500 mt-1">Master vendor transport</div>
        </Link>
        <Link href="/shipment" className="rounded-xl border border-border bg-white p-4 hover:border-blue transition">
          <div className="flex items-center gap-2 text-xs text-gray-500"><Truck size={14}/> Shipments</div>
          <div className="mt-2 text-3xl font-bold">{counts.shipments}</div>
          <div className="text-xs text-gray-500 mt-1">Total shipment tracking</div>
        </Link>
        <Link href="/receiving" className="rounded-xl border border-border bg-white p-4 hover:border-blue transition">
          <div className="flex items-center gap-2 text-xs text-gray-500"><PackageCheck size={14}/> Receiving</div>
          <div className="mt-2 text-3xl font-bold">{counts.receiving}</div>
          <div className="text-xs text-gray-500 mt-1">Penerimaan barang</div>
        </Link>
        <Link href="/issues" className="rounded-xl border border-border bg-white p-4 hover:border-blue transition">
          <div className="flex items-center gap-2 text-xs text-gray-500"><AlertTriangle size={14}/> Issues</div>
          <div className="mt-2 text-3xl font-bold">{openIssues.length}</div>
          <div className="text-xs text-gray-500 mt-1">Open + In progress</div>
        </Link>
      </div>

      {/* Customer map */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold flex items-center gap-2"><MapPin size={18}/> Customer Map</h2>
          <div className="text-xs text-gray-500">{customerActive} customer aktif · {totalMesinHD.toLocaleString('id-ID')} MESIN HD · {withLokasi}/{customerActive} LOKASI ({lokasiCoverage}%)</div>
        </div>
        <CustomerStockMapClient/>
      </section>

      {/* 2-column: Active Shipments + Open Issues */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between border-b border-border p-4">
            <h2 className="font-semibold flex items-center gap-2"><Truck size={16}/> Shipments In Progress</h2>
            <Link href="/shipment" className="text-xs text-blue-600 hover:underline">Lihat semua →</Link>
          </div>
          {todayShipments.length === 0 ? (
            <div className="p-6 text-sm text-gray-500 text-center">
              Belum ada shipment in-progress. Tambah shipment di <Link href="/shipment" className="text-blue-600 hover:underline">/shipment</Link>.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {todayShipments.map((s:any, i:number) => (
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
            <h2 className="font-semibold flex items-center gap-2"><AlertTriangle size={16}/> Open Issues</h2>
            <Link href="/issues" className="text-xs text-blue-600 hover:underline">Lihat semua →</Link>
          </div>
          {openIssues.length === 0 ? (
            <div className="p-6 text-sm text-gray-500 text-center">
              Tidak ada open issue. 🎉
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {openIssues.map((iss:any) => (
                <li key={iss.issue_no} className="flex items-start gap-3 p-3 text-sm">
                  <span className="text-xs px-2 py-0.5 rounded bg-orange-100 text-orange-700 whitespace-nowrap">{iss.status}</span>
                  <div className="flex-1">
                    <div className="font-medium">{iss.title}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{iss.category}{iss.due_date && ` · Due ${iss.due_date}`}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Quick action links */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Link href="/workflow" className="flex items-center gap-3 rounded-xl border border-border bg-white p-4 hover:border-blue transition">
          <span className="rounded-lg bg-blue-100 p-2"><CheckCircle2 className="text-blue-600" size={20}/></span>
          <div><div className="text-sm font-semibold">Workflow Overview</div><div className="text-xs text-gray-500">Status flow harian</div></div>
        </Link>
        <Link href="/master-data" className="flex items-center gap-3 rounded-xl border border-border bg-white p-4 hover:border-blue transition">
          <span className="rounded-lg bg-indigo-100 p-2"><Box className="text-indigo-600" size={20}/></span>
          <div><div className="text-sm font-semibold">Master Data</div><div className="text-xs text-gray-500">Vendor, Route, SKU</div></div>
        </Link>
        <Link href="/warehouse-checklist" className="flex items-center gap-3 rounded-xl border border-border bg-white p-4 hover:border-blue transition">
          <span className="rounded-lg bg-purple-100 p-2"><CheckCircle2 className="text-purple-600" size={20}/></span>
          <div><div className="text-sm font-semibold">Warehouse Checklist</div><div className="text-xs text-gray-500">Cek kesiapan gudang</div></div>
        </Link>
        <Link href="/settings" className="flex items-center gap-3 rounded-xl border border-border bg-white p-4 hover:border-blue transition">
          <span className="rounded-lg bg-gray-100 p-2"><XCircle className="text-gray-600" size={20}/></span>
          <div><div className="text-sm font-semibold">Settings</div><div className="text-xs text-gray-500">Status Supabase</div></div>
        </Link>
      </section>
    </div>
  )
}