'use client'

import { ReactNode } from 'react'
import { AlertCircle, Package, TrendingUp, Truck, Users, Zap } from 'lucide-react'

type EmptyStateProps = {
  icon?: 'box' | 'alert' | 'trending' | 'users' | 'zap' | 'truck'
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
}

const iconMap = {
  box: Package,
  alert: AlertCircle,
  trending: TrendingUp,
  users: Users,
  zap: Zap,
  truck: Truck,
}

export function EmptyState({ icon = 'box', title, description, action }: EmptyStateProps) {
  const Icon = iconMap[icon]

  return (
    <div className="empty-state">
      <span className="empty-state-icon" aria-hidden="true"><Icon size={20} strokeWidth={1.75} /></span>
      <h3 className="empty-state-title">{title}</h3>
      {description && <p className="empty-state-text">{description}</p>}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}

export function SkeletonLoader({ count = 5, compact = false }: { count?: number; compact?: boolean }) {
  return (
    <div className="bg-white border border-border rounded-xl overflow-hidden">
      <div className="divide-y divide-border">
        {[...Array(count)].map((_, i) => (
          <div key={i} className={`${compact ? 'p-3' : 'p-4'} animate-pulse`}>
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-3 bg-gray-100 rounded w-1/2"></div>
              {!compact && <div className="h-3 bg-gray-100 rounded w-2/3"></div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function SkeletonCard({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {[...Array(count)].map((_, i) => (
        <div key={i} className="bg-white border border-border rounded-xl p-4 animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-3"></div>
          <div className="h-8 bg-gray-100 rounded w-3/4 mb-2"></div>
          <div className="h-3 bg-gray-100 rounded w-2/3"></div>
        </div>
      ))}
    </div>
  )
}

export function SkeletonTable({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="bg-white border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="hidden md:grid gap-4 p-4 border-b border-border bg-gray-50" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {[...Array(cols)].map((_, i) => (
          <div key={i} className="h-4 bg-gray-200 rounded w-3/4 animate-pulse"></div>
        ))}
      </div>

      {/* Rows */}
      <div className="divide-y divide-border">
        {[...Array(rows)].map((_, i) => (
          <div key={i} className="hidden md:grid gap-4 p-4" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
            {[...Array(cols)].map((_, j) => (
              <div key={j} className="h-4 bg-gray-100 rounded w-3/4 animate-pulse"></div>
            ))}
          </div>
        ))}
      </div>

      {/* Mobile */}
      <div className="md:hidden divide-y divide-border">
        {[...Array(rows)].map((_, i) => (
          <div key={i} className="p-4 space-y-2 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-3 bg-gray-100 rounded w-2/3"></div>
            <div className="h-3 bg-gray-100 rounded w-3/4"></div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Baris tabel tiruan selama data dimuat. Lebar acak-tetap agar terlihat alami. */
export function SkeletonRows({ cols, rows = 5 }: { cols: number; rows?: number }) {
  const widths = ['w-24', 'w-32', 'w-40', 'w-20', 'w-28', 'w-36']
  return (
    <>
      {Array.from({ length: rows }, (_, row) => (
        <tr key={row} aria-hidden="true">
          {Array.from({ length: cols }, (_, col) => (
            <td key={col} className="px-4 py-3.5">
              <div className={`lux-skeleton h-3.5 ${widths[(row + col * 2) % widths.length]} max-w-full`} />
            </td>
          ))}
        </tr>
      ))}
      <tr className="sr-only"><td>Memuat data…</td></tr>
    </>
  )
}
