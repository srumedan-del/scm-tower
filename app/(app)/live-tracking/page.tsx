import DriverLiveTrackingMap from '@/components/shipment/DriverLiveTrackingMap'
import { requireAuthenticatedUser } from '@/lib/requireUser'

export const dynamic = 'force-dynamic'

export default async function LiveTrackingPage() {
  await requireAuthenticatedUser()
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-3xl font-bold">LIVE TRACKING</h1>
        <p className="mt-1 text-sm text-slate-500">Posisi dan jalur driver pada trip yang sedang berjalan.</p>
      </header>
      <DriverLiveTrackingMap />
    </div>
  )
}
