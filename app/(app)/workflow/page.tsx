import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

async function getCounts() {
  const [v, s, sl, r, i, c] = await Promise.all([
    supabase.from('vendors').select('*', { count: 'exact', head: true }),
    supabase.from('shipments').select('*', { count: 'exact', head: true }),
    supabase.from('shipment_status_logs').select('*', { count: 'exact', head: true }),
    supabase.from('receiving_header').select('*', { count: 'exact', head: true }),
    supabase.from('issue_log').select('*', { count: 'exact', head: true }),
    supabase.from('warehouse_checklist').select('*', { count: 'exact', head: true }),
  ])
  return {
    vendors: v.count ?? 0,
    shipments: s.count ?? 0,
    status_logs: sl.count ?? 0,
    receiving: r.count ?? 0,
    issues: i.count ?? 0,
    checklists: c.count ?? 0,
  }
}

async function getRecentActivity() {
  // Latest 8 status logs
  const { data: logs } = await supabase
    .from('shipment_status_logs')
    .select('id, status_from, status_to, updated_by, location, notes, updated_at')
    .order('updated_at', { ascending: false })
    .limit(8)
  return logs ?? []
}

async function getIssuesOpen() {
  const { data } = await supabase
    .from('issue_log')
    .select('issue_no, title, status, category, due_date, impact')
    .in('status', ['open', 'in_progress'])
    .order('due_date', { ascending: true })
    .limit(5)
  return data ?? []
}

async function getChecklistToday() {
  const today = new Date().toISOString().slice(0, 10)
  const { data } = await supabase
    .from('warehouse_checklist')
    .select('*')
    .eq('checklist_date', today)
    .limit(1)
  return data?.[0] ?? null
}

export default async function WorkflowPage() {
  const [counts, activity, issues, checklist] = await Promise.all([
    getCounts(),
    getRecentActivity(),
    getIssuesOpen(),
    getChecklistToday(),
  ])

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold mb-1">SCM Workflow</h1>
      </header>

      {/* Status counts */}
      <section className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <Stat label="Vendor" value={counts.vendors} color="blue" link="/vendor"/>
        <Stat label="Shipment" value={counts.shipments} color="indigo" link="/shipment"/>
        <Stat label="Status Logs" value={counts.status_logs} color="purple" link="/shipment"/>
        <Stat label="Receiving" value={counts.receiving} color="green" link="/receiving"/>
        <Stat label="Issues Open" value={issues.length} color="orange" link="/issues"/>
        <Stat label="Checklist" value={counts.checklists} color="pink" link="/warehouse-checklist"/>
      </section>

      {/* Workflow status flow */}
      <section className="bg-white border border-border rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-4">📦 Shipment Status Flow</h2>
        <div className="flex flex-wrap items-center justify-between gap-2">
          {['planned', 'picking', 'packed', 'loaded', 'in_transit', 'delivered'].map((status, idx) => (
            <div key={status} className="flex items-center">
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-blue-50 border-2 border-blue-300 flex items-center justify-center text-xs font-medium text-blue-700">
                  {status.replace('_', '\n')}
                </div>
                <div className="text-xs text-gray-500 mt-1">{idx + 1}</div>
              </div>
              {idx < 5 && <div className="w-8 h-1 bg-blue-300 mx-1"/>}
            </div>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <div className="font-medium text-amber-800">⏸ Exceptions</div>
            <div className="text-amber-700 text-xs mt-1">delayed / returned / cancelled</div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="font-medium text-green-800">✓ POD</div>
            <div className="text-green-700 text-xs mt-1">POD received closes the loop</div>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
            <div className="font-medium text-purple-800">📊 SLA Tracking</div>
            <div className="text-purple-700 text-xs mt-1">on_time / at_risk / late</div>
          </div>
        </div>
      </section>

      {/* 2-column layout: Recent Activity + Open Issues */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent activity */}
        <section className="bg-white border border-border rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-3">🕒 Recent Activity</h2>
          {activity.length === 0 ? (
            <p className="text-sm text-gray-500">Belum ada activity. Tambah shipment dulu di <code>/shipment</code>.</p>
          ) : (
            <ul className="space-y-3">
              {activity.map((log:any) => (
                <li key={log.id} className="flex gap-3 text-sm border-l-2 border-blue-300 pl-3">
                  <div className="flex-1">
                    <div className="font-medium">
                      {log.status_from && <span className="text-gray-500">{log.status_from} → </span>}
                      <span className="text-blue-700">{log.status_to}</span>
                    </div>
                    <div className="text-xs text-gray-600 mt-0.5">{log.notes}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      {log.updated_by && <span>👤 {log.updated_by} · </span>}
                      {log.location && <span>📍 {log.location} · </span>}
                      <span>{new Date(log.updated_at).toLocaleString('id-ID')}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Open issues */}
        <section className="bg-white border border-border rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-3">⚠️ Open Issues ({issues.length})</h2>
          {issues.length === 0 ? (
            <p className="text-sm text-gray-500">Tidak ada open issue.</p>
          ) : (
            <ul className="space-y-3">
              {issues.map((iss:any) => (
                <li key={iss.issue_no} className="border border-orange-200 bg-orange-50 rounded-lg p-3">
                  <div className="flex justify-between items-start">
                    <div className="font-medium text-sm text-orange-900">{iss.title}</div>
                    <span className={`text-xs px-2 py-0.5 rounded ${iss.status === 'open' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {iss.status}
                    </span>
                  </div>
                  <div className="text-xs text-orange-700 mt-1">{iss.category} · {iss.impact}</div>
                  {iss.due_date && <div className="text-xs text-gray-500 mt-1">Due: {iss.due_date}</div>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Today's warehouse checklist */}
      <section className="bg-white border border-border rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-3">✅ Warehouse Checklist Hari Ini</h2>
        {checklist ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {([
              ['area_receiving_clean', 'Area Receiving Bersih'],
              ['dock_available', 'Dock Available'],
              ['forklift_ready', 'Forklift Ready'],
              ['pallet_available', 'Pallet Available'],
              ['damaged_goods_separated', 'Damaged Goods Dipisah'],
              ['inbound_documents_complete', 'Inbound Doc Complete'],
              ['outbound_staging_done', 'Outbound Staging Done'],
              ['safety_check_done', 'Safety Check'],
            ] as const).map(([key, label]) => {
              const ok: boolean = Boolean((checklist as any)[key])
              return (
                <div key={key} className={`rounded-lg p-3 text-sm ${ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                  <div className="font-medium">{ok ? '✓' : '✗'} {label}</div>
                </div>
              )
            })}
            {(checklist as any).issue_notes && (
              <div className="col-span-full text-xs text-gray-600 border-t pt-2">
                <strong>Notes:</strong> {(checklist as any).issue_notes}
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-500">Belum ada checklist untuk hari ini.</p>
        )}
      </section>

      <style>{`.text-muted{color:#6b7280}`}</style>
    </div>
  )
}

function Stat({label, value, color, link}:{label:string;value:number;color:string;link?:string}) {
  const map: Record<string,string> = {
    blue: 'bg-blue-50 text-blue-700',
    indigo: 'bg-indigo-50 text-indigo-700',
    purple: 'bg-purple-50 text-purple-700',
    green: 'bg-green-50 text-green-700',
    orange: 'bg-orange-50 text-orange-700',
    pink: 'bg-pink-50 text-pink-700',
  }
  const content = (
    <div className={`rounded-xl p-4 ${map[color]} ${link ? 'cursor-pointer hover:opacity-80' : ''}`}>
      <div className="text-xs">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  )
  return link ? <a href={link}>{content}</a> : content
}