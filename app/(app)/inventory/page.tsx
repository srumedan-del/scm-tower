import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'

export default async function Inventory() {
  const { data } = await supabase.from('vw_inventory_alert').select('*').limit(50)
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">INVENTORY SNAPSHOT</h1>
      <div className="bg-white border border-border rounded-xl overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">SKU</th>
              <th className="text-left px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">ITEM</th>
              <th className="text-left px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">WAREHOUSE</th>
              <th className="text-right px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">AVAILABLE</th>
              <th className="text-right px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">SAFETY</th>
              <th className="text-left px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">STATUS</th>
            </tr>
          </thead>
          <tbody>
            {data?.map((r:any) => (
              <tr key={r.id} className="border-t border-border hover:bg-blue-50">
                <td className="px-4 py-2.5">{r.sku_code}</td>
                <td className="px-4 py-2.5">{r.item_name}</td>
                <td className="px-4 py-2.5">{r.warehouse_code}</td>
                <td className="px-4 py-2.5 text-right">{r.available_qty}</td>
                <td className="px-4 py-2.5 text-right">{r.safety_stock}</td>
                <td className="px-4 py-2.5">{r.alert_status}</td>
              </tr>
            ))}
            {!data?.length && (
              <tr><td colSpan={6} className="p-6 text-center text-gray-500">Belum ada inventory data.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}