import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { FleetRow } from '@/components/fleet/FleetRow'
import FleetAddButton from '@/components/fleet/FleetAddButton'

async function getFleet() {
  const { data } = await supabase.from('transport_fleet').select('*').order('id').limit(200)
  return data ?? []
}

export default async function VehiclesPage() {
  const fleet = await getFleet() as any[]
  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <h1 className="text-3xl font-bold mb-1">MASTER ARMADA</h1>
        <FleetAddButton />
      </header>

      <section className="bg-white border border-border rounded-xl overflow-hidden">
        <div className="receiving-table-scroll data-list-scroll max-h-[calc(100vh-7.5rem)] overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-bold uppercase tracking-wider text-slate-800 whitespace-nowrap">NOPOL / VEHICLE NO</th>
                <th className="px-4 py-3 text-left text-sm font-bold uppercase tracking-wider text-slate-800 whitespace-nowrap">JENIS</th>
                <th className="px-4 py-3 text-left text-sm font-bold uppercase tracking-wider text-slate-800 whitespace-nowrap">TONASE / VOLUME</th>
                <th className="px-4 py-3 text-left text-sm font-bold uppercase tracking-wider text-slate-800 whitespace-nowrap">DRIVER</th>
                <th className="px-4 py-3 text-left text-sm font-bold uppercase tracking-wider text-slate-800 whitespace-nowrap">STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {fleet.map((r:any) => <FleetRow key={r.id} fleet={r} />)}
              {fleet.length===0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">BELUM ADA ARMADA.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}