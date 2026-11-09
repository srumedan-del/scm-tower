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
        <div className="receiving-table-scroll data-list-scroll max-h-[calc(100vh-7.5rem)] overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">ROUTE CODE</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">ORIGIN → DESTINATION</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">TIPE</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">LEAD TIME</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">JARAK</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">NOTES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {routes.map((r:any) => <RouteRow key={r.id} route={r} />)}
              {routes.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">BELUM ADA RUTE.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
