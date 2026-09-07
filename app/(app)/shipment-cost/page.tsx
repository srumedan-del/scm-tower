import { getShipmentCosts, type ShipmentCostRow } from './actions'
import { computeCostSummary, type CostSummary } from './utils'
import Link from 'next/link'
import { DollarSign, TrendingUp } from 'lucide-react'

export const dynamic = 'force-dynamic'

function rp(v: number | null | undefined) {
  if (v == null || v === 0) return '-'
  return 'Rp ' + v.toLocaleString('id-ID')
}

function OtdBadge({ v }: { v: boolean | null }) {
  if (v === null) return <span className="text-gray-300 text-xs">—</span>
  return v
    ? <span className="text-xs rounded-full px-2 py-0.5 bg-green-100 text-green-700 font-medium">On Time</span>
    : <span className="text-xs rounded-full px-2 py-0.5 bg-red-100 text-red-700 font-medium">Late</span>
}

function CostRatioBadge({ v }: { v: number | null }) {
  if (v == null) return <span className="text-gray-300 text-xs">—</span>
  const cls = v > 20 ? 'text-red-700 bg-red-100' : v > 10 ? 'text-yellow-700 bg-yellow-100' : 'text-green-700 bg-green-100'
  return <span className={`text-xs rounded-full px-2 py-0.5 font-bold ${cls}`}>{v.toFixed(1)}%</span>
}

function InternalDetail({ r }: { r: ShipmentCostRow }) {
  const items = [
    r.bbm_rupiah      && `BBM: ${rp(r.bbm_rupiah)}`,
    r.bongkar_muat_cost && `Bongkar: ${rp(r.bongkar_muat_cost)}`,
    r.hotel_cost      && `Hotel: ${rp(r.hotel_cost)}`,
    r.uang_makan_driver && `Makan: ${rp(r.uang_makan_driver)}`,
    r.toll_cost       && `Tol: ${rp(r.toll_cost)}`,
    r.parkir_cost     && `Parkir: ${rp(r.parkir_cost)}`,
    r.kirim_paket_cost && `Paket: ${rp(r.kirim_paket_cost)}`,
  ].filter(Boolean)
  return items.length
    ? <div className="text-xs text-gray-500 space-y-0.5">{items.map((t, i) => <div key={i}>{t}</div>)}</div>
    : <span className="text-gray-300 text-xs">Belum diisi</span>
}

export default async function ShipmentCostPage() {
  const rows = await getShipmentCosts()
  const summary = computeCostSummary(rows)

  const filledRows = rows.filter(r => (r.total_biaya ?? 0) > 0)
  const emptyRows  = rows.filter(r => !(r.total_biaya ?? 0))

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
          <div className="text-xs text-gray-500">Total Invoice Value</div>
          <div className="text-2xl font-bold mt-1">{rp(summary.totalInvoiceValue)}</div>
          <div className="text-xs text-gray-400 mt-1">Nilai PSS dari NAV</div>
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
      <div className="bg-white border border-border rounded-xl overflow-x-auto">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">Detail Biaya per Shipment</span>
          <span className="text-xs text-gray-400">{rows.length} record</span>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-bold uppercase text-gray-600 whitespace-nowrap">Trip ID</th>
              <th className="text-left px-4 py-3 text-xs font-bold uppercase text-gray-600 whitespace-nowrap">PSS / CD No.</th>
              <th className="text-left px-4 py-3 text-xs font-bold uppercase text-gray-600">Customer</th>
              <th className="text-left px-4 py-3 text-xs font-bold uppercase text-gray-600 whitespace-nowrap">DK/LK</th>
              <th className="text-left px-4 py-3 text-xs font-bold uppercase text-gray-600">Transporter</th>
              <th className="text-left px-4 py-3 text-xs font-bold uppercase text-gray-600 whitespace-nowrap">Model</th>
              <th className="text-left px-4 py-3 text-xs font-bold uppercase text-gray-600">No. Voucher / Invoice</th>
              <th className="text-left px-4 py-3 text-xs font-bold uppercase text-gray-600">Komponen Biaya</th>
              <th className="text-right px-4 py-3 text-xs font-bold uppercase text-gray-600 whitespace-nowrap">Total Biaya</th>
              <th className="text-right px-4 py-3 text-xs font-bold uppercase text-gray-600 whitespace-nowrap">Invoice Value</th>
              <th className="text-center px-4 py-3 text-xs font-bold uppercase text-gray-600 whitespace-nowrap">Cost Ratio</th>
              <th className="text-center px-4 py-3 text-xs font-bold uppercase text-gray-600">OTD</th>
              <th className="text-center px-4 py-3 text-xs font-bold uppercase text-gray-600">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 && (
              <tr><td colSpan={13} className="px-4 py-8 text-center text-gray-400">Belum ada data shipment.</td></tr>
            )}
            {rows.map(r => {
              const vendorFromNotes = r.notes?.match(/Vendor: ([^|]+)/)?.[1]?.trim()
              const nopolFromNotes  = r.notes?.match(/Nopol: ([^|]+)/)?.[1]?.trim()
              const transporter     = r.transporter_name ?? vendorFromNotes ?? '-'
              const hasNoFee        = !(r.total_biaya ?? 0)

              return (
                <tr key={r.id} className={`hover:bg-gray-50 transition-colors ${hasNoFee ? 'bg-yellow-50/40' : ''}`}>
                  <td className="px-4 py-2.5 font-mono text-xs text-indigo-600 whitespace-nowrap">{r.trip_id ?? '-'}</td>
                  <td className="px-4 py-2.5 font-mono text-xs font-medium whitespace-nowrap">
                    {r.pss_no ?? (r.crossdocking_id ? `CD-${r.crossdocking_id}` : '-')}
                  </td>
                  <td className="px-4 py-2.5 text-xs max-w-[140px] truncate">{r.customer_name ?? '-'}</td>
                  <td className="px-4 py-2.5">
                    {r.dk_lk
                      ? <span className={`text-xs font-bold rounded px-1.5 py-0.5 ${r.dk_lk === 'DK' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                          {r.dk_lk}
                        </span>
                      : <span className="text-gray-300 text-xs">—</span>
                    }
                  </td>
                  <td className="px-4 py-2.5 text-xs">
                    <div>{transporter}</div>
                    {nopolFromNotes && <div className="text-gray-400 font-mono">{nopolFromNotes}</div>}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs rounded px-1.5 py-0.5 font-medium ${
                      r.cost_model === 'Internal'  ? 'bg-indigo-100 text-indigo-700' :
                      r.cost_model === 'Retail'    ? 'bg-purple-100 text-purple-700' :
                      r.cost_model === 'Trucking'  ? 'bg-orange-100 text-orange-700' :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {r.cost_model ?? '-'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs">
                    {r.cost_model === 'Internal'
                      ? <span className="font-mono text-gray-600">{r.payment_voucher_no ?? '-'}</span>
                      : <span className="font-mono text-gray-600">{r.invoice_no_eksternal ?? '-'}</span>
                    }
                  </td>
                  <td className="px-4 py-2.5">
                    {r.cost_model === 'Internal'
                      ? <InternalDetail r={r} />
                      : r.total_biaya_eksternal
                      ? <div className="text-xs text-gray-600">{rp(r.total_biaya_eksternal)}</div>
                      : <span className="text-gray-300 text-xs">Belum diisi</span>
                    }
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs font-bold">
                    {rp(r.total_biaya)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs">
                    {rp(r.invoice_value)}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <CostRatioBadge v={r.cost_ratio} />
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <OtdBadge v={r.is_on_time} />
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${
                      r.status === 'Delivered'  ? 'bg-green-100 text-green-700' :
                      r.status === 'In Transit' ? 'bg-orange-100 text-orange-700' :
                      r.status === 'Dispatched' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>{r.status}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {emptyRows.length > 0 && (
          <div className="px-4 py-2.5 border-t bg-yellow-50 text-xs text-yellow-700 flex items-center gap-2">
            <span className="font-bold">⚠</span>
            {emptyRows.length} shipment belum diisi biaya — klik baris di
            <Link href="/shipment" className="underline font-medium">Shipment Tracking</Link>
            untuk input biaya.
          </div>
        )}
      </div>
    </div>
  )
}
