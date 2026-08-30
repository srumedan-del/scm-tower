import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

async function getReceiving() {
  const { data } = await supabase
    .from('receiving_header')
    .select('id, ptr_no, transfer_order_no, transfer_from_code, transfer_to_code, posting_date, shipment_date, receipt_date, shipping_agent_code, ship_to_receipt_days, receipt_to_posting_days, ship_to_posting_days')
    .order('receipt_date', { ascending: false })
    .limit(50)
  return data ?? []
}

export default async function ReceivingPage() {
  const rows = await getReceiving()
  return (
    <div className="space-y-4">
      <header className="flex items-start justify-between gap-4">
        <h1 className="text-3xl font-bold">RECEIVING / INBOUND</h1>
      </header>

      <div className="bg-white border border-border rounded-xl overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">PTR NO</th>
              <th className="text-left px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">TRANSFER ORDER</th>
              <th className="text-left px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">FROM → TO</th>
              <th className="text-left px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">SHIPPING AGENT</th>
              <th className="text-left px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">SHIP DATE</th>
              <th className="text-left px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">RECEIPT DATE</th>
              <th className="text-right px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">LEAD TIME</th>
              <th className="text-right px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">R→P DAYS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r:any) => {
              const lt = r.ship_to_receipt_days ?? 0
              const ltColor = lt > 14 ? 'bg-red-100 text-red-700' : lt > 7 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
              return (
                <tr key={r.id} className="border-t border-border hover:bg-blue-50">
                  <td className="px-4 py-2.5 font-mono text-xs font-medium">{String(r.ptr_no ?? '-').toUpperCase()}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{String(r.transfer_order_no ?? '-').toUpperCase()}</td>
                  <td className="px-4 py-2.5 text-xs">{String(`${r.transfer_from_code ?? '-'} → ${r.transfer_to_code ?? '-'}`).toUpperCase()}</td>
                  <td className="px-4 py-2.5 text-xs">{String(r.shipping_agent_code ?? '-').toUpperCase()}</td>
                  <td className="px-4 py-2.5 text-xs">{r.shipment_date?.slice(0, 10) ?? '-'}</td>
                  <td className="px-4 py-2.5 text-xs">{r.receipt_date?.slice(0, 10) ?? '-'}</td>
                  <td className="px-4 py-2.5 text-right">
                    <span className={`text-xs px-2 py-0.5 rounded font-bold ${ltColor}`}>{lt} HARI</span>
                  </td>
                  <td className="px-4 py-2.5 text-right text-xs">{r.receipt_to_posting_days ?? 0}</td>
                </tr>
              )
            })}
            {rows.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400 text-sm">BELUM ADA DATA RECEIVING</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
