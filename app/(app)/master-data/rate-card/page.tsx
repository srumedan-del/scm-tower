import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { RateCardRow } from '@/components/rate-card/RateCardRow'
import RateCardAddButton from '@/components/rate-card/RateCardAddButton'

async function getRates() {
  // Use underlying table transport_rate_card directly so we have id for edit/delete
  // Join via view would lose id; try table first, fallback to view
  const { data, error } = await supabase.from('transport_rate_card').select('*').order('rate_code').limit(200)
  if (!error && data) return data
  const { data: v } = await supabase.from('v_transport_rate_card').select('*').limit(200)
  return (v ?? []) as any[]
}

export default async function RateCardPage() {
  const rates = await getRates() as any[]
  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <h1 className="text-3xl font-bold mb-1">MASTER RATE CARD</h1>
        <RateCardAddButton />
      </header>

      <section className="bg-white border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">RATE CODE</th>
                <th className="text-left px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">VENDOR</th>
                <th className="text-left px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">ORIGIN → DESTINATION</th>
                <th className="text-left px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">VEHICLE</th>
                <th className="text-left px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">TARIFF MODEL</th>
                <th className="text-right px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">PRICE</th>
                <th className="text-center px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rates.map((r:any) => <RateCardRow key={r.id ?? r.rate_code} rate={r} />)}
              {rates.length===0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">BELUM ADA RATE CARD.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}