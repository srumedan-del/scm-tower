import DriverLiveTrackingMap from '@/components/shipment/DriverLiveTrackingMap'
import { requireAuthenticatedUser } from '@/lib/requireUser'

export const dynamic = 'force-dynamic'

export default async function LiveTrackingPage() {
  await requireAuthenticatedUser()
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-3xl font-bold">LIVE TRACKING</h1>
      </header>
      <DriverLiveTrackingMap />
    </div>
  )
}
