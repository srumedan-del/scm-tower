'use client'

import { useId, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'

export type TabItem<T extends string> = {
  value: T
  label: ReactNode
  icon?: LucideIcon
  /** Jumlah di badge; tidak tampil bila 0 atau kosong. */
  count?: number
  /** Badge berwarna peringatan untuk pekerjaan yang menunggu tindakan. */
  attention?: boolean
}

/** Tab garis bawah dengan indikator yang bergeser halus. Satu gaya untuk semua halaman. */
export function Tabs<T extends string>({ items, value, onChange, label }: {
  items: TabItem<T>[]
  value: T
  onChange: (value: T) => void
  label: string
}) {
  const indicatorId = useId()
  return (
    <div role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto border-b border-border">
      {items.map(item => {
        const active = item.value === value
        const Icon = item.icon
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={`relative flex min-h-11 shrink-0 items-center gap-2 px-4 pb-3 pt-2 text-sm font-semibold transition-colors ${
              active ? 'text-indigo-900' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {Icon && <Icon className={`h-4 w-4 ${active ? 'text-gold-600' : ''}`} aria-hidden="true" />}
            <span>{item.label}</span>
            {item.count ? (
              <span className={`rounded-full px-2 py-0.5 text-xs font-bold leading-none ${
                item.attention ? 'bg-gold-100 text-gold-800' : 'bg-indigo-100 text-indigo-700'
              }`}>
                {item.count.toLocaleString('id-ID')}
              </span>
            ) : null}
            {active && (
              <motion.span
                layoutId={indicatorId}
                className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-gold-500"
                transition={{ type: 'spring', stiffness: 480, damping: 38 }}
              />
            )}
          </button>
        )
      })}
    </div>
  )
}
