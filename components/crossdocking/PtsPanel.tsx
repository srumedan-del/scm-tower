'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import * as XLSX from 'xlsx'
import { FileSpreadsheet, Package, Upload, X } from 'lucide-react'
import {
  getPtsDetailsForCrossdocking,
  getPtsRecords,
  uploadPtsRecords,
  type PtsRecord,
} from '@/app/(app)/crossdocking/actions'

type UploadRow = {
  pts_no: string
  document_date: string | null
  document_created_at: string | null
  transfer_order_no: string | null
  details: Array<{
    nav_entry_no: number | null
    document_line_no: number | null
    item_no: string | null
    variant_code: string | null
    description: string | null
    quantity: number | null
    lot_no: string | null
    expiration_date: string | null
    source_location_code: string | null
  }>
}

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function findValue(row: Record<string, unknown>, names: string[]) {
  const byHeader = new Map(Object.entries(row).map(([key, value]) => [normalizeHeader(key), value]))
  for (const name of names) {
    const value = byHeader.get(name)
    if (value !== undefined && String(value).trim()) return value
  }
  return null
}

function toDate(value: unknown): string | null {
  if (!value) return null
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10)
  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value)
    return date ? `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}` : null
  }
  const text = String(value).trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10)
  const match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  return match ? `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}` : null
}

function toDateTime(value: unknown): string | null {
  if (!value) return null
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString()
  const text = String(value).trim()
  const match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
  if (!match) return null
  const year = match[3].length === 2 ? `20${match[3]}` : match[3]
  return `${year}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}T${match[4].padStart(2, '0')}:${match[5]}:${match[6] ?? '00'}+07:00`
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const normalized = String(value).trim().replace(/,/g, '').replace(/\.$/, '')
  const number = Number(normalized)
  return Number.isFinite(number) ? number : null
}

function parsePtsWorkbook(buffer: ArrayBuffer): UploadRow[] {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  if (!sheet) return []
  const source = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
  const grouped = new Map<string, UploadRow>()
  for (const row of source) {
    const ptsNo = String(findValue(row, ['ptsno', 'postedtransfershipmentno', 'transfershipmentno', 'documentno', 'shipmentno']) ?? '').trim().toUpperCase()
    if (!ptsNo) continue
    const detail = {
      nav_entry_no: toNumber(findValue(row, ['entryno'])),
      document_line_no: toNumber(findValue(row, ['documentlineno'])),
      item_no: String(findValue(row, ['itemno']) ?? '').trim() || null,
      variant_code: String(findValue(row, ['variantcode']) ?? '').trim() || null,
      description: String(findValue(row, ['description']) ?? '').trim() || null,
      quantity: toNumber(findValue(row, ['quantity'])),
      lot_no: String(findValue(row, ['lotno']) ?? '').trim() || null,
      expiration_date: toDate(findValue(row, ['expirationdate'])),
      source_location_code: String(findValue(row, ['locationcode']) ?? '').trim() || null,
    }
    const existing = grouped.get(ptsNo)
    if (existing) {
      existing.details.push(detail)
      continue
    }
    grouped.set(ptsNo, {
      pts_no: ptsNo,
      document_date: toDate(findValue(row, ['documentdate', 'postingdate', 'shipmentdate', 'date'])),
      document_created_at: toDateTime(findValue(row, ['documentcreateddatetime', 'createddatetime'])),
      transfer_order_no: String(findValue(row, ['transferorderno', 'transferorder', 'orderno']) ?? '').trim().toUpperCase() || null,
      details: [detail],
    })
  }
  return [...grouped.values()]
}

export default function PtsPanel() {
  const [rows, setRows] = useState<PtsRecord[]>([])
  const [loading, startLoading] = useTransition()
  const [uploadOpen, setUploadOpen] = useState(false)
  const [selected, setSelected] = useState<PtsRecord | null>(null)

  const load = () => startLoading(async () => {
    try {
      setRows(await getPtsRecords())
    } catch (error: any) {
      alert(`Tidak dapat memuat PTS: ${error.message}`)
    }
  })

  useEffect(() => { load() }, [])

  const pendingCount = useMemo(
    () => rows.filter(row => row.status === 'Menunggu Crossdocking').length,
    [rows]
  )

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-white px-4 py-3">
        <div>
          <h2 className="font-semibold text-gray-800">Daftar PTS</h2>
          <p className="text-xs text-gray-500">{pendingCount} PTS siap dipilih saat membuat Crossdocking Header.</p>
        </div>
        <button
          type="button"
          onClick={() => setUploadOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
        >
          <Upload className="h-4 w-4" /> Upload PTS
        </button>
      </div>

      <div className="data-list-scroll overflow-auto rounded-xl border border-border bg-white">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="sticky top-0 z-10 border-b bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-600">PTS No.</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-600">Document Date</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-600">Transfer Order</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-600">Sumber File</th>
              <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wide text-gray-600">Status</th>
              <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wide text-gray-600">Item</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-400">Memuat PTS...</td></tr>}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-400">Belum ada PTS. Klik <strong>Upload PTS</strong> untuk mulai.</td></tr>
            )}
            {rows.map(row => (
              <tr key={row.id} className="hover:bg-blue-50">
                <td className="px-4 py-2.5 font-mono text-xs font-semibold text-indigo-600">{row.pts_no}</td>
                <td className="px-4 py-2.5 text-xs whitespace-nowrap">{row.document_date ?? '-'}</td>
                <td className="px-4 py-2.5 font-mono text-xs">{row.transfer_order_no ?? '-'}</td>
                <td className="max-w-[280px] px-4 py-2.5 text-xs text-gray-600"><div className="truncate">{row.source_file_name ?? '-'}</div></td>
                <td className="px-4 py-2.5 text-center">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    row.status === 'Terhubung Crossdocking' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                  }`}>{row.status}</span>
                </td>
                <td className="px-4 py-2.5 text-center">
                  <button type="button" onClick={() => setSelected(row)} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-50">
                    <Package className="h-3.5 w-3.5" /> Lihat item
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {uploadOpen && <UploadPtsModal onClose={() => setUploadOpen(false)} onSaved={() => { setUploadOpen(false); load() }} />}
      {selected && <PtsDetailModal record={selected} onClose={() => setSelected(null)} />}
    </section>
  )
}

function PtsDetailModal({ record, onClose }: { record: PtsRecord; onClose: () => void }) {
  const [items, setItems] = useState<Array<{ item_no: string | null; description: string | null; quantity: number; lot_no: string | null; expiration_date: string | null; notes: string | null }>>([])
  const [loading, startLoading] = useTransition()

  useEffect(() => {
    startLoading(async () => setItems(await getPtsDetailsForCrossdocking(record.id)))
  }, [record.id])

  const total = items.reduce((sum, item) => sum + item.quantity, 0)
  return <Modal title={`Detail item ${record.pts_no}`} onClose={onClose} wide>
    <p className="mb-3 text-sm text-gray-600">{record.document_date ?? '-'} · Total {total.toLocaleString('id-ID')} unit</p>
    <div className="max-h-[55vh] overflow-auto rounded-lg border border-gray-200">
      <table className="w-full min-w-[620px] text-xs">
        <thead className="sticky top-0 bg-gray-50"><tr><th className="px-3 py-2 text-left">Item No.</th><th className="px-3 py-2 text-left">Deskripsi</th><th className="px-3 py-2 text-right">Qty</th><th className="px-3 py-2 text-left">Lot</th><th className="px-3 py-2 text-left">Expired</th><th className="px-3 py-2 text-left">Sumber</th></tr></thead>
        <tbody className="divide-y divide-gray-100">
          {loading && <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-400">Memuat item...</td></tr>}
          {!loading && items.map((item, index) => <tr key={`${item.item_no}-${item.lot_no}-${index}`}><td className="px-3 py-2 font-mono">{item.item_no ?? '-'}</td><td className="px-3 py-2">{item.description ?? '-'}</td><td className="px-3 py-2 text-right font-semibold">{item.quantity.toLocaleString('id-ID')}</td><td className="px-3 py-2 font-mono">{item.lot_no ?? '-'}</td><td className="px-3 py-2">{item.expiration_date ?? '-'}</td><td className="px-3 py-2 text-gray-500">{item.notes ?? '-'}</td></tr>)}
          {!loading && items.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-400">Tidak ada detail item.</td></tr>}
        </tbody>
      </table>
    </div>
  </Modal>
}

function UploadPtsModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [rows, setRows] = useState<UploadRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, startSaving] = useTransition()

  async function chooseFile(event: React.ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] ?? null
    setFile(nextFile)
    setRows([])
    setError(null)
    if (!nextFile) return
    try {
      const parsed = parsePtsWorkbook(await nextFile.arrayBuffer())
      if (!parsed.length) throw new Error('Kolom PTS tidak ditemukan. Gunakan header seperti PTS No., Document No., atau Transfer Shipment No.')
      setRows(parsed)
    } catch (err: any) {
      setError(`File tidak dapat dibaca: ${err.message}`)
    }
  }

  function save() {
    if (!file || !rows.length) return
    startSaving(async () => {
      try {
        const result = await uploadPtsRecords(rows, file.name)
        alert(`${result.inserted} dari ${result.total} PTS baru berhasil diunggah.`)
        onSaved()
      } catch (err: any) {
        setError(err.message)
      }
    })
  }

  return <Modal title="Upload PTS" onClose={onClose}>
    <div className="space-y-4">
      <p className="text-sm text-gray-600">Semua item, lot, expired date, dan quantity dari PTS NAV akan ikut tersimpan. Setelah tujuan diatur, Crossdocking dibuat otomatis tanpa input item manual.</p>
      <label className="block rounded-lg border-2 border-dashed border-gray-200 p-6 text-center hover:border-indigo-300">
        <FileSpreadsheet className="mx-auto h-8 w-8 text-emerald-600" />
        <span className="mt-2 block text-sm font-medium text-gray-700">Pilih file Excel PTS</span>
        <span className="mt-1 block text-xs text-gray-500">.xlsx atau .xls; gunakan kolom PTS No. / Document No.</span>
        <input type="file" accept=".xlsx,.xls" className="sr-only" onChange={chooseFile} />
      </label>
      {file && <p className="text-xs text-gray-500">{file.name} {rows.length ? `• ${rows.length} nomor PTS dan ${rows.reduce((sum, row) => sum + row.details.length, 0)} item ditemukan` : ''}</p>}
      {rows.length > 0 && <div className="max-h-40 overflow-auto rounded-lg border border-gray-200">
        <table className="w-full text-xs"><thead className="sticky top-0 bg-gray-50"><tr><th className="px-3 py-2 text-left">PTS No.</th><th className="px-3 py-2 text-left">Tanggal</th><th className="px-3 py-2 text-left">Detail Item</th></tr></thead>
          <tbody>{rows.slice(0, 10).map(row => <tr key={row.pts_no} className="border-t"><td className="px-3 py-2 font-mono">{row.pts_no}</td><td className="px-3 py-2">{row.document_date ?? '-'}</td><td className="px-3 py-2">{row.details.length} item</td></tr>)}</tbody>
        </table>
      </div>}
      {error && <p className="rounded-md bg-red-50 p-2 text-sm text-red-700">{error}</p>}
    </div>
    <ModalFooter onClose={onClose} onSave={save} disabled={!rows.length || saving} label={saving ? 'Mengunggah...' : 'Simpan PTS'} />
  </Modal>
}

function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
    <div className={`w-full ${wide ? 'max-w-6xl' : 'max-w-lg'} overflow-hidden rounded-xl bg-white shadow-2xl`}>
      <div className="flex items-center justify-between border-b px-5 py-4"><h3 className="font-bold text-gray-900">{title}</h3><button type="button" onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"><X className="h-5 w-5" /></button></div>
      <div className="p-5">{children}</div>
    </div>
  </div>
}

function ModalFooter({ onClose, onSave, disabled, label }: { onClose: () => void; onSave: () => void; disabled: boolean; label: string }) {
  return <div className="mt-5 flex justify-end gap-2 border-t pt-4"><button type="button" onClick={onClose} className="rounded-lg border px-3 py-2 text-sm">Batal</button><button type="button" onClick={onSave} disabled={disabled} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">{label}</button></div>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-xs font-bold text-gray-700">{label}</span>{children}</label>
}
