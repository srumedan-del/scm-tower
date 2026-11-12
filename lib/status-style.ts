/**
 * Satu palet warna status untuk seluruh aplikasi, supaya "In Transit" selalu
 * terlihat sama di Shipment, Crossdocking, Dashboard, Service Level, dan Trip.
 */
const STATUS_CLASS: Record<string, string> = {
  Draft: 'bg-slate-100 text-slate-600',
  Ready: 'bg-slate-100 text-slate-700',
  Assigned: 'bg-slate-100 text-slate-700',
  Dispatched: 'bg-blue-100 text-blue-700',
  'In Transit': 'bg-amber-100 text-amber-800',
  Delivered: 'bg-green-100 text-green-700',
  Completed: 'bg-green-100 text-green-700',
  'Failed Delivery': 'bg-red-100 text-red-700',
  Cancelled: 'bg-red-100 text-red-700',
  Closed: 'bg-slate-100 text-slate-500',
}

export function statusClass(status: string | null | undefined) {
  return STATUS_CLASS[status ?? ''] ?? 'bg-slate-100 text-slate-500'
}
