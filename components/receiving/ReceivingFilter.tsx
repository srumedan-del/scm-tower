'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useState, useRef, useEffect } from 'react'
import { Calendar, ChevronDown, Filter, Check } from 'lucide-react'

type Props = {
  months: string[]
}

export default function ReceivingFilter({ months }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  const selected = searchParams.getAll('month')
  const selectedSet = new Set(selected)

  const updateUrl = useCallback((newSelected: string[]) => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('month')
    newSelected.forEach((m) => params.append('month', m))
    const qs = params.toString()
    router.push(qs ? `?${qs}` : '?', { scroll: false })
  }, [router, searchParams])

  const toggleMonth = useCallback((m: string) => {
    const current = selected.includes(m)
      ? selected.filter((v) => v !== m)
      : [...selected, m]
    updateUrl(current)
  }, [selected, updateUrl])

  const clearAll = useCallback(() => {
    updateUrl([])
    setOpen(false)
  }, [updateUrl])

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
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex h-10 items-center gap-2 rounded-xl border border-[#D8DEE8] bg-white px-3.5 text-sm font-semibold text-[#334155] shadow-sm transition-colors hover:bg-[#F8FAFC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
      >
        <Calendar className="h-4 w-4 text-[#64748B]" />
        <span>{selected.length > 0 ? `${selected.length} bulan` : 'Pilih Bulan'}</span>
        <ChevronDown className="h-3 w-3 text-[#64748B]" />
      </button>

      {selected.length > 0 && (
        <button
          onClick={clearAll}
          className="flex h-10 items-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-white px-3 text-xs font-semibold text-[#64748B] transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
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
            top: `${(triggerRef.current?.getBoundingClientRect().bottom ?? 0) + window.scrollY}px`,
            left: `${(triggerRef.current?.getBoundingClientRect().left ?? 0) + window.scrollX}px`,
            minWidth: `${triggerRef.current?.getBoundingClientRect().width ?? 0}px`,
            maxHeight: '320px',
            overflowY: 'auto',
          }}
        >
          <div className="p-2 border-b border-gray-200">
            <span className="text-xs font-semibold text-gray-500">Pilih Bulan</span>
          </div>
          <div className="py-1">
            {months.map((m) => {
              const [year, month] = m.split('-')
              const label = new Date(Number(year), Number(month) - 1).toLocaleDateString('id-ID', {
                month: 'long',
                year: 'numeric',
              })
              const isChecked = selectedSet.has(m)
              return (
                <label
                  key={m}
                  onClick={() => toggleMonth(m)}
                  className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-50"
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
                  <span className="text-sm">{label}</span>
                </label>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
