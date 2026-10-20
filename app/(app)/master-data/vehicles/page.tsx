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
        <div className="data-list-scroll overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-border">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-text uppercase tracking-wide">NOPOL / VEHICLE NO</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-text uppercase tracking-wide">JENIS</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-text uppercase tracking-wide">TONASE / VOLUME</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-text uppercase tracking-wide">DRIVER</th>
                <th className="px-4 py-2.5 text-center text-xs font-medium text-text uppercase tracking-wide">STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {fleet.map((r:any) => <FleetRow key={r.id} fleet={r} />)}
              {fleet.length===0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">BELUM ADA ARMADA.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}