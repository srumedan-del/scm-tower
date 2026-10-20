import Link from 'next/link'
import { getTrips } from './actions'
import { displayVendorName } from '@/lib/vendor-display'
import { TripCreateButton } from './TripCreateButton'

export const dynamic = 'force-dynamic'

function rupiah(value: number) {
  return value ? `Rp ${value.toLocaleString('id-ID')}` : '-'
}

const statusStyle: Record<string, string> = {
  Assigned: 'bg-slate-100 text-slate-700',
  Dispatched: 'bg-blue-100 text-blue-700',
  'In Transit': 'bg-amber-100 text-amber-700',
  Completed: 'bg-green-100 text-green-700',
  Cancelled: 'bg-red-100 text-red-700',
}

export default async function TripsPage() {
  const trips = await getTrips()

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">TRIP CONTROL</h1>
          <p className="mt-1 text-sm text-gray-500">
            Satu trip dapat memiliki beberapa stop; biaya dicatat satu kali pada trip lalu dialokasikan ke setiap stop.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/shipment" className="text-sm text-indigo-600 hover:underline">Buka Shipment Tracking →</Link>
          <TripCreateButton />
        </div>
      </header>

      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        Trip baru memakai master <code>vendors</code>, membuat stop dan event audit secara atomik. Shipment lama yang belum dipetakan dapat dimasukkan lewat tombol <strong>Buat Trip</strong>.
      </div>

      <section className="overflow-x-auto rounded-xl border border-border bg-white">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-xs font-bold uppercase tracking-wide text-gray-600">Trip terbaru</h2>
          <span className="text-xs text-gray-400">{trips.length} trip</span>
        </div>
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 border-b border-[#E5E7EB] bg-[#F8FAFC]">
            <tr>
              <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-[0.1em] text-[#64748B] whitespace-nowrap">Trip</th>
              <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-[0.1em] text-[#64748B] whitespace-nowrap">Transporter</th>
              <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-[0.1em] text-[#64748B] whitespace-nowrap">Armada / Driver</th>
              <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-[0.1em] text-[#64748B] whitespace-nowrap">Stop</th>
              <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-[0.1em] text-[#64748B] whitespace-nowrap">Biaya Trip</th>
              <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-[0.1em] text-[#64748B] whitespace-nowrap">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EEF0F4]">
            {trips.length === 0 && (
              <tr><td className="px-4 py-0.25 text-xs font-medium text-[#475569]">Belum ada trip v1.6.</td></tr>
            )}
            {trips.map((trip) => (
              <tr key={trip.id} className="hover:bg-gray-50">
                <td className="px-4 py-0.25 text-xs font-medium text-[#475569]">{trip.trip_no}</td>
                <td className="px-4 py-0.25 text-xs font-medium text-[#475569]">{displayVendorName(trip.vendor_name) || '-'}</td>
                <td className="px-4 py-0.25 text-xs font-medium text-[#475569]">{[trip.vehicle_no, trip.driver_name].filter(Boolean).join(' · ') || '-'}</td>
                <td className="px-4 py-0.25 text-xs font-medium text-[#475569]">{trip.stop_count}</td>
                <td className="px-4 py-0.25 text-xs font-medium text-[#475569]">{rupiah(trip.total_expense)}</td>
                <td className="px-4 py-0.25 text-xs font-medium text-center text-[#475569]">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusStyle[trip.status] ?? 'bg-gray-100 text-gray-600'}`}>
                    {trip.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
