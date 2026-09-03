'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'
import { Calendar, ChevronDown, Filter } from 'lucide-react'

type Props = {
  months: string[] // e.g. ["2026-01", "2026-02", ...]
}

export default function ReceivingFilter({ months }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const current = searchParams.get('month') ?? ''

  const handleChange = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set('month', value)
      } else {
        params.delete('month')
      }
      router.push(`?${params.toString()}`, { scroll: false })
    },
    [router, searchParams]
  )

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm">
        <Calendar className="h-4 w-4 text-gray-500" />
        <select
          value={current}
          onChange={(e) => handleChange(e.target.value)}
          className="bg-transparent appearance-none focus:outline-none cursor-pointer pr-4"
        >
          <option value="">Semua Bulan</option>
          {months.map((m) => {
            const [year, month] = m.split('-')
            const label = new Date(Number(year), Number(month) - 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
            return (
              <option key={m} value={m}>
                {label}
              </option>
            )
          })}
        </select>
        <ChevronDown className="h-3 w-3 text-gray-400 pointer-events-none" />
      </div>
      {current && (
        <button
          onClick={() => handleChange('')}
          className="flex items-center gap-1.5 rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
        >
          <Filter className="h-3 w-3 rotate-180" />
          Reset
        </button>
      )}
    </div>
  )
}
