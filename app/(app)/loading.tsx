export default function Loading() {
  return (
    <div className="space-y-4" role="status" aria-label="Memuat halaman">
      <div className="lux-skeleton h-9 w-56" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map(index => <div key={index} className="lux-skeleton h-24" />)}
      </div>
      <div className="lux-skeleton h-80" />
    </div>
  )
}
