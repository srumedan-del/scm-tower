'use client'

import { useRouter } from 'next/navigation'

export default function DashboardPeriodSelect({ period, months }: { period: string; months: string[] }) {
  const router = useRouter()

  return (
    <select
      aria-label="Periode data dashboard"
      value={period}
      onChange={(event) => router.push(`/dashboard?period=${event.target.value}`)}
      className="rounded-lg border border-border bg-white px-3 py-2 text-xs text-text shadow-sm"
    >
      {months.map((month) => {
        const [year, monthNumber] = month.split('-').map(Number)
        const label = new Date(year, monthNumber - 1, 1).toLocaleDateString('id-ID', {
          month: 'long',
          year: 'numeric',
        })
        return <option key={month} value={month}>{label}</option>
      })}
    </select>
  )
}
