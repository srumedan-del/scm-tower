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
        <div className="data-list-scroll overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-border">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-text uppercase tracking-wide">CODE</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-text uppercase tracking-wide">NAMA</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-text uppercase tracking-wide">CITY</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-text uppercase tracking-wide">ADDRESS</th>
                <th className="px-4 py-2.5 text-center text-xs font-medium text-text uppercase tracking-wide">ACTIVE</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-text uppercase tracking-wide">CREATED</th>
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