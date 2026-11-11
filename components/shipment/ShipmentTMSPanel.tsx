'use client'

import { DialogShell, DialogHeader, dialogBodyClass, dialogFooterClass, dialogCancelClass, dialogPrimaryClass, dialogDangerClass, FormField as Field } from '@/components/ui/FormDialog'
import { Truck } from 'lucide-react'
import { useState, useTransition, useEffect } from 'react'
import {
  upsertShipmentTracking, deleteShipmentTracking, markShipmentFailed, undoShipmentFailed,
  updateShipmentRetailCost,
  getShipmentTMSOptions, lookupCustomerDkLk,
  getVendorVehicleTypes, logVehicleTypeChange,
  type ShipmentTrackingRow,
  type TransporterOption, type VehicleOption,
  type DriverOption, type RouteOption,
} from '@/app/(app)/shipment/actions'
import SearchableSelect from '@/components/ui/SearchableSelect'
import { confirmAction, showSuccess } from '@/lib/feedback'

const STATUS_OPTS: readonly string[] = ['Draft', 'Dispatched', 'In Transit', 'Delivered']
const FAILURE_REASONS = ['Customer tutup', 'Salah barang', 'Alamat tidak ditemukan', 'Ditolak penerima', 'Lainnya']

// Kendaraan dan driver vendor tidak ada di master, jadi disimpan di catatan shipment.
function readNoteField(notes: string | null | undefined, key: string) {
  return notes?.match(new RegExp(`${key}:\\s*([^|]+)`, 'i'))?.[1]?.trim() ?? ''
}

function writeNoteField(notes: string | null | undefined, key: string, value: string) {
  const parts = (notes ?? '').split('|').map(part => part.trim()).filter(Boolean)
  const index = parts.findIndex(part => new RegExp(`^${key}:`, 'i').test(part))
  const next = value.trim() ? `${key}: ${value.trim()}` : null
  if (index >= 0) {
    if (next) parts[index] = next
    else parts.splice(index, 1)
  } else if (next) {
    parts.push(next)
  }
  return parts.join(' | ') || null
}

type Props = {
  shipment: ShipmentTrackingRow | null
  relatedShipments?: ShipmentTrackingRow[]
  prefillPss?: import('@/app/(app)/shipment/actions').UntrackedPssRow | null
  onClose: () => void
  onSaved: () => void
}

export default function ShipmentTMSPanel({ shipment, relatedShipments, prefillPss, onClose, onSaved }: Props) {
  const [transporters, setTransporters] = useState<TransporterOption[]>([])
  const [vehicles,     setVehicles]     = useState<VehicleOption[]>([])
  const [allCrew,      setAllCrew]      = useState<DriverOption[]>([])
  const [routes,       setRoutes]       = useState<RouteOption[]>([])
  const [pssOptions,   setPssOptions]   = useState<any[]>([])
  const [optLoading,   setOptLoading]   = useState(true)

  const [form, setForm] = useState<Partial<ShipmentTrackingRow>>(() => {
    if (shipment) return shipment
    // Pre-fill dari PSS untracked
    if (prefillPss) return {
      source_type:            'PSS',
      status:                 'Draft',
      cost_model:             null,
      pss_no:                 prefillPss.pss_no,
      outbound_header_id:     prefillPss.id,
      customer_name:          prefillPss.customer_name ?? undefined,
      destination_city:       prefillPss.destination_city ?? undefined,
      promised_delivery_date: prefillPss.promised_delivery_date ?? undefined,
      document_date:          prefillPss.document_date ?? undefined,
    }
    return { source_type: 'PSS', status: 'Draft', cost_model: null }
  })

  useEffect(() => {
    if (shipment) {
      setForm(shipment)
      return
    }

    if (prefillPss) {
      setForm({
        source_type: 'PSS',
        status: 'Draft',
        cost_model: null,
        pss_no: prefillPss.pss_no,
        outbound_header_id: prefillPss.id,
        customer_name: prefillPss.customer_name ?? undefined,
        destination_city: prefillPss.destination_city ?? undefined,
        promised_delivery_date: prefillPss.promised_delivery_date ?? undefined,
        document_date: prefillPss.document_date ?? undefined,
      })
      return
    }

    setForm({ source_type: 'PSS', status: 'Draft', cost_model: null })
  }, [shipment, prefillPss])

  const [saving,   startSaving]   = useTransition()
  const [deleting, startDeleting] = useTransition()
  const [err, setErr] = useState<string | null>(null)
  const [applyTo, setApplyTo] = useState<'trip' | 'single'>('trip')
  const [externalNopol, setExternalNopol] = useState(() => readNoteField(shipment?.notes, 'Nopol'))
  const [externalDriver, setExternalDriver] = useState(() => readNoteField(shipment?.notes, 'Driver'))
  const originalType = readNoteField(shipment?.notes, 'Tipe').toUpperCase()
  const [externalType, setExternalType] = useState(originalType)
  const [vendorTypes, setVendorTypes] = useState<string[]>([])
  const tripRows = relatedShipments?.length ? relatedShipments : shipment ? [shipment] : []

  const up = (k: keyof ShipmentTrackingRow, v: any) =>
    setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    getShipmentTMSOptions().then(opts => {
      setTransporters(opts.transporters)
      setVehicles(opts.vehicles)
      setAllCrew(opts.drivers)
      setRoutes(opts.routes)
      setPssOptions(opts.pssOptions)
      setOptLoading(false)
    }).catch(() => setOptLoading(false))
  }, [])

  useEffect(() => {
    if (!shipment || form.transporter_id || form.cost_model !== 'Internal' || !transporters.length) return
    const internalSru = transporters.find(t => t.type === 'Internal' && /sru\s*[-—]?\s*medan/i.test(t.name))
    if (internalSru) up('transporter_id', internalSru.id)
  }, [shipment, form.transporter_id, form.cost_model, transporters])

  // Auto-lookup DK/LK dari customer jika masih kosong (untuk record lama)
  useEffect(() => {
    if (form.dk_lk) return  // sudah ada, tidak perlu lookup
    const name = form.customer_name
    if (!name) return
    lookupCustomerDkLk(name as string).then(dk => {
      if (dk) up('dk_lk', dk)
    }).catch(() => {})
  }, [form.customer_name])

  // Filter drivers & helpers by role
  const drivers = allCrew.filter(d => d.role === 'Driver' || !d.role)
  const helpers = allCrew.filter(d => d.role === 'Helper')

  // Auto-set cost_model & fleet_type saat transporter berubah
  useEffect(() => {
    if (!form.transporter_id) return
    const t = transporters.find(t => t.id === form.transporter_id)
    if (t) {
      up('cost_model', t.type === 'Internal' ? 'Internal' : (t.service_model as any ?? null))
      up('fleet_type', t.type === 'Internal' ? 'Internal' : 'Eksternal')
    }
  }, [form.transporter_id, transporters])

  // Saat PSS dipilih, auto-fill fields dari outbound_header + dk_lk dari customers
  function onPssChange(pssNo: string) {
    const pss = pssOptions.find((p: any) => p.pss_no === pssNo)
    if (pss) {
      setForm(f => ({
        ...f,
        pss_no:                 pssNo,
        outbound_header_id:     pss.id,
        customer_name:          pss.customer_name,
        destination_city:       pss.destination_city ?? pss.ship_to_city,
        promised_delivery_date: pss.promised_delivery_date,
        document_date:          pss.document_date,
        dk_lk:                  pss.dk_lk ?? f.dk_lk,  // dari customer lookup
      }))
    } else {
      up('pss_no', pssNo)
    }
  }

  const noteTransporterName = form.notes?.match(/Vendor:\s*([^|]+)/i)?.[1]?.trim() ?? ''
  const noteTransporter = transporters.filter(t => {
    const optionName = t.name.trim().toLowerCase()
    const noteName = noteTransporterName.toLowerCase()
    return noteName && (optionName === noteName || optionName.includes(noteName) || noteName.includes(optionName))
  }).sort((first, second) => {
    const firstRetail = form.cost_model === 'Retail' && first.service_model === 'Retail' ? 1 : 0
    const secondRetail = form.cost_model === 'Retail' && second.service_model === 'Retail' ? 1 : 0
    return secondRetail - firstRetail
  })[0]
  const effectiveTransporterId = form.transporter_id ?? noteTransporter?.id ?? ''
  const selectedTransporter = transporters.find(t => t.id === Number(effectiveTransporterId))
  const isInternal = selectedTransporter?.type === 'Internal'
  const transporterName = selectedTransporter?.name
    ?? form.transporter_name
    ?? form.notes?.match(/Vendor:\s*([^|]+)/i)?.[1]?.trim()
    ?? ''
  const isRetailCourier = /indah\s+logistik|jne/i.test(transporterName) || Boolean(String(form.no_resi ?? '').trim())
  const hadExternalCrew = Boolean(readNoteField(shipment?.notes, 'Nopol') || readNoteField(shipment?.notes, 'Driver'))
  // Shipment yang sudah memakai armada/driver dari master diedit lewat master,
  // walaupun transporternya terdaftar Eksternal (mis. SRU MEDAN).
  const usesMasterFleet = isInternal || form.vehicle_id != null || form.driver_id != null
  const showExternalCrew = Boolean(shipment) && !usesMasterFleet && (hadExternalCrew || !isRetailCourier)

  // Jenis unit menentukan tarif charter vendor di Shipment Cost.
  useEffect(() => {
    if (!effectiveTransporterId || isInternal) { setVendorTypes([]); return }
    getVendorVehicleTypes(Number(effectiveTransporterId)).then(setVendorTypes).catch(() => setVendorTypes([]))
  }, [effectiveTransporterId, isInternal])
  const typeOptions = [...new Set([...vendorTypes, ...(externalType ? [externalType] : [])])]

  function notesFor(row: ShipmentTrackingRow | null) {
    const base = row == null || row.id === shipment?.id ? form.notes : row.notes
    if (showExternalCrew) {
      const crew = writeNoteField(writeNoteField(base, 'Nopol', externalNopol), 'Driver', externalDriver)
      return externalType ? writeNoteField(crew, 'Tipe', externalType) : crew
    }
    // Catatan lama yang menyimpan Nopol/Driver ikut disesuaikan dengan pilihan master.
    if (usesMasterFleet && (readNoteField(base, 'Nopol') || readNoteField(base, 'Driver'))) {
      const vehicle = vehicles.find(v => v.id === Number(form.vehicle_id))
      const driver = allCrew.find(d => d.id === Number(form.driver_id))
      let next = base ?? null
      if (vehicle) next = writeNoteField(writeNoteField(next, 'Nopol', vehicle.vehicle_no), 'Tipe', vehicle.vehicle_type ?? '')
      if (driver) next = writeNoteField(next, 'Driver', driver.driver_name)
      return next
    }
    return base ?? null
  }

  useEffect(() => {
    if (form.transporter_id || !noteTransporter) return
    up('transporter_id', noteTransporter.id)
  }, [form.transporter_id, noteTransporter?.id])

  async function del() {
    if (!shipment) return
    if (!(await confirmAction({ title: 'Hapus shipment?', message: `Shipment ${shipment.pss_no ?? 'ini'} beserta data POD-nya akan dihapus.` }))) return
    startDeleting(async () => {
      try { await deleteShipmentTracking(shipment.id); onClose(); void showSuccess({ title: 'Shipment dihapus' }).then(onSaved) }
      catch (e: any) { setErr(e.message) }
    })
  }

  function save() {
    startSaving(async () => {
      setErr(null)
      if (!form.status) { setErr('Status wajib diisi'); return }
      if (showExternalCrew && hadExternalCrew && !externalNopol.trim()) { setErr('Nomor polisi wajib diisi'); return }
      if (showExternalCrew && hadExternalCrew && !externalDriver.trim()) { setErr('Nama driver wajib diisi'); return }
      try {
        const selectedVendor = transporters.find(t => t.id === Number(effectiveTransporterId))
        const retailFields = Boolean(String(form.no_resi ?? '').trim()) || form.cost_model === 'Retail' || isRetailCourier
        const sharedFields = {
          transporter_id: effectiveTransporterId ? Number(effectiveTransporterId) : null,
          transporter_name: selectedVendor?.name ?? form.transporter_name,
          vehicle_id: form.vehicle_id ?? null,
          driver_id: form.driver_id ?? null,
          helper_id: form.helper_id ?? null,
          route_id: form.route_id ?? null,
          trip_id: form.trip_id ?? null,
          cost_model: retailFields ? 'Retail' : (form.cost_model ?? null),
          fleet_type: form.fleet_type ?? (isInternal ? 'Internal' : 'Eksternal'),
          status: retailFields || form.trip_id ? 'In Transit' : form.status,
          dispatch_time: form.dispatch_time ?? null,
          created_at: form.created_at ?? null,
          no_resi: form.no_resi?.trim() || null,
          total_biaya_eksternal: form.total_biaya_eksternal == null
            ? null
            : Number(form.total_biaya_eksternal),
        }
        const rowsToUpdate = !shipment ? [null] : applyTo === 'single' ? [shipment] : tripRows
        await Promise.all(rowsToUpdate.map(row => upsertShipmentTracking({
          ...(row ?? form),
          ...sharedFields,
          notes: notesFor(row),
          // Satu trip bisa berisi PSS yang sudah Delivered; jangan ikut dimundurkan.
          status: (row ?? form).status === 'Delivered' ? 'Delivered' : sharedFields.status,
          id: row?.id,
        })))
        if (showExternalCrew && externalType && externalType !== originalType) {
          await logVehicleTypeChange({
            shipmentIds: rowsToUpdate.filter((row): row is ShipmentTrackingRow => row?.id != null).map(row => row.id),
            tripId: form.trip_id ?? null,
            from: originalType || null,
            to: externalType,
          }).catch(() => {})
        }
        if (retailFields) {
          await Promise.all(rowsToUpdate
            .filter((row): row is ShipmentTrackingRow => row != null && row.id != null)
            .map(row => updateShipmentRetailCost({
              id: row.id,
              no_resi: form.no_resi?.trim() || null,
              total_biaya_eksternal: form.total_biaya_eksternal == null
                ? null
                : Number(form.total_biaya_eksternal),
            })))
        }
        onClose()
        void showSuccess({
          title: 'Shipment tersimpan',
          message: shipment && tripRows.length > 1
            ? (applyTo === 'single' ? `Hanya ${shipment.pss_no ?? 'dokumen ini'} yang diubah` : `${tripRows.length} dokumen dalam ${shipment.trip_id} diubah`)
            : undefined,
        }).then(onSaved)
      } catch (e: any) { setErr(e.message) }
    })
  }

  return (
    <DialogShell onClose={onClose} size="3xl">
      <DialogHeader title={shipment ? 'Edit Shipment TMS' : 'Tambah Shipment TMS'} subtitle={shipment?.pss_no ?? 'Jadwalkan pengiriman baru'} icon={Truck} />

        <div className={dialogBodyClass}>
          {optLoading && <p className="text-sm text-gray-400 text-center py-4">Memuat opsi...</p>}

          {/* ── Source — read-only saat edit ── */}
          <Section title="Sumber Shipment">
            {shipment ? (
              // EDIT MODE: tampilkan info, tidak bisa diubah
              <div>
                <InfoField label={relatedShipments && relatedShipments.length > 1 ? `PSS / CD No. (${relatedShipments.length} dalam 1 Trip)` : 'PSS / CD No.'}>
                  <div className="space-y-1">
                    {(relatedShipments?.length ? relatedShipments : [shipment]).map(row => (
                      <AttemptRow key={row.id} row={row} onChanged={onSaved} />
                    ))}
                  </div>
                </InfoField>
              </div>
            ) : (
              // ADD MODE: bisa pilih PSS
              <div className="grid grid-cols-2 gap-3">
                <Field label="Tipe Sumber">
                  <select value={form.source_type ?? 'PSS'} onChange={e => up('source_type', e.target.value)} className="inp">
                    <option value="PSS">PSS (dari NAV)</option>
                    <option value="Crossdocking">Crossdocking (manual)</option>
                  </select>
                </Field>
                {form.source_type === 'PSS' ? (
                  <Field label="PSS No.">
                    <SearchableSelect value={form.pss_no ?? ''} onChange={onPssChange} placeholder="-- Pilih PSS --" options={pssOptions.map((p: any) => ({ value: p.pss_no, label: `${p.pss_no} — ${p.customer_name}` }))} />
                  </Field>
                ) : (
                  <Field label="Crossdocking ID">
                    <input type="number" value={form.crossdocking_id ?? ''} onChange={e => up('crossdocking_id', e.target.value ? Number(e.target.value) : null)} className="inp" />
                  </Field>
                )}
              </div>
            )}
          </Section>

          {/* ── Customer & Tujuan ── */}
          <Section title="Customer & Tujuan">
            <div className="grid grid-cols-2 gap-3">
              {shipment ? (
                <>
                  <InfoField label="Customer">
                    <span className="font-medium">{shipment.customer_name ?? '-'}</span>
                  </InfoField>
                  <InfoField label="Kota Tujuan">
                    <span>{shipment.destination_city ?? '-'}</span>
                  </InfoField>
                </>
              ) : (
                <>
                  <Field label="Customer Name">
                    <input value={form.customer_name ?? ''} onChange={e => up('customer_name', e.target.value)} className="inp" />
                  </Field>
                  <Field label="Kota Tujuan">
                    <input value={form.destination_city ?? ''} onChange={e => up('destination_city', e.target.value)} className="inp" />
                  </Field>
                </>
              )}
            </div>
            <div className="mt-2 grid grid-cols-3 gap-3">
              <InfoField label="Document Date">
                <span className="text-sm">{form.document_date?.slice(0,10) ?? '-'}</span>
              </InfoField>
              <InfoField label="Promised Delivery">
                <span className="text-sm">{form.promised_delivery_date?.slice(0,10) ?? '-'}</span>
              </InfoField>
              <InfoField label="DK / LK">
                {/* Auto dari customer — read-only */}
                <span className={`text-xs font-bold rounded px-2 py-0.5 ${
                  form.dk_lk === 'DK' ? 'bg-blue-100 text-blue-700' :
                  form.dk_lk === 'LK' ? 'bg-amber-100 text-amber-700' :
                  'bg-gray-100 text-gray-500'
                }`}>
                  {form.dk_lk ?? '— belum diset di master customer —'}
                </span>
              </InfoField>
            </div>
          </Section>

          <Section title={isInternal ? 'Transporter & Armada' : 'Transporter & Rute'}>
            {tripRows.length > 1 && (
              <fieldset className="mb-3">
                <legend className="mb-1.5 block text-[13px] font-medium text-slate-700">Terapkan perubahan ke</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {[
                    { value: 'trip' as const, label: `Seluruh trip (${tripRows.length} dokumen)` },
                    { value: 'single' as const, label: `Hanya ${shipment?.pss_no ?? 'dokumen ini'}` },
                  ].map(option => (
                    <label key={option.value} className="cursor-pointer">
                      <input type="radio" name="apply_to" checked={applyTo === option.value} onChange={() => setApplyTo(option.value)} className="peer sr-only" />
                      <span className="flex min-h-11 items-center justify-center rounded-xl border border-gray-300 px-3 text-center text-sm font-medium text-slate-600 transition-colors hover:border-gold-400 peer-checked:border-indigo-600 peer-checked:bg-indigo-50 peer-checked:text-indigo-800 peer-focus-visible:ring-2 peer-focus-visible:ring-gold-400">
                        {option.label}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Model / Transporter">
                <SearchableSelect value={effectiveTransporterId} onChange={value => up('transporter_id', value ? Number(value) : null)} placeholder={isInternal ? 'Internal' : '-- Pilih transporter --'} options={transporters.map(t => ({ value: t.id, label: t.name }))} disabled={optLoading} />
              </Field>
              <Field label="Rute">
                <SearchableSelect value={form.route_id ?? ''} onChange={value => up('route_id', value ? Number(value) : null)} placeholder="-- Opsional --" options={routes.map(r => ({ value: r.id, label: `${r.route_code} — ${r.origin} → ${r.destination}` }))} />
              </Field>
            </div>
            {usesMasterFleet && (
              <div className="mt-3 grid grid-cols-3 gap-3">
                <Field label="Armada">
                  <SearchableSelect value={form.vehicle_id ?? ''} onChange={value => up('vehicle_id', value ? Number(value) : null)} placeholder="-- Pilih --" options={vehicles.map(v => ({ value: v.id, label: `${v.vehicle_no}${v.vehicle_type ? ` (${v.vehicle_type})` : ''}` }))} />
                </Field>
                <Field label="Driver">
                  <SearchableSelect value={form.driver_id ?? ''} onChange={value => up('driver_id', value ? Number(value) : null)} placeholder="-- Pilih Driver --" options={drivers.map(d => ({ value: d.id, label: d.driver_name }))} />
                </Field>
                <Field label="Helper">
                  <SearchableSelect value={form.helper_id ?? ''} onChange={value => up('helper_id', value ? Number(value) : null)} placeholder="-- Pilih Helper --" options={helpers.map(d => ({ value: d.id, label: d.driver_name }))} />
                </Field>
              </div>
            )}
            {showExternalCrew && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Field label="Jenis unit">
                  <select value={externalType} onChange={e => setExternalType(e.target.value)} className="inp">
                    <option value="">-- Pilih jenis unit --</option>
                    {typeOptions.map(type => <option key={type} value={type}>{type}</option>)}
                  </select>
                  {externalType && externalType !== originalType && originalType && (
                    <p className="mt-1 text-xs text-amber-700">
                      Diubah dari {originalType}. Biaya trucking di Shipment Cost akan mengikuti tarif {externalType}.
                    </p>
                  )}
                  {!vendorTypes.length && Boolean(effectiveTransporterId) && (
                    <p className="mt-1 text-xs text-slate-500">Vendor ini belum punya tarif di Rate Card.</p>
                  )}
                </Field>
                <div />
                <Field label="No. polisi kendaraan">
                  <input value={externalNopol} onChange={e => setExternalNopol(e.target.value.toLocaleUpperCase('id-ID'))} className="inp font-mono" placeholder="BK 1234 AB" />
                </Field>
                <Field label="Nama driver">
                  <input value={externalDriver} onChange={e => setExternalDriver(e.target.value.toLocaleUpperCase('id-ID'))} className="inp" placeholder="Nama lengkap driver" />
                </Field>
              </div>
            )}
            <div className="mt-3">
              <Field label="Trip ID">
                <div className="inp bg-gray-50 text-gray-600 font-mono">{form.trip_id ?? '-'}</div>
              </Field>
            </div>
          </Section>

          {/* ── Status & Timeline ── */}
          <Section title="Status & Timeline">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Status *">
                <select value={form.status ?? 'Draft'} onChange={e => up('status', e.target.value)} className="inp">
                  {form.status && !STATUS_OPTS.includes(form.status) && <option value={form.status}>{form.status}</option>}
                  {STATUS_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
            </div>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Tanggal Create Shipment">
                <DateTimeInput value={form.created_at ?? null} onChange={value => up('created_at', value)} />
              </Field>
              <Field label="Waktu Keberangkatan (Dispatch)">
                <DateTimeInput value={form.dispatch_time ?? null} onChange={value => up('dispatch_time', value)} />
              </Field>
            </div>
            {(isRetailCourier || form.cost_model === 'Retail') && (
              <div className="mt-2 grid grid-cols-2 gap-3">
                <Field label="Nomor Resi Retail / Courier">
                  <input
                    value={form.no_resi ?? ''}
                    onChange={e => up('no_resi', e.target.value || null)}
                    className="inp font-mono"
                    placeholder="Masukkan nomor resi setelah serah-terima"
                  />
                </Field>
                <Field label="Biaya Kirim per Resi (Rp)">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={form.total_biaya_eksternal == null ? '' : String(form.total_biaya_eksternal)}
                    onChange={e => {
                      const raw = e.target.value.replace(/[^0-9]/g, '')
                      up('total_biaya_eksternal', raw === '' ? null : Number(raw))
                    }}
                    className="inp"
                    placeholder="0"
                  />
                </Field>
              </div>
            )}
          </Section>

          <Field label="Catatan">
            <textarea value={form.notes ?? ''} onChange={e => up('notes', e.target.value || null)} className="inp" rows={2} />
          </Field>

          {err && <p className="text-red-600 text-sm bg-red-50 rounded p-2">{err}</p>}
        </div>

        {/* Footer */}
        <div className={dialogFooterClass}>
          <div>
            {shipment && (
              <button onClick={del} disabled={deleting}
                className={dialogDangerClass}>
                {deleting ? 'Menghapus…' : 'Hapus'}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className={dialogCancelClass}>Batal</button>
            <button onClick={save} disabled={saving}
              className={dialogPrimaryClass}>
              {saving ? 'Menyimpan…' : 'Simpan'}
            </button>
          </div>
        </div>

    </DialogShell>
  )
}

function AttemptRow({ row, onChanged }: { row: ShipmentTrackingRow; onChanged: () => void }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState(FAILURE_REASONS[0])
  const [note, setNote] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, startBusy] = useTransition()
  const label = row.pss_no ?? (row.crossdocking_id ? `CD-${row.crossdocking_id}` : '-')
  const canFail = row.status === 'Dispatched' || row.status === 'In Transit'
  const failed = row.status === 'Failed Delivery'

  function run(action: () => Promise<void>, message: string) {
    startBusy(async () => {
      setErr(null)
      try { await action(); await showSuccess({ title: message }); onChanged() }
      catch (e: any) { setErr(e.message) }
    })
  }

  async function undo() {
    if (!(await confirmAction({ title: 'Batalkan gagal kirim?', message: `${label} akan kembali berstatus In Transit.` }))) return
    run(() => undoShipmentFailed(row.id), 'Gagal kirim dibatalkan')
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-bold text-indigo-700">{label}</span>
        {failed && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">Gagal kirim{row.failure_reason ? `: ${row.failure_reason}` : ''}</span>}
        {canFail && !open && <button type="button" onClick={() => setOpen(true)} className="text-xs font-semibold text-red-600 hover:underline">Gagal kirim</button>}
        {failed && <button type="button" onClick={undo} disabled={busy} className="text-xs font-semibold text-slate-500 hover:underline disabled:opacity-50">Batalkan</button>}
      </div>
      {open && (
        <div className="mt-1.5 grid gap-2 rounded-lg border border-red-200 bg-red-50 p-2.5 sm:grid-cols-[12rem_1fr_auto_auto]">
          <select value={reason} onChange={e => setReason(e.target.value)} aria-label={`Alasan gagal kirim ${label}`} className="inp">
            {FAILURE_REASONS.map(item => <option key={item} value={item}>{item}</option>)}
          </select>
          <input value={note} onChange={e => setNote(e.target.value)} placeholder="Catatan (opsional)" aria-label="Catatan gagal kirim" className="inp" />
          <button type="button" disabled={busy} onClick={() => run(() => markShipmentFailed({ id: row.id, failure_reason: reason, notes: note }), `${label} ditandai gagal kirim`)} className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50">
            {busy ? 'Menyimpan…' : 'Simpan'}
          </button>
          <button type="button" disabled={busy} onClick={() => setOpen(false)} className="rounded-lg border bg-white px-3 py-2 text-xs">Batal</button>
        </div>
      )}
      {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-gold-700">{title}</div>
      {children}
    </section>
  )
}

function InfoField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="block">
      <span className="mb-0.5 block text-sm font-semibold text-slate-500">{label}</span>
      <div className="py-0.5 text-sm font-medium text-slate-800">{children}</div>
    </div>
  )
}

function DateTimeInput({ value, onChange }: { value: string | null; onChange: (value: string | null) => void }) {
  const [time, setTime] = useState(value ? new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(value)) : '00:00')
  const date = value ? new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(value)) : ''

  useEffect(() => {
    setTime(value ? new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(new Date(value)) : '00:00')
  }, [value])

  function save(dateValue: string, timeValue: string) {
    if (!dateValue && !timeValue) {
      onChange(null)
      return
    }
    if (!dateValue) return
    const validTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(timeValue) ? timeValue : '00:00'
    onChange(new Date(`${dateValue}T${validTime}:00+07:00`).toISOString())
  }

  return (
    <div className="grid grid-cols-[1fr_6.5rem] gap-1.5">
      <input
        type="date"
        value={date}
        onChange={event => save(event.target.value, time || '00:00')}
        className="inp"
      />
      <input
        type="time"
        value={time}
        onChange={event => {
          const nextTime = event.target.value
          setTime(nextTime)
          save(date, nextTime)
        }}
        className="inp text-center"
        aria-label="Jam (HH:MM)"
      />
    </div>
  )
}
