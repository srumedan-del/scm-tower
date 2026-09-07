'use client'

import { useState, useTransition, useEffect } from 'react'
import {
  upsertSnapshot, deleteSnapshot, getSnapshotOptions,
  type InventorySnapshotRow, type WarehouseOption, type SkuOption,
} from '@/app/(app)/inventory/snapshot/actions'
import { Trash2 } from 'lucide-react'

type Props = {
  row: InventorySnapshotRow | null
  onClose: () => void
  onSaved: () => void
}

function today() { return new Date().toISOString().slice(0, 10) }

export default function SnapshotPanel({ row, onClose, onSaved }: Props) {
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([])
  const [skus,       setSkus]       = useState<SkuOption[]>([])
  const [optLoading, setOptLoading] = useState(true)

  const [form, setForm] = useState({
    snapshot_date:   row?.snapshot_date   ?? today(),
    warehouse_code:  row?.warehouse_code  ?? '',
    sku_code:        row?.sku_code        ?? '',
    qty_on_hand:     row?.qty_on_hand     ?? 0,
    qty_reserved:    row?.qty_reserved    ?? 0,
    avg_daily_usage: row?.avg_daily_usage ?? '',
    notes:           row?.notes           ?? '',
    source:          row?.source          ?? 'manual',
  })

  const [saving,   startSaving]   = useTransition()
  const [deleting, startDeleting] = useTransition()
  const [err, setErr] = useState<string | null>(null)

  const up = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    getSnapshotOptions().then(({ warehouses, skus }) => {
      setWarehouses(warehouses)
      setSkus(skus)
      setOptLoading(false)
    }).catch(() => setOptLoading(false))
  }, [])

  const selectedSku = skus.find(s => s.sku_code === form.sku_code)

  // Preview kalkulasi available & DOS
  const qtyAvail  = (Number(form.qty_on_hand) || 0) - (Number(form.qty_reserved) || 0)
  const avgUsage  = Number(form.avg_daily_usage) || 0
  const dos       = avgUsage > 0 && qtyAvail > 0 ? (qtyAvail / avgUsage).toFixed(1) : null
  const safetyStock = selectedSku?.safety_stock ?? null

  function alertStatus() {
    if (qtyAvail <= 0) return { label: 'STOCKOUT', color: 'text-red-700 bg-red-100' }
    if (avgUsage > 0) {
      const d = qtyAvail / avgUsage
      if (d < 3) return { label: 'CRITICAL', color: 'text-orange-700 bg-orange-100' }
      if (d < 7) return { label: 'LOW',      color: 'text-yellow-700 bg-yellow-100' }
    }
    return { label: 'OK', color: 'text-green-700 bg-green-100' }
  }

  function del() {
    if (!row) return
    if (!confirm(`Hapus snapshot ${row.sku_code} — ${row.warehouse_code}?`)) return
    startDeleting(async () => {
      try { await deleteSnapshot(row.id); onSaved(); onClose() }
      catch (e: any) { setErr(e.message) }
    })
  }

  function save() {
    startSaving(async () => {
      setErr(null)
      if (!form.warehouse_code) { setErr('Gudang wajib dipilih'); return }
      if (!form.sku_code)       { setErr('SKU wajib dipilih'); return }
      if (!form.snapshot_date)  { setErr('Tanggal snapshot wajib diisi'); return }
      try {
        await upsertSnapshot({
          id:              row?.id,
          snapshot_date:   form.snapshot_date,
          warehouse_code:  form.warehouse_code,
          sku_code:        form.sku_code,
          qty_on_hand:     Number(form.qty_on_hand) || 0,
          qty_reserved:    Number(form.qty_reserved) || 0,
          avg_daily_usage: form.avg_daily_usage !== '' ? Number(form.avg_daily_usage) : null,
          notes:           (form.notes as string).trim() || null,
          source:          'manual',
          import_period:   form.snapshot_date.slice(0, 7),
        })
        onSaved(); onClose()
      } catch (e: any) { setErr(e.message) }
    })
  }

  const status = alertStatus()

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between border-b p-4 shrink-0">
          <h3 className="font-bold text-lg uppercase">
            {row ? `Edit Snapshot — ${row.sku_code}` : 'Input Stok Snapshot'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto">
          {optLoading && <p className="text-sm text-gray-400 text-center py-4">Memuat opsi...</p>}

          {/* Tanggal & Gudang */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tanggal Snapshot *">
              <input type="date" value={form.snapshot_date}
                onChange={e => up('snapshot_date', e.target.value)} className="inp" />
            </Field>
            <Field label="Gudang *">
              {row ? (
                <div className="inp bg-gray-50 text-gray-700 font-mono">{row.warehouse_code}</div>
              ) : (
                <select value={form.warehouse_code} onChange={e => up('warehouse_code', e.target.value)} className="inp" disabled={optLoading}>
                  <option value="">-- Pilih gudang --</option>
                  {warehouses.map(w => (
                    <option key={w.warehouse_code} value={w.warehouse_code}>
                      {w.warehouse_code} — {w.warehouse_name}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          </div>

          {/* SKU */}
          <Field label="SKU *">
            {row ? (
              <div className="inp bg-gray-50 text-gray-700 font-mono">{row.sku_code} — {row.item_name}</div>
            ) : (
              <select value={form.sku_code} onChange={e => up('sku_code', e.target.value)} className="inp" disabled={optLoading}>
                <option value="">-- Pilih SKU --</option>
                {skus.map(s => (
                  <option key={s.sku_code} value={s.sku_code}>
                    {s.sku_code} — {s.item_name} ({s.uom})
                  </option>
                ))}
              </select>
            )}
          </Field>

          {selectedSku && (
            <div className="rounded-lg bg-indigo-50 border border-indigo-100 px-3 py-2 text-xs text-indigo-700">
              <strong>{selectedSku.item_name}</strong> · {selectedSku.uom}
              {selectedSku.safety_stock != null && (
                <span className="ml-2 text-indigo-500">Safety stock: {selectedSku.safety_stock.toLocaleString('id-ID')}</span>
              )}
            </div>
          )}

          {/* Qty */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Qty On Hand *">
              <input type="number" min={0} value={form.qty_on_hand}
                onChange={e => up('qty_on_hand', e.target.value)} className="inp" placeholder="0" />
            </Field>
            <Field label="Qty Reserved">
              <input type="number" min={0} value={form.qty_reserved}
                onChange={e => up('qty_reserved', e.target.value)} className="inp" placeholder="0" />
            </Field>
          </div>

          {/* Avg Daily Usage */}
          <Field label="Avg Daily Usage (opsional — untuk hitung Days of Supply)">
            <input type="number" min={0} step={0.1} value={form.avg_daily_usage as any}
              onChange={e => up('avg_daily_usage', e.target.value)} className="inp" placeholder="Kosongkan jika belum diketahui" />
          </Field>

          {/* Preview kalkulasi */}
          <div className="rounded-lg bg-gray-50 border p-3 grid grid-cols-3 gap-3">
            <div>
              <div className="text-xs text-gray-500">Qty Available</div>
              <div className={`text-lg font-bold ${qtyAvail < 0 ? 'text-red-600' : 'text-gray-800'}`}>
                {qtyAvail.toLocaleString('id-ID')}
              </div>
              <div className="text-xs text-gray-400">On Hand − Reserved</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Days of Supply</div>
              <div className={`text-lg font-bold ${dos && Number(dos) < 3 ? 'text-red-600' : dos && Number(dos) < 7 ? 'text-orange-600' : 'text-gray-800'}`}>
                {dos ? `${dos}h` : '—'}
              </div>
              <div className="text-xs text-gray-400">Available ÷ Avg/Hari</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Alert Status</div>
              <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium mt-1 ${status.color}`}>
                {status.label}
              </span>
              {safetyStock != null && qtyAvail < safetyStock && (
                <div className="text-xs text-red-500 mt-1">Di bawah safety stock</div>
              )}
            </div>
          </div>

          <Field label="Catatan (opsional)">
            <textarea value={form.notes as string}
              onChange={e => up('notes', e.target.value)} className="inp" rows={2} placeholder="Kondisi stok, keterangan tambahan" />
          </Field>

          {err && <p className="text-red-600 text-sm bg-red-50 rounded p-2">{err}</p>}
        </div>

        {/* Footer */}
        <div className="flex justify-between border-t p-4 bg-gray-50 shrink-0">
          <div>
            {row && (
              <button onClick={del} disabled={deleting}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-50">
                <Trash2 className="h-3.5 w-3.5" />
                {deleting ? 'Menghapus…' : 'Hapus'}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 border rounded-lg text-sm">Batal</button>
            <button onClick={save} disabled={saving || optLoading}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-500 disabled:opacity-50">
              {saving ? 'Menyimpan…' : 'Simpan Snapshot'}
            </button>
          </div>
        </div>

        <style>{`.inp{width:100%;padding:.5rem .75rem;border:1px solid #e5e7eb;border-radius:.5rem;font-size:.875rem}.inp:focus{outline:none;border-color:#6366f1}.inp:disabled{background:#f9fafb;color:#9ca3af}`}</style>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-gray-700 mb-1 block">{label}</span>
      {children}
    </label>
  )
}
