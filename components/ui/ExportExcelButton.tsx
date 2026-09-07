'use client'

import { useState } from 'react'
import { FileDown, Loader2 } from 'lucide-react'
import { exportToExcel, type ExportSheetConfig } from '@/lib/exportExcel'

type Props = {
  /** Fungsi async yang mengembalikan config sheet(s) untuk di-export */
  getData: () => Promise<ExportSheetConfig[]>
  fileName: string
  label?: string
  variant?: 'primary' | 'outline'
  className?: string
}

export function ExportExcelButton({
  getData,
  fileName,
  label = 'Export Excel',
  variant = 'outline',
  className = '',
}: Props) {
  const [loading, setLoading] = useState(false)
  const [err, setErr]         = useState<string | null>(null)

  async function handleClick() {
    setErr(null)
    setLoading(true)
    try {
      const sheets = await getData()
      if (!sheets.length || sheets.every(s => s.rows.length === 0)) {
        setErr('Tidak ada data untuk di-export.')
        return
      }
      exportToExcel(sheets, fileName)
    } catch (e: any) {
      setErr(e.message ?? 'Export gagal')
    } finally {
      setLoading(false)
    }
  }

  const base = 'inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50'
  const styles = variant === 'primary'
    ? `${base} bg-emerald-600 text-white hover:bg-emerald-500`
    : `${base} border border-border bg-white text-gray-700 hover:bg-gray-50`

  return (
    <div className="flex flex-col items-end gap-1">
      <button onClick={handleClick} disabled={loading} className={`${styles} ${className}`}>
        {loading
          ? <Loader2 className="h-4 w-4 animate-spin" />
          : <FileDown className="h-4 w-4" />}
        {loading ? 'Mengekspor...' : label}
      </button>
      {err && <span className="text-xs text-red-500">{err}</span>}
    </div>
  )
}
