'use client'

import { useState, useRef, useEffect } from 'react'
import { Calendar, ChevronDown, Check, Filter } from 'lucide-react'

type Props = {
  months: string[]
  selectedMonth: string
  defaultMonth: string
  onSelectMonth: (month: string) => void
}

export default function MonthFilter({
  months,
  selectedMonth,
  defaultMonth,
  onSelectMonth,
}: Props) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  const isAll = selectedMonth === 'all'

  const formatMonthLabel = (m: string) => {
    if (m === 'all') return 'Semua Bulan'
    const [year, month] = m.split('-')
    return new Date(Number(year), Number(month) - 1).toLocaleDateString('id-ID', {
      month: 'long',
      year: 'numeric',
    })
  }

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="relative inline-flex items-center gap-2">
      <button
        type="button"
        ref={triggerRef}
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="flex h-10 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 text-sm font-semibold text-slate-700 shadow-xs transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        <Calendar className="h-4 w-4 text-slate-500" />
        <span>{formatMonthLabel(selectedMonth)}</span>
        <ChevronDown className="h-3 w-3 text-slate-500" />
      </button>

      {selectedMonth !== defaultMonth && (
        <button
          type="button"
          onClick={() => onSelectMonth(defaultMonth)}
          className="flex h-10 items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 text-xs font-semibold text-slate-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
        >
          <Filter className="h-3 w-3 rotate-180" />
          Reset
        </button>
      )}

      {open && (
        <div
          ref={popoverRef}
          className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-xl"
          style={{
            top: `${(triggerRef.current?.getBoundingClientRect().bottom ?? 0) + window.scrollY + 4}px`,
            left: `${(triggerRef.current?.getBoundingClientRect().left ?? 0) + window.scrollX}px`,
            minWidth: `${Math.max(triggerRef.current?.getBoundingClientRect().width ?? 0, 220)}px`,
            maxHeight: '340px',
            overflowY: 'auto',
          }}
        >
          <div className="flex items-center justify-between p-2.5 border-b border-gray-100 bg-slate-50">
            <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">Periode Bulan</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  onSelectMonth(defaultMonth)
                  setOpen(false)
                }}
                className="px-2 py-0.5 text-[11px] font-semibold text-indigo-600 hover:bg-indigo-50 rounded"
              >
                Bulan Ini
              </button>
              <span className="text-gray-300">|</span>
              <button
                type="button"
                onClick={() => {
                  onSelectMonth('all')
                  setOpen(false)
                }}
                className="px-2 py-0.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 rounded"
              >
                Semua
              </button>
            </div>
          </div>
          <div className="py-1">
            {months.map((m) => {
              const label = formatMonthLabel(m)
              const isChecked = selectedMonth === m
              return (
                <button
                  type="button"
                  key={m}
                  onClick={() => {
                    onSelectMonth(m)
                    setOpen(false)
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-gray-50 text-xs font-medium text-slate-700"
                >
                  <div
                    className={`flex h-4 w-4 items-center justify-center border rounded ${
                      isChecked
                        ? 'bg-indigo-600 border-indigo-600 text-white'
                        : 'border-gray-300'
                    }`}
                  >
                    {isChecked && <Check className="h-3 w-3" />}
                  </div>
                  <span>{label}</span>
                  {m === defaultMonth && (
                    <span className="ml-auto text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                      Berjalan
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
