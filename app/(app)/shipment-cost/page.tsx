import { getShipmentCosts, getShipmentCostAvailableMonths } from './actions'
import ShipmentCostClient from './ShipmentCostClient'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function ShipmentCostPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const sp = await searchParams
  const availableMonths = await getShipmentCostAvailableMonths()
  const currentMonthStr = new Date().toISOString().slice(0, 7)
  const defaultMonth = availableMonths.includes(currentMonthStr)
    ? currentMonthStr
    : (availableMonths[0] ?? currentMonthStr)

  const selectedMonth = sp.month ?? defaultMonth
  const rows = await getShipmentCosts({
    status: 'Delivered',
    month: selectedMonth,
  })

  return (
    <div className="space-y-4 font-sans">
      <header className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Shipment Cost</h1>
          <p className="text-xs text-slate-500 mt-1">
            Realisasi biaya operasional dan sewa pengiriman untuk shipment berstatus <strong>Delivered</strong>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/shipment"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-indigo-600 shadow-2xs hover:bg-indigo-50 hover:border-indigo-200 transition-colors"
          >
            ← Kembali ke Shipment Tracking
          </Link>
        </div>
      </header>

      <ShipmentCostClient
        rows={rows}
        months={availableMonths}
        defaultMonth={defaultMonth}
        selectedMonth={selectedMonth}
      />
    </div>
  )
}
