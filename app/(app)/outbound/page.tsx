import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import OutboundDeleteButton from '@/components/outbound/OutboundDeleteButton'

export const dynamic = 'force-dynamic'

async function getOutbound() {
  const { data } = await supabase
    .from('outbound_detail')
    .select('id, outbound_header_id, posting_date, entry_type, document_no, item_no, description, branch_representative, project, location_code, quantity, qty_out, is_sale, import_period')
    .eq('is_sale', true)
    .order('posting_date', { ascending: false })
    .limit(200)
  return data ?? []
}

async function getAggregate() {
  const { data } = await supabase
    .from('outbound_detail')
    .select('posting_date, document_no, quantity, qty_out')
    .eq('is_sale', true)
    .order('posting_date', { ascending: false })
    .limit(1000)
  return data ?? []
}

export default async function OutboundPage() {
  const [rows, agg] = await Promise.all([getOutbound(), getAggregate()])

  const aggRows = agg as any[]
  const byMonth: Record<string, { docs: Set<string>; qty: number; lines: number }> = {}
  for (const r of aggRows) {
    const m = (r.posting_date?.slice(0, 7) as string) ?? 'unknown'
    if (!byMonth[m]) byMonth[m] = { docs: new Set(), qty: 0, lines: 0 }
    byMonth[m].docs.add(r.document_no)
    byMonth[m].qty += Math.abs(Number(r.qty_out ?? r.quantity ?? 0))
    byMonth[m].lines += 1
  }
  const monthStats = Object.entries(byMonth).sort(([a],[b])=>b.localeCompare(a)).slice(0,6).map(([month,s])=>({month,docs:s.docs.size,qty:s.qty,lines:s.lines}))

  return (
    <div className="space-y-4">
      <header className="flex items-start justify-between gap-4">
        <h1 className="text-3xl font-bold">OUTBOUND</h1>
      </header>

      <div className="bg-white border border-border rounded-xl overflow-hidden">
        <div className="border-b p-4 flex items-center justify-between">
          <h2 className="font-bold text-gray-900">TREN BULANAN</h2>
          <span className="text-xs text-gray-500">{monthStats.length} BULAN — SAMPLE 1000 BARIS IS_SALE=TRUE</span>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">BULAN</th>
              <th className="text-right px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">DOKUMEN</th>
              <th className="text-right px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">LINES</th>
              <th className="text-right px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">TOTAL QTY</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {monthStats.map(({ month, docs, qty, lines }) => (
              <tr key={month} className="border-t border-border hover:bg-blue-50">
                <td className="px-4 py-2.5 font-mono text-xs font-medium">{month.toUpperCase()}</td>
                <td className="px-4 py-2.5 text-right text-xs">{docs}</td>
                <td className="px-4 py-2.5 text-right text-xs">{lines}</td>
                <td className="px-4 py-2.5 text-right text-xs font-bold">{qty.toLocaleString('id-ID')}</td>
              </tr>
            ))}
            {monthStats.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400 text-sm">BELUM ADA DATA</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="bg-white border border-border rounded-xl overflow-auto">
        <div className="border-b p-4 flex items-center justify-between">
          <h2 className="font-bold text-gray-900">DETAIL TRANSAKSI — 200 BARIS TERAKHIR IS_SALE=TRUE</h2>
          <span className="text-xs text-gray-500">{rows.length} ROWS</span>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">POSTING</th>
              <th className="text-left px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">DOCUMENT (PSS)</th>
              <th className="text-left px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">ITEM</th>
              <th className="text-left px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">PROJECT</th>
              <th className="text-left px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">LOCATION</th>
              <th className="text-right px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">QTY</th>
              <th className="text-left px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">PERIOD</th>
              <th className="text-center px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">ACTION</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r: any, i: number) => (
              <tr key={r.id ?? `${r.document_no}-${i}`} className="border-t border-border hover:bg-blue-50">
                <td className="px-4 py-2.5 text-xs">{r.posting_date?.slice(0, 10) ?? '-'}</td>
                <td className="px-4 py-2.5 font-mono text-xs font-medium">{String(r.document_no ?? '-').toUpperCase()}</td>
                <td className="px-4 py-2.5 text-xs font-mono">{String(r.item_no ?? '-').toUpperCase()}</td>
                <td className="px-4 py-2.5 text-xs">{String(r.project ?? '-').toUpperCase()}</td>
                <td className="px-4 py-2.5 text-xs">{String(r.location_code ?? '-').toUpperCase()}</td>
                <td className="px-4 py-2.5 text-right text-xs font-bold">{Math.abs(Number(r.qty_out ?? r.quantity ?? 0)).toLocaleString('id-ID')}</td>
                <td className="px-4 py-2.5 text-xs">{String(r.import_period ?? '-').toUpperCase()}</td>
                <td className="px-4 py-2.5 text-center">
                  <OutboundDeleteButton row={{
                    id: r.id,
                    outbound_header_id: r.outbound_header_id,
                    document_no: r.document_no,
                  }} />
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400 text-sm">BELUM ADA DATA OUTBOUND</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
