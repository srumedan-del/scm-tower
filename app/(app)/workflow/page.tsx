import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

async function getReceivingAnalytics() {
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5)
  const fromDate = sixMonthsAgo.toISOString().slice(0, 7) + '-01'

  const { data: headers } = await supabase
    .from('receiving_header')
    .select('id, posting_date, ship_to_receipt_days, receipt_to_posting_days, ship_to_posting_days, shipping_agent_code')
    .gte('posting_date', fromDate)
    .order('posting_date', { ascending: true })

  const { data: allHeaders } = await supabase
    .from('receiving_header')
    .select('ship_to_posting_days')
    .not('ship_to_posting_days', 'is', null)

  const { data: detailAgg } = await supabase
    .from('receiving_detail')
    .select('quantity, uom')

  const monthMap: Record<string, number> = {}
  for (const h of headers ?? []) {
    const month = String(h.posting_date ?? '').slice(0, 7)
    if (!month || month === '9999-12') continue
    monthMap[month] = (monthMap[month] ?? 0) + 1
  }
  const monthlyData = Object.entries(monthMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)

  const ltValues = (allHeaders ?? [])
    .map((h: any) => Number(h.ship_to_posting_days))
    .filter((v) => Number.isFinite(v) && v > 0 && v < 365)
  const ltMin = ltValues.length ? Math.min(...ltValues) : 0
  const ltMax = ltValues.length ? Math.max(...ltValues) : 0
  const ltAvg = ltValues.length ? Math.round(ltValues.reduce((a, b) => a + b, 0) / ltValues.length) : 0

  const totalQty = (detailAgg ?? []).reduce((sum: number, d: any) => sum + (Number(d.quantity) || 0), 0)
  const totalLines = detailAgg?.length ?? 0
  const estPallet = Math.ceil(totalQty / 100)
  const estM3 = Math.round(totalQty * 0.003 * 10) / 10

  const agentMap: Record<string, number> = {}
  for (const h of headers ?? []) {
    const agent = String(h.shipping_agent_code ?? 'UNKNOWN').trim().toUpperCase()
    agentMap[agent] = (agentMap[agent] ?? 0) + 1
  }
  const topAgents = Object.entries(agentMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 4)

  return { monthlyData, ltMin, ltMax, ltAvg, totalQty, totalLines, estPallet, estM3, topAgents, ltValues }
}

async function getCounts() {
  const [r, c] = await Promise.all([
    supabase.from('receiving_header').select('*', { count: 'exact', head: true }),
    supabase.from('warehouse_checklist').select('*', { count: 'exact', head: true }),
  ])
  return {
    receiving: r.count ?? 0,
    checklists: c.count ?? 0,
  }
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
  const [counts, checklist, recvAnalytics] = await Promise.all([
    getCounts(),
    getChecklistToday(),
    getReceivingAnalytics(),
  ])

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold mb-1">SCM Workflow</h1>
      </header>

      {/* Status counts */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Total PTR" value={counts.receiving} color="green" link="/receiving"/>
        <Stat label="Checklist" value={counts.checklists} color="pink" link="/warehouse-checklist"/>
        <Stat label="Total Qty Masuk" value={recvAnalytics.totalQty} color="blue"/>
        <Stat label="Est. Pallet" value={recvAnalytics.estPallet} color="indigo"/>
      </section>

      {/* Receiving / Inbound business process */}
      <section className="bg-white border border-border rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-1">📥 Receiving / Inbound — Bisnis Proses</h2>
        <p className="text-xs text-gray-500 mb-5">
          Alur kerja penerimaan barang dari supplier / transfer antar gudang hingga barang tercatat di sistem.
        </p>

        {/* Step-by-step flow */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
          {([
            {
              step: '1',
              icon: '📄',
              title: 'Transfer Order',
              color: 'blue',
              desc: 'Dokumen Transfer Order (TO) diterbitkan dari sistem ERP. Berisi asal gudang (transfer_from), tujuan (transfer_to), dan daftar item.',
            },
            {
              step: '2',
              icon: '🚚',
              title: 'Pengiriman',
              color: 'indigo',
              desc: 'Barang dikirim oleh Shipping Agent. Tanggal shipment dicatat (shipment_date). Lead time mulai dihitung dari titik ini.',
            },
            {
              step: '3',
              icon: '📦',
              title: 'Penerimaan Fisik',
              color: 'purple',
              desc: 'Barang tiba di gudang tujuan. Staf gudang mencocokkan fisik dengan Transfer Order. Tanggal fisik tercatat sebagai receipt_date.',
            },
            {
              step: '4',
              icon: '📋',
              title: 'Upload & Verifikasi',
              color: 'orange',
              desc: 'Upload PTR Header (receiving_header) dan PTR Detail (receiving_detail) via CSV. Tombol Verifikasi mengecek orphaned detail dan header kosong.',
            },
            {
              step: '5',
              icon: '✅',
              title: 'Posting',
              color: 'green',
              desc: 'Data diposting ke sistem (posting_date). Lead time akhir dihitung: ship→receipt, receipt→posting, dan ship→posting.',
            },
          ] as const).map(({ step, icon, title, color, desc }) => {
            const colorMap: Record<string, string> = {
              blue: 'bg-blue-50 border-blue-200 text-blue-800',
              indigo: 'bg-indigo-50 border-indigo-200 text-indigo-800',
              purple: 'bg-purple-50 border-purple-200 text-purple-800',
              orange: 'bg-orange-50 border-orange-200 text-orange-800',
              green: 'bg-green-50 border-green-200 text-green-800',
            }
            const badgeMap: Record<string, string> = {
              blue: 'bg-blue-200 text-blue-900',
              indigo: 'bg-indigo-200 text-indigo-900',
              purple: 'bg-purple-200 text-purple-900',
              orange: 'bg-orange-200 text-orange-900',
              green: 'bg-green-200 text-green-900',
            }
            return (
              <div key={step} className={`relative rounded-xl border p-4 ${colorMap[color]}`}>
                <span className={`absolute -top-2.5 -left-2.5 w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${badgeMap[color]}`}>
                  {step}
                </span>
                <div className="text-2xl mb-2">{icon}</div>
                <div className="font-semibold text-sm mb-1">{title}</div>
                <p className="text-xs leading-relaxed">{desc}</p>
              </div>
            )
          })}
        </div>

        {/* Key fields & metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl bg-gray-50 border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-800 mb-2">🗂 Struktur Data</h3>
            <ul className="text-xs text-gray-600 space-y-1">
              <li><span className="font-mono font-medium text-gray-800">receiving_header</span> — satu baris per PTR</li>
              <li className="pl-3 text-gray-500">ptr_no, transfer_order_no</li>
              <li className="pl-3 text-gray-500">transfer_from_code → transfer_to_code</li>
              <li className="pl-3 text-gray-500">shipment_date, receipt_date, posting_date</li>
              <li className="pl-3 text-gray-500">shipping_agent_code</li>
              <li className="mt-1"><span className="font-mono font-medium text-gray-800">receiving_detail</span> — item per PTR</li>
              <li className="pl-3 text-gray-500">item_no, description, quantity, uom</li>
              <li className="pl-3 text-gray-500">location_code (putaway location)</li>
            </ul>
          </div>

          <div className="rounded-xl bg-gray-50 border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-800 mb-2">⏱ Lead Time Metrics</h3>
            <ul className="text-xs text-gray-600 space-y-2">
              <li>
                <span className="font-medium text-gray-800">Ship → Receipt</span>
                <div className="text-gray-500">Berapa hari barang di perjalanan</div>
              </li>
              <li>
                <span className="font-medium text-gray-800">Receipt → Posting</span>
                <div className="text-gray-500">Berapa hari proses admin setelah barang tiba</div>
              </li>
              <li>
                <span className="font-medium text-gray-800">Ship → Posting</span>
                <div className="text-gray-500">Total end-to-end lead time</div>
              </li>
              <li className="pt-1 border-t border-gray-200">
                <span className="inline-block px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-medium mr-1">≥11 hari</span>normal
                <span className="inline-block px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 font-medium mx-1">&lt;11 hari</span>cepat
                <span className="inline-block px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-medium mx-1">&gt;18 hari</span>lambat
              </li>
            </ul>
          </div>

          <div className="rounded-xl bg-gray-50 border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-800 mb-2">🔧 Cara Kerja di Sistem</h3>
            <ul className="text-xs text-gray-600 space-y-1.5">
              <li>📤 Upload CSV PTR Header untuk membuat receiving_header</li>
              <li>📤 Upload CSV PTR Detail untuk mengisi item-item di bawah setiap header</li>
              <li>🔍 Tombol <span className="font-medium">Verifikasi</span> mendeteksi:<br/>
                <span className="pl-2 text-gray-500">• Detail tanpa header (orphaned)</span><br/>
                <span className="pl-2 text-gray-500">• Header tanpa satu pun detail</span>
              </li>
              <li>✏️ Ship date bisa diedit inline langsung di tabel</li>
              <li>🗑 Delete PTR otomatis hapus semua detail terkait</li>
              <li>🔎 Klik PTR No untuk lihat detail item (modal)</li>
            </ul>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <a
            href="/receiving"
            className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-xs font-semibold text-white hover:bg-green-500"
          >
            📥 Buka Halaman Receiving →
          </a>
        </div>
      </section>

      {/* Card: Format Data NAV & Panduan Upload */}
      <section className="bg-white border border-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">📁 Format Data dari NAV — Panduan Upload</h2>
            <p className="text-xs text-gray-500 mt-0.5">Berdasarkan file actual dari Microsoft Dynamics NAV / Business Central</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
          {/* PTR Header */}
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
            <h3 className="text-sm font-semibold text-blue-800 mb-3">📄 PTR Header — Posted Transfer Receipts</h3>
            <div className="space-y-2 text-xs text-blue-900">
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                <div><span className="font-medium">No.</span><span className="text-blue-600 ml-1">→ ptr_no</span></div>
                <div><span className="font-medium">Transfer Order No.</span><span className="text-blue-600 ml-1">→ transfer_order_no</span></div>
                <div><span className="font-medium">Transfer-from Code</span><span className="text-blue-600 ml-1">→ transfer_from_code</span></div>
                <div><span className="font-medium">Transfer-to Code</span><span className="text-blue-600 ml-1">→ transfer_to_code</span></div>
                <div><span className="font-medium">Posting Date</span><span className="text-blue-600 ml-1">→ posting_date</span></div>
                <div><span className="font-medium">Shipment Date</span><span className="text-blue-600 ml-1">→ shipment_date</span></div>
                <div><span className="font-medium">Receipt Date</span><span className="text-blue-600 ml-1">→ receipt_date</span></div>
                <div><span className="font-medium">Shipping Agent Code</span><span className="text-blue-600 ml-1">→ shipping_agent_code</span></div>
              </div>
              <div className="mt-2 pt-2 border-t border-blue-200 space-y-1">
                <div className="text-blue-700 font-medium">⚠️ Format tanggal dari NAV:</div>
                <div>• Header: <span className="font-mono">9/1/26</span> → M/D/YY → dibaca sebagai 2026-09-01 ✓</div>
                <div>• Kolom CABANG/PERWAKILAN, PROJECT tidak diupload (diabaikan sistem)</div>
                <div>• Kolom Shipment Method Code tidak diupload (diabaikan sistem)</div>
              </div>
            </div>
          </div>

          {/* PTR Detail */}
          <div className="rounded-xl border border-green-200 bg-green-50 p-4">
            <h3 className="text-sm font-semibold text-green-800 mb-3">📋 PTR Detail — Item Ledger Entries</h3>
            <div className="space-y-2 text-xs text-green-900">
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                <div><span className="font-medium">Document No.</span><span className="text-green-600 ml-1">→ document_no</span></div>
                <div><span className="font-medium">Item No.</span><span className="text-green-600 ml-1">→ item_no</span></div>
                <div><span className="font-medium">Description</span><span className="text-green-600 ml-1">→ description</span></div>
                <div><span className="font-medium">Quantity</span><span className="text-green-600 ml-1">→ quantity</span></div>
                <div><span className="font-medium">Lot No.</span><span className="text-green-600 ml-1">→ lot_no</span></div>
                <div><span className="font-medium">Expiration Date</span><span className="text-green-600 ml-1">→ expiration_date</span></div>
                <div><span className="font-medium">Location Code</span><span className="text-green-600 ml-1">→ location_code</span></div>
                <div><span className="font-medium">Entry No.</span><span className="text-green-600 ml-1">→ entry_no</span></div>
              </div>
              <div className="mt-2 pt-2 border-t border-green-200 space-y-1">
                <div className="text-green-700 font-medium">⚠️ Format tanggal dari NAV:</div>
                <div>• Posting Date detail: <span className="font-mono">46266</span> → serial Excel → dibaca sebagai 2026-09-01 ✓</div>
                <div>• Document Created: <span className="font-mono">01/09/26 13:53:09</span> → DD/MM/YY HH:mm:ss ✓</div>
                <div>• Satu Document No. bisa punya banyak baris (per lot/serial)</div>
              </div>
            </div>
          </div>
        </div>

        {/* Data pattern dari file aktual */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl bg-gray-50 border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">🏭 Kode Gudang (Transfer-from)</h3>
            <ul className="text-xs text-gray-600 space-y-1">
              <li><span className="font-mono font-medium">JKT-JP12</span> — Jakarta JP12</li>
              <li><span className="font-mono font-medium">JKT-CKPA</span> — Jakarta Cakung/Pulogadung</li>
              <li><span className="font-mono font-medium">MDN-CAR</span> — Medan Carrefour/lokal</li>
              <li><span className="font-mono font-medium">V-CUS</span> — Vendor/Customer langsung</li>
              <li><span className="font-mono font-medium">JKT-DUM</span> — Jakarta Duren/area lain</li>
              <li className="mt-1 text-gray-500">Transfer-to: <span className="font-mono">MDN-PAR</span> (Medan Pematang Raya)</li>
            </ul>
          </div>

          <div className="rounded-xl bg-gray-50 border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">🚚 Shipping Agent</h3>
            <ul className="text-xs text-gray-600 space-y-1">
              <li><span className="font-mono font-medium">SA-0049</span> — Agent paling sering digunakan</li>
              <li><span className="font-mono font-medium">SA-0062</span> — Agent kedua terbanyak</li>
              <li><span className="font-mono font-medium">SA-0044</span> — Digunakan untuk V-CUS / MDN-CAR</li>
              <li><span className="font-mono font-medium">SA-0092</span> — Jarang (1 transaksi)</li>
              <li className="mt-1 pt-1 border-t border-gray-200 text-gray-500">Data dari 117 PTR header (Okt 2025 – Sep 2026)</li>
            </ul>
          </div>

          <div className="rounded-xl bg-gray-50 border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">⚠️ Hal yang Perlu Diperhatikan</h3>
            <ul className="text-xs text-gray-600 space-y-1.5">
              <li>🔁 Satu PTR bisa muncul di beberapa file export — sistem otomatis skip duplikat</li>
              <li>📅 Receipt Date bisa sebelum atau setelah Posting Date — periksa jika lead time negatif</li>
              <li>📦 Quantity di detail bisa sangat besar (ratusan ribu) untuk produk seperti DS03L, DS10L</li>
              <li>🏷️ Beberapa baris detail punya Lot No. kosong (item tanpa lot tracking)</li>
              <li>❌ Jangan upload detail sebelum header — sistem akan reject karena tidak ada link</li>
            </ul>
          </div>
        </div>
      </section>

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