import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import Link from 'next/link'
import { Activity, BarChart3 } from 'lucide-react'

export default async function Inventory() {
  const { data } = await supabase.from('vw_inventory_alert').select('*').limit(50)

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <h1 className="text-3xl font-bold">INVENTORY</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/inventory/snapshot"
            className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <BarChart3 className="h-4 w-4" /> Snapshot
          </Link>
          <Link
            href="/inventory/hd-monitoring"
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            <Activity className="h-4 w-4" /> HD Monitoring
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

        <Link
          href="/inventory/hd-monitoring"
          className="flex items-center gap-4 rounded-xl border border-indigo-200 bg-indigo-50 p-4 hover:bg-indigo-100 transition-colors"
        >
          <div className="rounded-xl bg-indigo-100 p-3">
            <Activity className="h-6 w-6 text-indigo-600" />
          </div>
          <div>
            <div className="font-semibold text-indigo-800">HD Machine Utilization & Replenishment</div>
            <div className="text-sm text-indigo-600 mt-0.5">
              Monitoring stok consumable HD Set per customer — estimasi FU-PO, DOI, badge status
            </div>
          </div>
          <div className="ml-auto text-indigo-400 text-lg">→</div>
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
          <thead className="sticky top-0 z-10 border-b border-[#E5E7EB] bg-[#F8FAFC]">
            <tr>
              <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-[0.1em] text-[#64748B] whitespace-nowrap">SKU</th>
              <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-[0.1em] text-[#64748B] whitespace-nowrap">ITEM</th>
              <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-[0.1em] text-[#64748B] whitespace-nowrap">WAREHOUSE</th>
              <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-[0.1em] text-[#64748B] whitespace-nowrap">AVAILABLE</th>
              <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-[0.1em] text-[#64748B] whitespace-nowrap">SAFETY</th>
              <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-[0.1em] text-[#64748B] whitespace-nowrap">STATUS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EEF0F4]">
            {data?.map((r: any) => (
              <tr key={r.id} className="group border-t border-[#EEF0F4] hover:bg-gray-50 transition-colors">
                <td className="px-4 py-0.25 text-xs font-medium text-[#475569]">{r.sku_code}</td>
                <td className="px-4 py-0.25 text-xs font-medium text-[#475569]">{r.item_name}</td>
                <td className="px-4 py-0.25 text-xs font-medium text-[#475569]">{r.warehouse_code}</td>
                <td className="px-4 py-0.25 text-right text-xs font-medium numeric-cell text-[#475569]">{r.available_qty}</td>
                <td className="px-4 py-0.25 text-right text-xs font-medium numeric-cell text-[#475569]">{r.safety_stock}</td>
                <td className="px-4 py-0.25 text-xs font-medium text-[#475569]">{r.alert_status}</td>
              </tr>
            ))}
            {!data?.length && (
              <tr><td className="px-4 py-0.25 text-xs font-medium text-[#475569]">Belum ada data inventory.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
