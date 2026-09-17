'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

type SearchableOption = {
  value: string | number
  label: string
}

type Props = {
  value: string | number | null | undefined
  options: SearchableOption[]
  onChange: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  className?: string
  disabled?: boolean
}

export default function SearchableSelect({
  value,
  options,
  onChange,
  placeholder = 'Pilih...',
  searchPlaceholder = 'Ketik untuk mencari...',
  className = '',
  disabled = false,
}: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const selected = options.find(option => String(option.value) === String(value ?? ''))
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return options
    return options.filter(option => option.label.toLowerCase().includes(normalized))
  }, [options, query])

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => { setOpen(current => !current); setQuery('') }}
        className={`inp w-full text-left disabled:bg-gray-50 disabled:text-muted disabled:cursor-not-allowed ${className}`}
      >
        {selected?.label ?? placeholder}
      </button>
      {open && !disabled && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
          <input
            autoFocus
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder={searchPlaceholder}
            className="w-full border-b border-gray-200 px-3 py-2 text-sm outline-none"
          />
          <div className="max-h-56 overflow-y-auto">
            <button type="button" onClick={() => { onChange(''); setOpen(false) }} className="block w-full px-3 py-2 text-left text-sm text-gray-500 hover:bg-blue-50">
              {placeholder}
            </button>
            {filtered.map(option => (
              <button key={String(option.value)} type="button" onClick={() => { onChange(String(option.value)); setOpen(false) }} className="block w-full px-3 py-2 text-left text-sm hover:bg-blue-50">
                {option.label}
              </button>
            ))}
            {!filtered.length && <div className="px-3 py-2 text-sm text-gray-500">Tidak ditemukan.</div>}
          </div>
        </div>
      )}
    </div>
  )
}
