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
        <div className="data-list-scroll overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-border">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-text uppercase tracking-wide">ROUTE CODE</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-text uppercase tracking-wide">ORIGIN → DESTINATION</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-text uppercase tracking-wide">TIPE</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-text uppercase tracking-wide">LEAD TIME</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-text uppercase tracking-wide">JARAK</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-text uppercase tracking-wide">NOTES</th>
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
