'use client'

import { useState, useTransition } from 'react'
import { FileSpreadsheet } from 'lucide-react'
import {
  DialogShell, DialogHeader, DialogCancelButton, dialogBodyClass, dialogCancelClass, dialogFooterClass, dialogPrimaryClass, formControlClass,
} from '@/components/ui/FormDialog'
import { notify } from '@/lib/feedback'
import { saveExternalVendorCosts, type ShipmentCostRow } from '@/app/(app)/shipment-cost/actions'
import { isCrossdocking } from '@/app/(app)/shipment-cost/utils'

const docNo = (r: ShipmentCostRow) => r.pss_no ?? (r.crossdocking_id ? `CD-${r.crossdocking_id}` : String(r.id))
const parseRupiah = (value: string) => Number(value.replace(/\D/g, '')) || 0
const fmtRupiah = (value: string) => {
  const n = parseRupiah(value)
  return n ? n.toLocaleString('id-ID') : ''
}

/**
 * Sebelum Export Excel: isi biaya shipment vendor eksternal yang masih kosong.
 * Baris yang dibiarkan kosong tetap ikut di Excel dengan biaya 0.
 */
export default function ExternalCostDialog({
  rows, onClose, onExport,
}: {
  rows: ShipmentCostRow[]
  onClose: () => void
  /** Dipanggil setelah simpan (atau lewati) untuk mengunduh Excel. */
  onExport: (saved: boolean) => void
}) {
  const [amounts, setAmounts] = useState<Record<number, string>>({})
  const [invoices, setInvoices] = useState<Record<number, string>>({})
  const [saving, startSaving] = useTransition()
  const filled = rows.filter((r) => parseRupiah(amounts[r.id] ?? '') > 0)
  const total = filled.reduce((s, r) => s + parseRupiah(amounts[r.id] ?? ''), 0)

  function saveAndExport() {
    startSaving(async () => {
      try {
        await saveExternalVendorCosts(filled.map((r) => ({
          id: r.id,
          cost_model: r.cost_model === 'Retail' ? 'Retail' : 'Trucking',
          amount: parseRupiah(amounts[r.id] ?? ''),
          invoice_no: invoices[r.id] ?? null,
        })))
        notify.success('Biaya vendor disimpan', `${filled.length} shipment diperbarui.`)
        onExport(true)
      } catch (error: any) {
        notify.error('Gagal menyimpan biaya', error.message)
      }
    })
  }

  return (
    <DialogShell onClose={onClose} size="6xl">
      <DialogHeader
        icon={FileSpreadsheet}
        title="Lengkapi biaya vendor eksternal"
        subtitle={`${rows.length} shipment vendor eksternal belum punya biaya. Isi sebelum Export Excel, atau lewati.`}
      />
      <div className={dialogBodyClass}>
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">PSS / CD</th>
                <th className="px-3 py-2">Trip</th>
                <th className="px-3 py-2">Customer</th>
                <th className="px-3 py-2">Kota</th>
                <th className="px-3 py-2">Vendor</th>
                <th className="px-3 py-2">Model</th>
                <th className="px-3 py-2 w-40">Biaya (Rp)</th>
                <th className="px-3 py-2 w-44">No. Invoice</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.id} className="align-middle">
                  <td className="px-3 py-2 font-mono text-xs font-semibold text-slate-800">
                    {docNo(r)}
                    {isCrossdocking(r) && <span className="ml-1.5 rounded bg-sky-50 px-1.5 py-0.5 font-sans text-[10px] font-semibold text-sky-700">CD</span>}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-600">{r.trip_id ?? '-'}</td>
                  <td className="px-3 py-2 text-slate-800">{r.customer_name ?? '-'}</td>
                  <td className="px-3 py-2 text-slate-600">{r.destination_city ?? '-'}</td>
                  <td className="px-3 py-2 text-slate-600">{r.transporter_name ?? '-'}</td>
                  <td className="px-3 py-2 text-xs text-slate-600">{r.cost_model === 'Retail' ? 'Retail' : 'Trucking'}</td>
                  <td className="px-3 py-2">
                    <input
                      inputMode="numeric"
                      value={amounts[r.id] ?? ''}
                      onChange={(e) => setAmounts((s) => ({ ...s, [r.id]: fmtRupiah(e.target.value) }))}
                      placeholder="0"
                      aria-label={`Biaya ${docNo(r)}`}
                      className={`${formControlClass} text-right tabular-nums`}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      value={invoices[r.id] ?? r.invoice_no_eksternal ?? ''}
                      onChange={(e) => setInvoices((s) => ({ ...s, [r.id]: e.target.value }))}
                      placeholder="Opsional"
                      maxLength={60}
                      aria-label={`No. invoice ${docNo(r)}`}
                      className={formControlClass}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-500">
          Biaya Trucking disimpan sebagai biaya trucking, Retail sebagai total biaya eksternal. Untuk trip multi-drop cukup isi di satu PSS.
        </p>
      </div>
      <div className={dialogFooterClass}>
        <p className="text-sm text-slate-600">
          {filled.length ? <>{filled.length} diisi · <span className="font-semibold tabular-nums">Rp {total.toLocaleString('id-ID')}</span></> : 'Belum ada biaya diisi'}
        </p>
        <div className="flex flex-wrap gap-2">
          <DialogCancelButton onClose={onClose} />
          <button type="button" onClick={() => onExport(false)} disabled={saving} className={dialogCancelClass}>
            Lewati &amp; Export
          </button>
          <button type="button" onClick={saveAndExport} disabled={saving || !filled.length} className={dialogPrimaryClass}>
            {saving ? 'Menyimpan…' : 'Simpan & Export'}
          </button>
        </div>
      </div>
    </DialogShell>
  )
}
