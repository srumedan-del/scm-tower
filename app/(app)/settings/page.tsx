import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'

export default async function SettingsPage() {
  const [vendorCount, shipmentCount, receivingCount, outboundCount] = await Promise.all([
    supabase.from('vendors').select('id', { count: 'exact', head: true }),
    supabase.from('shipments').select('id', { count: 'exact', head: true }),
    supabase.from('receiving_header').select('id', { count: 'exact', head: true }).then(r=>r.count ?? 0),
    supabase.from('outbound_detail').select('id', { count: 'exact', head: true }),
  ])

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold mb-1">Settings</h1>
        <p className="text-muted">Status koneksi Supabase dan statistik modul SCM.</p>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Stat label="Vendor" value={vendorCount.count ?? 0} color="blue"/>
        <Stat label="Shipment" value={shipmentCount.count ?? 0} color="purple"/>
        <Stat label="Receiving Header" value={receivingCount ?? 0} color="green"/>
        <Stat label="Outbound Detail" value={outboundCount.count ?? 0} color="orange"/>
      </section>

      <section className="bg-white border border-border rounded-xl p-6 space-y-3">
        <h2 className="text-lg font-semibold">Tabel yang Tersedia di Supabase</h2>
        <p className="text-sm text-gray-600">Schema project <code>elwzpofgxgauyssatga</code> sudah include:</p>
        <ul className="text-sm space-y-1 list-disc list-inside text-gray-700">
          <li><code>customers</code> — customer + geo map (lihat dashboard)</li>
          <li><code>routes</code>, <code>warehouses</code>, <code>master_sku</code> — master data</li>
          <li><code>vendors</code> — vendor transport (dengan PIC, SLA, coverage)</li>
          <li><code>shipments</code> — shipment tracking</li>
          <li><code>shipment_status_logs</code> — history status per shipment</li>
          <li><code>outbound_detail</code>, <code>receiving_header/detail</code> — dari ERP export</li>
          <li><code>inventory_snapshot</code>, <code>inventory_movement</code> — inventory</li>
          <li><code>issue_log</code>, <code>warehouse_checklist</code> — operasional</li>
        </ul>
        <p className="text-xs text-gray-500 mt-3">
          Views: <code>vw_receiving_kpi</code>, <code>vw_inventory_alert</code>, <code>v_outbound_*</code>, <code>v_shipment_tracking</code>, <code>vw_vendor_performance</code>
        </p>
      </section>

      <section className="bg-white border border-border rounded-xl p-6 space-y-3">
        <h2 className="text-lg font-semibold">Env Variables yang Diperlukan</h2>
        <ul className="text-sm space-y-2 list-disc list-inside text-gray-700">
          <li><code className="bg-gray-100 px-2 py-0.5 rounded">NEXT_PUBLIC_SUPABASE_URL</code></li>
          <li><code className="bg-gray-100 px-2 py-0.5 rounded">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code></li>
        </ul>
        <p className="text-xs text-gray-500 mt-3">
          Letakkan di <code>.env.local</code> (belum ada — perlu dibuat dari .env.example).
        </p>
      </section>
    </div>
  )
}

function Stat({label, value, color}:{label:string;value:number;color:string}) {
  const map: Record<string,string> = {
    blue: 'bg-blue-50 text-blue-700',
    indigo: 'bg-indigo-50 text-indigo-700',
    green: 'bg-green-50 text-green-700',
    orange: 'bg-orange-50 text-orange-700',
    purple: 'bg-purple-50 text-purple-700',
  }
  return (
    <div className={`rounded-xl p-4 ${map[color]}`}>
      <div className="text-xs">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  )
}