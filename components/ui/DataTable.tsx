'use client'

import { Fragment, useState } from 'react'
import { ChevronDown } from 'lucide-react'

export type DataTableColumn<T> = {
  key: keyof T
  label: string
  width?: string
  render?: (value: any, row: T) => React.ReactNode
  sortable?: boolean
  hidden?: boolean
}

type Props<T> = {
  data: T[]
  columns: DataTableColumn<T>[]
  rowKey: keyof T
  onRowClick?: (row: T) => void
  expandable?: {
    render: (row: T) => React.ReactNode
    defaultOpen?: (row: T) => boolean
  }
  emptyMessage?: string
  loading?: boolean
  compact?: boolean
}

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  rowKey,
  onRowClick,
  expandable,
  emptyMessage = 'Tidak ada data',
  loading = false,
  compact = false,
}: Props<T>) {
  const [expandedRows, setExpandedRows] = useState<Set<any>>(() => {
    if (!expandable?.defaultOpen) return new Set()
    return new Set(data.filter(row => expandable.defaultOpen?.(row)).map(row => row[rowKey]))
  })

  const toggleExpand = (rowId: any) => {
    setExpandedRows(prev => {
      const next = new Set(prev)
      if (next.has(rowId)) next.delete(rowId)
      else next.add(rowId)
      return next
    })
  }

  const visibleCols = columns.filter(c => !c.hidden)

  if (loading) {
    return (
      <div className="bg-white border border-border rounded-xl overflow-hidden">
        <div className="divide-y divide-border">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="p-4 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-gray-100 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="bg-white border border-border rounded-xl overflow-hidden">
        <div className="px-6 py-12 text-center">
          <div className="text-muted mb-2">
            <svg className="w-12 h-12 mx-auto opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
          </div>
          <p className="text-sm font-medium text-text">{emptyMessage}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border border-border rounded-xl overflow-hidden">
      {/* Desktop View */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-border sticky top-0 z-10">
            <tr>
              {expandable && <th className="px-4 py-3 text-left"></th>}
              {visibleCols.map(col => (
                <th
                  key={String(col.key)}
                  className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wide whitespace-nowrap"
                  style={{ width: col.width }}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.map(row => {
              const rowId = row[rowKey]
              const isExpanded = expandedRows.has(rowId)
              return (
                <Fragment key={rowId}>
                  <tr
                    onClick={() => onRowClick?.(row)}
                    className={`hover:bg-gray-50 transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
                  >
                    {expandable && (
                      <td className="px-4 py-3">
                        <button
                          onClick={e => {
                            e.stopPropagation()
                            toggleExpand(rowId)
                          }}
                          className="p-1 hover:bg-gray-200 rounded transition-colors"
                        >
                          <ChevronDown
                            size={16}
                            className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          />
                        </button>
                      </td>
                    )}
                    {visibleCols.map(col => (
                      <td
                        key={String(col.key)}
                        className="px-4 py-3 text-sm text-gray-700"
                        style={{ width: col.width }}
                      >
                        {col.render ? col.render(row[col.key], row) : row[col.key] ?? '-'}
                      </td>
                    ))}
                  </tr>
                  {expandable && isExpanded && (
                    <tr className="bg-gray-50 border-t border-gray-100">
                      <td colSpan={visibleCols.length + (expandable ? 1 : 0)} className="px-4 py-4">
                        {expandable.render(row)}
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden divide-y divide-border">
        {data.map(row => {
          const rowId = row[rowKey]
          const isExpanded = expandedRows.has(rowId)
          return (
            <div key={rowId} className="p-4">
              <div
                onClick={() => {
                  onRowClick?.(row)
                  if (expandable) toggleExpand(rowId)
                }}
                className={`grid grid-cols-2 gap-3 ${onRowClick || expandable ? 'cursor-pointer' : ''}`}
              >
                {visibleCols.slice(0, 4).map(col => (
                  <div key={String(col.key)} className="min-w-0">
                    <div className="text-xs font-bold text-muted mb-1">{col.label}</div>
                    <div className="text-sm text-text truncate">
                      {col.render ? col.render(row[col.key], row) : row[col.key] ?? '-'}
                    </div>
                  </div>
                ))}
              </div>
              {expandable && (
                <>
                  <button
                    onClick={() => toggleExpand(rowId)}
                    className="mt-3 text-xs text-blue font-medium flex items-center gap-1"
                  >
                    <ChevronDown
                      size={14}
                      className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    />
                    {isExpanded ? 'Tutup' : 'Detail'}
                  </button>
                  {isExpanded && <div className="mt-3 pt-3 border-t border-border">{expandable.render(row)}</div>}
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
