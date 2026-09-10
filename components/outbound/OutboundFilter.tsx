'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useState, useRef, useEffect } from 'react'
import { Calendar, ChevronDown, Filter, Check, Search, X } from 'lucide-react'

type Props = {
  months: string[]
}

export default function OutboundFilter({ months }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(false)
  const [customerSearch, setCustomerSearch] = useState('')
  const triggerRef = useRef<HTMLDivElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  const selected = searchParams.getAll('month')
  const selectedSet = new Set(selected)
  const customer = searchParams.get('customer')?.trim() ?? ''

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

  const updateCustomer = useCallback((value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('customer')
    if (value) params.set('customer', value)
    const qs = params.toString()
    router.replace(qs ? `?${qs}` : '?', { scroll: false })
  }, [router, searchParams])

  useEffect(() => {
    setCustomerSearch(customer)
  }, [customer])

  useEffect(() => {
    const normalized = customerSearch.trim()
    if (normalized === customer) return

    const timeoutId = window.setTimeout(() => updateCustomer(normalized), 300)
    return () => window.clearTimeout(timeoutId)
  }, [customer, customerSearch, updateCustomer])

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
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          value={customerSearch}
          onChange={(event) => setCustomerSearch(event.target.value)}
          placeholder="Cari customer..."
          aria-label="Cari berdasarkan nama customer"
          className="w-48 rounded-lg border border-gray-300 bg-white py-1.5 pl-9 pr-8 text-sm text-gray-700 shadow-sm outline-none placeholder:text-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
        />
        {customerSearch && (
          <button
            type="button"
            onClick={() => {
              setCustomerSearch('')
              updateCustomer('')
            }}
            aria-label="Hapus pencarian customer"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded text-gray-400 hover:text-gray-700"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <div
        ref={triggerRef}
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm cursor-pointer hover:bg-gray-50"
      >
        <Calendar className="h-4 w-4 text-gray-500" />
        <span>{selected.length > 0 ? `${selected.length} bulan` : 'Pilih Bulan'}</span>
        <ChevronDown className="h-3 w-3 text-gray-400" />
      </div>

      {selected.length > 0 && (
        <button
          onClick={clearAll}
          className="flex items-center gap-1.5 rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
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
