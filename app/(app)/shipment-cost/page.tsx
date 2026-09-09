import { getShipmentCosts } from './actions'
import { computeCostSummary } from './utils'
import ShipmentCostClient from './ShipmentCostClient'
import Link from 'next/link'
import { DollarSign, TrendingUp } from 'lucide-react'

export const dynamic = 'force-dynamic'

function rp(v: number | null | undefined) {
  if (v == null || v === 0) return '-'
  return 'Rp ' + v.toLocaleString('id-ID')
}

export default async function ShipmentCostPage() {
  const rows = await getShipmentCosts()
  const summary = computeCostSummary(rows)

  const filledRows = rows.filter(r => (r.total_biaya ?? 0) > 0)
  const emptyRows = rows.filter(r => (r.total_biaya ?? 0) === 0)

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">SHIPMENT COST</h1>
          <p className="text-sm text-gray-500 mt-0.5">Realisasi biaya pengiriman — Internal &amp; Eksternal</p>
        </div>
        <Link href="/shipment" className="text-sm text-indigo-600 hover:underline">← Kembali ke Shipment Tracking</Link>
      </header>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-border rounded-xl p-4">
          <div className="text-xs text-gray-500 flex items-center gap-1"><DollarSign size={12}/> Total Shipment</div>
          <div className="text-2xl font-bold mt-1">{summary.totalShipment}</div>
          <div className="text-xs text-gray-400 mt-1">{filledRows.length} terisi biaya · {emptyRows.length} belum</div>
        </div>
        <div className="bg-white border border-border rounded-xl p-4">
          <div className="text-xs text-gray-500">Total Biaya</div>
          <div className="text-2xl font-bold mt-1 text-indigo-700">{rp(summary.totalBiaya)}</div>
          <div className="text-xs text-gray-400 mt-1">Realisasi semua shipment</div>
        </div>
        <div className="bg-white border border-border rounded-xl p-4">
          <div className="text-xs text-gray-500">Invoice Value Eksternal</div>
          <div className="text-2xl font-bold mt-1">{rp(summary.totalInvoiceValue)}</div>
          <div className="text-xs text-gray-400 mt-1">Internal tidak menggunakan invoice</div>
        </div>
        <div className="bg-white border border-border rounded-xl p-4">
          <div className="text-xs text-gray-500 flex items-center gap-1"><TrendingUp size={12}/> Avg Cost Ratio</div>
          <div className={`text-2xl font-bold mt-1 ${
            (summary.avgCostRatio ?? 0) > 20 ? 'text-red-600' : (summary.avgCostRatio ?? 0) > 10 ? 'text-yellow-600' : 'text-green-600'
          }`}>
            {summary.avgCostRatio != null ? `${summary.avgCostRatio}%` : '-'}
          </div>
          <div className="text-xs text-gray-400 mt-1">Biaya / Invoice Value</div>
        </div>
      </div>

      {/* ── Breakdown ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* By Model */}
        <div className="bg-white border border-border rounded-xl p-4">
          <h3 className="text-sm font-bold mb-3">Per Model Transporter</h3>
          <div className="space-y-2">
            {Object.entries(summary.byModel).map(([model, s]) => (
              <div key={model} className="flex items-center justify-between text-sm">
                <span className="text-gray-700">{model}</span>
                <div className="text-right">
                  <div className="font-mono text-xs font-bold">{rp(s.total)}</div>
                  <div className="text-xs text-gray-400">{s.count} shipment</div>
                </div>
              </div>
            ))}
            {!Object.keys(summary.byModel).length && <p className="text-xs text-gray-400">Belum ada data</p>}
          </div>
        </div>
        {/* By DK/LK */}
        <div className="bg-white border border-border rounded-xl p-4">
          <h3 className="text-sm font-bold mb-3">Per DK / LK</h3>
          <div className="space-y-2">
            {Object.entries(summary.byDkLk).map(([dk, s]) => (
              <div key={dk} className="flex items-center justify-between text-sm">
                <span className={`px-2 py-0.5 rounded text-xs font-bold ${dk === 'DK' ? 'bg-blue-100 text-blue-700' : dk === 'LK' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                  {dk}
                </span>
                <div className="text-right">
                  <div className="font-mono text-xs font-bold">{rp(s.total)}</div>
                  <div className="text-xs text-gray-400">{s.count} shipment</div>
                </div>
              </div>
            ))}
            {!Object.keys(summary.byDkLk).length && <p className="text-xs text-gray-400">Belum ada data</p>}
          </div>
        </div>
      </div>

      {/* ── Tabel Detail ── */}
      <ShipmentCostClient rows={rows} />
    </div>
  )
}
