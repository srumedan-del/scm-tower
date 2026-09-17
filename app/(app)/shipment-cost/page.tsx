import { getShipmentCosts } from './actions'
import ShipmentCostClient from './ShipmentCostClient'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function ShipmentCostPage() {
  const rows = await getShipmentCosts()

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">SHIPMENT COST</h1>
        </div>
        <Link href="/shipment" className="text-sm text-indigo-600 hover:underline">← Kembali ke Shipment Tracking</Link>
      </header>

      <ShipmentCostClient rows={rows} />
    </div>
  )
}
