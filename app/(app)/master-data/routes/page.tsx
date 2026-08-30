import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { RouteRow } from '@/components/route/RouteRow'
import RouteAddButton from '@/components/route/RouteAddButton'

async function getRoutes() {
  const { data } = await supabase.from('routes').select('*').order('route_code')
  return data ?? []
}

export default async function RoutesPage() {
  const routes = await getRoutes()
  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <h1 className="text-3xl font-bold mb-1">MASTER ROUTES</h1>
        <RouteAddButton />
      </header>

      <section className="bg-white border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">ROUTE CODE</th>
                <th className="text-left px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">ORIGIN → DESTINATION</th>
                <th className="text-left px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">CITY</th>
                <th className="text-right px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">LEAD TIME</th>
                <th className="text-left px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">RISK</th>
                <th className="text-left px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">NOTES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {routes.map((r:any) => <RouteRow key={r.id} route={r} />)}
              {routes.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">BELUM ADA RUTE.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}