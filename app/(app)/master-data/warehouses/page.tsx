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
        <div className="receiving-table-scroll data-list-scroll max-h-[calc(100vh-7.5rem)] overflow-auto rounded-2xl border border-[#E5E7EB] bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 border-b border-[#E5E7EB] bg-[#F8FAFC]">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-[0.1em] text-[#64748B] whitespace-nowrap">CODE</th>
                <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-[0.1em] text-[#64748B] whitespace-nowrap">NAMA</th>
                <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-[0.1em] text-[#64748B] whitespace-nowrap">CITY</th>
                <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-[0.1em] text-[#64748B] whitespace-nowrap">ADDRESS</th>
                <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-[0.1em] text-[#64748B] whitespace-nowrap">ACTIVE</th>
                <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-[0.1em] text-[#64748B] whitespace-nowrap">CREATED</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF0F4]">
              {warehouses.map((w:any) => <WarehouseRow key={w.id} wh={w} />)}
              {warehouses.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">BELUM ADA GUDANG.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}