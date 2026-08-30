import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { ShipmentRow } from '@/components/shipment/ShipmentRow'
import { ShipmentAddButton } from '@/components/shipment/ShipmentAddButton'

export const dynamic = 'force-dynamic'

type Shipment = {
  id: string
  shipment_no: string | null
  document_no: string | null
  shipment_date: string | null
  origin_warehouse: string | null
  destination_site: string | null
  destination_name: string | null
  destination_city: string | null
  route: string | null
  shipment_type: string | null
  vendor_name: string | null
  vehicle_no: string | null
  driver_name: string | null
  status: string | null
  eta: string | null
  sla_status: string | null
  pod_status: string | null
  delay_reason: string | null
  notes: string | null
  created_at: string | null
}

async function getShipments() {
  const { data, error } = await supabase
    .from('shipments')
    .select('id, shipment_no, document_no, shipment_date, origin_warehouse, destination_site, destination_name, destination_city, route, shipment_type, vendor_name, vehicle_no, driver_name, status, eta, sla_status, pod_status, delay_reason, notes, created_at')
    .order('shipment_date', { ascending: false })
    .limit(100)
  if (error) console.error('shipments fetch error:', error.message)
  return (data ?? []) as Shipment[]
}
async function getVendors() {
  const { data } = await supabase.from('vendors').select('id, vendor_name, vendor_code').eq('is_active', true).order('vendor_name')
  return (data ?? []) as { id: string; vendor_name: string; vendor_code: string }[]
}

export default async function ShipmentPage() {
  const [shipments, vendors] = await Promise.all([getShipments(), getVendors()])
  const vForAdd = vendors.map(v => ({ vendor_name: v.vendor_name, vendor_code: v.vendor_code }))
  return (
    <div className="space-y-4">
      <header className="flex items-start justify-between gap-4">
        <h1 className="text-3xl font-bold">SHIPMENT TRACKING</h1>
        <ShipmentAddButton vendors={vForAdd} />
      </header>

      <div className="bg-white border border-border rounded-xl overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">TANGGAL</th>
              <th className="text-left px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">SHIPMENT NO</th>
              <th className="text-left px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">DESTINATION</th>
              <th className="text-left px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">VENDOR</th>
              <th className="text-left px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">ETA</th>
              <th className="text-left px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">STATUS</th>
              <th className="text-left px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">SLA</th>
              <th className="text-left px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">POD</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {shipments.map((s) => (
              <ShipmentRow key={s.id} shipment={s} vendors={vForAdd} />
            ))}
            {shipments.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400 text-sm">BELUM ADA SHIPMENT — KLIK + TAMBAH SHIPMENT UNTUK BUAT BARU</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
