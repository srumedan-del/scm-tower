import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { WarehouseRow } from '@/components/warehouse/WarehouseRow'
import WarehouseAddButton from '@/components/warehouse/WarehouseAddButton'

async function getWarehouses() {
  const { data } = await supabase.from('warehouses').select('*').order('warehouse_code')
  return data ?? []
}

export default async function WarehousesPage() {
  const warehouses = await getWarehouses()
  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <h1 className="text-3xl font-bold mb-1">MASTER WAREHOUSES</h1>
        <WarehouseAddButton />
      </header>

      <section className="bg-white border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">CODE</th>
                <th className="text-left px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">NAMA</th>
                <th className="text-left px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">CITY</th>
                <th className="text-left px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">ADDRESS</th>
                <th className="text-center px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">ACTIVE</th>
                <th className="text-left px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">CREATED</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {warehouses.map((w:any) => <WarehouseRow key={w.id} wh={w} />)}
              {warehouses.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">BELUM ADA GUDANG.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}