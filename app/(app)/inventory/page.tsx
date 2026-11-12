import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import Link from 'next/link'
import { BarChart3 } from 'lucide-react'

export default async function Inventory() {
  const { data } = await supabase.from('vw_inventory_alert').select('*').limit(50)

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <h1 className="text-3xl font-bold">Inventory</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/inventory/snapshot"
            className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <BarChart3 className="h-4 w-4" /> Snapshot
          </Link>
        </div>
      </div>

      {/* Quick link cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          href="/inventory/snapshot"
          className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 hover:border-indigo-200 hover:bg-indigo-50 transition-colors"
        >
          <div className="rounded-xl bg-gray-100 p-3">
            <BarChart3 className="h-6 w-6 text-gray-600" />
          </div>
          <div>
            <div className="font-semibold text-gray-800">Inventory Snapshot</div>
            <div className="text-sm text-gray-500 mt-0.5">
              Input &amp; update stok per SKU per gudang — alert Stockout / Critical / Low / OK
            </div>
          </div>
          <div className="ml-auto text-gray-400 text-lg">→</div>
        </Link>
      </div>

      {/* Legacy alert view */}
      <div className="bg-white border border-border rounded-xl overflow-auto">
        <div className="border-b px-4 py-3">
          <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">
            Legacy Inventory Alert View
          </span>
        </div>
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">SKU</th>
              <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">ITEM</th>
              <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">WAREHOUSE</th>
              <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">AVAILABLE</th>
              <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">SAFETY</th>
              <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">STATUS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data?.map((r: any) => (
              <tr key={r.id} className="group hover:bg-slate-50/70 transition-colors transition-colors">
                <td className="px-4 py-3 text-xs font-medium text-slate-600">{r.sku_code}</td>
                <td className="px-4 py-3 text-xs font-medium text-slate-600">{r.item_name}</td>
                <td className="px-4 py-3 text-xs font-medium text-slate-600">{r.warehouse_code}</td>
                <td className="px-4 py-3 text-right text-xs font-medium numeric-cell text-slate-600">{r.available_qty}</td>
                <td className="px-4 py-3 text-right text-xs font-medium numeric-cell text-slate-600">{r.safety_stock}</td>
                <td className="px-4 py-3 text-xs font-medium text-slate-600">{r.alert_status}</td>
              </tr>
            ))}
            {!data?.length && (
              <tr><td className="px-4 py-3 text-xs font-medium text-slate-600">Belum ada data inventory.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
