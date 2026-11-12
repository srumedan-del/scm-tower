'use client'

import { DialogShell, DialogHeader } from '@/components/ui/FormDialog'
import { showSuccess } from '@/lib/feedback'
import { useState, useEffect, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Package, Check, ChevronDown } from 'lucide-react'
import { getReceivingFullData, updateReceivingTransportDetails, updateShipmentDate, getReceivingVendorHistory } from '@/app/(app)/receiving/actions'

interface HeaderData {
  id: string | number
  ptr_no: string
  transfer_order_no: string | null
  transfer_from_code: string | null
  transfer_to_code: string | null
  posting_date: string | null
  shipment_date: string | null
  receipt_date: string | null
  shipping_agent_code: string | null
  branch_representative: string | null
  transport_mode: 'DARAT' | 'LAUT' | 'UDARA' | null
  land_vendor_code: string | null
  sea_vendor_code: string | null
  air_vendor_code: string | null
  container_no: string | null
  ship_to_receipt_days: number | null
  receipt_to_posting_days: number | null
  ship_to_posting_days: number | null
  source_file: string | null
  import_period: string | null
  created_at: string | null
  updated_at: string | null
}

interface DetailData {
  id: string | number
  document_no: string | null
  document_line_no: number | null
  item_no: string | null
  item_name: string | null
  uom: string | null
  description: string | null
  quantity: number | null
  lot_no: string | null
  expiration_date: string | null
  entry_no: number | null
}

interface Props {
  ptrNo: string
  onClose?: () => void
  trigger?: React.ReactNode
  isOpen?: boolean
}

function formatDate(val: string | null | undefined): string {
  if (!val || val === '9999-12-31') return '-'
  return String(val).slice(0, 10)
}

function calculateLeadTimeDays(postingDate?: string | null, shipmentDate?: string | null): number | null {
  if (!postingDate || !shipmentDate) return null
  const post = new Date(postingDate.slice(0, 10)).getTime()
  const ship = new Date(shipmentDate.slice(0, 10)).getTime()
  if (isNaN(post) || isNaN(ship)) return null
  const diffDays = Math.round((post - ship) / (1000 * 60 * 60 * 24))
  return diffDays >= 0 ? diffDays : null
}

export default function PtrDetailModal({ ptrNo, onClose, trigger, isOpen: controlledOpen }: Props) {
  const router = useRouter()
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen ?? internalOpen
  const [loading, setLoading] = useState(false)
  const [header, setHeader] = useState<HeaderData | null>(null)
  const [details, setDetails] = useState<DetailData[]>([])
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [savingTransport, startSavingTransport] = useTransition()
  const [savedSuccess, setSavedSuccess] = useState(false)

  const [transportForm, setTransportForm] = useState({
    transport_mode: 'LAUT' as 'DARAT' | 'LAUT' | 'UDARA',
    vendor_name: '',
    container_no: '',
    shipment_date: '',
  })
  const [vendorHistory, setVendorHistory] = useState<string[]>([])
  const [showVendorDropdown, setShowVendorDropdown] = useState(false)
  const vendorContainerRef = useRef<HTMLDivElement>(null)

  // Handle click outside dropdown nama vendor
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (vendorContainerRef.current && !vendorContainerRef.current.contains(event.target as Node)) {
        setShowVendorDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  useEffect(() => {
    if (!open) return

    let cancelled = false

    const fetchData = async () => {
      setLoading(true)
      setErrorMsg(null)
      setHeader(null)
      setDetails([])
      setSavedSuccess(false)
      setShowVendorDropdown(false)

      try {
        const { header: h, details: d, error } = await getReceivingFullData(ptrNo)
        if (cancelled) return

        if (error) {
          setErrorMsg((error as Error)?.message || 'Gagal memuat data.')
          return
        }

        const headerData = h as HeaderData
        setHeader(headerData)
        setDetails((d ?? []) as DetailData[])
        const vendorVal = (
          headerData?.sea_vendor_code ||
          headerData?.land_vendor_code ||
          headerData?.air_vendor_code ||
          headerData?.shipping_agent_code ||
          ''
        ).toUpperCase()
        setTransportForm({
          transport_mode: (headerData?.transport_mode || 'LAUT') as 'DARAT' | 'LAUT' | 'UDARA',
          vendor_name: vendorVal,
          container_no: (headerData?.container_no ?? '').toUpperCase(),
          shipment_date: headerData?.shipment_date ? String(headerData.shipment_date).slice(0, 10) : '',
        })

        // Ambil riwayat nama vendor
        getReceivingVendorHistory().then((history) => {
          if (!cancelled && history.length > 0) {
            setVendorHistory(history)
          }
        }).catch(() => {})
      } catch (err: any) {
        if (cancelled) return
        setErrorMsg(err?.message || 'Gagal memuat data.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchData()

    return () => {
      cancelled = true
    }
  }, [open, ptrNo])

  const handleClose = () => {
    setInternalOpen(false)
    onClose?.()
    setHeader(null)
    setDetails([])
    setErrorMsg(null)
    setSavedSuccess(false)
    setShowVendorDropdown(false)
  }

  const saveTransportDetails = () => {
    if (!header) return
    startSavingTransport(async () => {
      try {
        const v = transportForm.vendor_name.trim().toUpperCase() || null
        const c = transportForm.container_no.trim().toUpperCase() || null
        const sDate = transportForm.shipment_date || null

        if (sDate && sDate !== header.shipment_date?.slice(0, 10)) {
          await updateShipmentDate(header.id, sDate)
        }

        await updateReceivingTransportDetails(header.id, {
          transport_mode: transportForm.transport_mode,
          land_vendor_code: v,
          sea_vendor_code: v,
          air_vendor_code: v,
          container_no: c,
        })
        handleClose()
        void showSuccess({ title: 'Informasi transportasi tersimpan', message: ptrNo }).then(() => router.refresh())
      } catch (error: any) {
        setErrorMsg(error?.message || 'Gagal menyimpan informasi transportasi.')
      }
    })
  }

  const totalQuantity = details.reduce((sum, d) => sum + (Number(d.quantity) || 0), 0)

  // Rumus Lead Time: Selisih hari antara Posting Date dengan Shipment Date
  const leadTimeDays = calculateLeadTimeDays(header?.posting_date, transportForm.shipment_date || header?.shipment_date)

  // Filter history vendor berdasarkan apa yang diketik
  const filteredVendors = vendorHistory.filter((v) => {
    if (!transportForm.vendor_name.trim()) return true
    return v.toUpperCase().includes(transportForm.vendor_name.trim().toUpperCase())
  })

  return (
    <>
      {trigger ? (
        <button type="button" onClick={() => setInternalOpen(true)} className="pointer-events-auto">
          {trigger}
        </button>
      ) : null}

      {open && (
        <DialogShell onClose={handleClose} size="5xl">
          <DialogHeader
            title={ptrNo}
            icon={Package}
            subtitle={
              <>
                {header?.transfer_order_no && <>TO: {header.transfer_order_no} · </>}
                {header?.transfer_from_code && header?.transfer_to_code
                  ? <>Rute transfer {header.transfer_from_code} &rarr; {header.transfer_to_code}</>
                  : 'Rincian dokumen receiving dan detail item'}
              </>
            }
          />

            {/* ── Modal Body (Scrollable) ── */}
            <div className="min-h-0 flex-1 overflow-y-auto divide-y divide-slate-100">
              {loading && (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                  <span className="ml-3 text-[14px] font-medium text-slate-600">Memuat data receiving...</span>
                </div>
              )}

              {errorMsg && !loading && (
                <div className="p-6">
                  <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-[14px] font-medium text-red-700">
                    {errorMsg}
                  </div>
                </div>
              )}

              {!loading && !errorMsg && header && (
                <>
                  {/* ── 1. Ringkasan Tanggal & Lead Time ── */}
                  <div className="px-5 py-3 sm:px-6 bg-slate-50/70 border-b border-slate-100">
                    <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 rounded-xl border border-slate-200/80 bg-white py-2.5 px-3 shadow-xs">
                      <div className="flex items-center justify-between sm:justify-center gap-2 px-3 py-1 sm:py-0">
                        <span className="text-[14px] font-bold uppercase tracking-wider text-slate-500">
                          Posting Date:
                        </span>
                        <span className="text-[14px] font-bold text-slate-800">
                          {formatDate(header.posting_date)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between sm:justify-center gap-2 px-3 py-1 sm:py-0">
                        <span className="text-[14px] font-bold uppercase tracking-wider text-slate-500">
                          Shipment Date:
                        </span>
                        <input
                          type="date"
                          value={transportForm.shipment_date}
                          onChange={(e) =>
                            setTransportForm((current) => ({
                              ...current,
                              shipment_date: e.target.value,
                            }))
                          }
                          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[14px] font-bold font-mono text-slate-800 focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 shadow-xs cursor-pointer"
                        />
                      </div>
                      <div className="flex items-center justify-between sm:justify-center gap-2 px-3 py-1 sm:py-0">
                        <span className="text-[14px] font-bold uppercase tracking-wider text-slate-500">
                          Lead Time:
                        </span>
                        <span className="text-[14px] font-bold text-indigo-700">
                          {leadTimeDays !== null ? `${leadTimeDays} hari` : '-'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* ── 2. Form Informasi Pengiriman & Vendor ── */}
                  <div className="p-4 sm:p-5 bg-white">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                      <div>
                        <label className="block text-[14px] font-bold text-slate-700 mb-1">
                          Mode Pengiriman
                        </label>
                        <select
                          value={transportForm.transport_mode}
                          onChange={(e) =>
                            setTransportForm((current) => ({
                              ...current,
                              transport_mode: e.target.value as typeof current.transport_mode,
                            }))
                          }
                          className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-[14px] font-medium text-slate-800 focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 shadow-xs"
                        >
                          <option value="DARAT">Darat (Trucking / Land)</option>
                          <option value="LAUT">Laut (Sea Freight)</option>
                          <option value="UDARA">Udara (Air Cargo)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[14px] font-bold text-slate-700 mb-1">
                          No. Container / Airway Ref
                          <span className="text-[12px] text-slate-400 font-normal ml-1">(HURUF KAPITAL)</span>
                        </label>
                        <input
                          value={transportForm.container_no}
                          onChange={(e) =>
                            setTransportForm((current) => ({
                              ...current,
                              container_no: e.target.value.toUpperCase(),
                            }))
                          }
                          className="w-full uppercase rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-[14px] font-medium font-mono text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 shadow-xs"
                          placeholder="CONT-... / AWB-..."
                        />
                      </div>

                      {/* Dropdown Autocomplete untuk Nama Vendor */}
                      <div ref={vendorContainerRef} className="relative">
                        <label className="block text-[14px] font-bold text-slate-700 mb-1">
                          Nama Vendor
                          <span className="text-[12px] text-slate-400 font-normal ml-1">(HURUF KAPITAL)</span>
                        </label>
                        <div className="relative">
                          <input
                            value={transportForm.vendor_name}
                            onFocus={() => setShowVendorDropdown(true)}
                            onChange={(e) => {
                              setTransportForm((current) => ({
                                ...current,
                                vendor_name: e.target.value.toUpperCase(),
                              }))
                              setShowVendorDropdown(true)
                            }}
                            className="w-full uppercase rounded-xl border border-slate-300 bg-white px-3.5 py-2 pr-9 text-[14px] font-medium text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 shadow-xs"
                            placeholder="KETIK NAMA VENDOR..."
                          />
                          <button
                            type="button"
                            onClick={() => setShowVendorDropdown((prev) => !prev)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                            title="Tampilkan riwayat vendor"
                          >
                            <ChevronDown className="h-4 w-4" />
                          </button>
                        </div>

                        {/* Floating Autocomplete Dropdown List */}
                        {showVendorDropdown && filteredVendors.length > 0 && (
                          <div className="absolute z-50 left-0 right-0 top-full mt-1.5 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
                            <div className="px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 bg-slate-50/70">
                              Riwayat Vendor ({filteredVendors.length})
                            </div>
                            {filteredVendors.map((v) => (
                              <button
                                key={v}
                                type="button"
                                onMouseDown={(e) => {
                                  e.preventDefault()
                                  setTransportForm((c) => ({ ...c, vendor_name: v.toUpperCase() }))
                                  setShowVendorDropdown(false)
                                }}
                                className={`w-full text-left px-3.5 py-2 text-[14px] font-medium transition-colors flex items-center justify-between ${
                                  transportForm.vendor_name.trim().toUpperCase() === v.toUpperCase()
                                    ? 'bg-indigo-50 text-indigo-700 font-bold'
                                    : 'text-slate-800 hover:bg-indigo-50/80 hover:text-indigo-700'
                                }`}
                              >
                                <span>{v}</span>
                                {transportForm.vendor_name.trim().toUpperCase() === v.toUpperCase() && (
                                  <Check className="h-4 w-4 text-indigo-600 shrink-0" />
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-3">
                      <div>
                        {savedSuccess && (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[14px] font-semibold text-emerald-700 animate-fadeIn">
                            <Check className="h-4 w-4" />
                            Perubahan tersimpan
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={saveTransportDetails}
                        disabled={savingTransport}
                        data-busy={savingTransport}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-[14px] font-semibold text-white shadow-xs hover:bg-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-60 transition-colors"
                      >
                        {savingTransport ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Menyimpan...
                          </>
                        ) : (
                          'Simpan Informasi Pengiriman'
                        )}
                      </button>
                    </div>
                  </div>

                  {/* ── 3. Data Detail Items Table ── */}
                  <div className="p-5 sm:p-6 bg-slate-50/50">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-[14px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                        <Package className="h-4.5 w-4.5 text-indigo-600" />
                        Data Detail ({details.length} Item)
                      </h3>
                      <span className="text-[14px] font-semibold text-slate-500">
                        Total Qty: <strong className="text-slate-800 font-bold">{totalQuantity.toLocaleString('id-ID')}</strong>
                      </span>
                    </div>

                    {details.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-[14px] text-slate-500">
                        Tidak ada item detail untuk nomor PTR ini.
                      </div>
                    ) : (
                      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
                        <div className="overflow-x-auto max-h-[46vh]">
                          <table className="w-full text-[14px] text-left border-collapse">
                            <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-100/90 backdrop-blur-xs">
                              <tr>
                                <th className="px-3.5 py-2.5 text-center text-[14px] font-bold uppercase tracking-wider text-slate-800 whitespace-nowrap w-12">
                                  NO.
                                </th>
                                <th className="px-3.5 py-2.5 text-left text-[14px] font-bold uppercase tracking-wider text-slate-800 whitespace-nowrap">
                                  ITEM NO
                                </th>
                                <th className="px-3.5 py-2.5 text-left text-[14px] font-bold uppercase tracking-wider text-slate-800 whitespace-nowrap min-w-[200px]">
                                  DESKRIPSI (MATERIAL MASTER)
                                </th>
                                <th className="px-3.5 py-2.5 text-right text-[14px] font-bold uppercase tracking-wider text-slate-800 whitespace-nowrap">
                                  QTY
                                </th>
                                <th className="px-3.5 py-2.5 text-left text-[14px] font-bold uppercase tracking-wider text-slate-800 whitespace-nowrap">
                                  LOT NO
                                </th>
                                <th className="px-3.5 py-2.5 text-left text-[14px] font-bold uppercase tracking-wider text-slate-800 whitespace-nowrap">
                                  EXPIRED DATE
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-medium">
                              {details.map((d, idx) => (
                                <tr
                                  key={String(d.id)}
                                  className="hover:bg-indigo-50/30 transition-colors"
                                >
                                  <td className="px-3.5 py-2.5 text-center font-semibold text-slate-500">
                                    {idx + 1}
                                  </td>
                                  <td className="px-3.5 py-2.5 font-mono font-semibold text-indigo-900 whitespace-nowrap">
                                    {d.item_no ?? '-'}
                                  </td>
                                  <td className="px-3.5 py-2.5 text-slate-700 whitespace-nowrap">
                                    {d.item_name || d.description || '-'}
                                  </td>
                                  <td className="px-3.5 py-2.5 text-right font-bold text-slate-900 whitespace-nowrap">
                                    {Number(d.quantity ?? 0).toLocaleString('id-ID')}
                                  </td>
                                  <td className="px-3.5 py-2.5 font-mono text-slate-600 whitespace-nowrap">
                                    {d.lot_no || '-'}
                                  </td>
                                  <td className="px-3.5 py-2.5 text-slate-600 whitespace-nowrap">
                                    {formatDate(d.expiration_date)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot className="border-t-2 border-slate-200 bg-slate-50/80 font-semibold text-slate-800">
                              <tr>
                                <td colSpan={3} className="px-3.5 py-2.5 text-[14px] uppercase tracking-wider text-slate-500 font-bold">
                                  TOTAL ({details.length} ITEM)
                                </td>
                                <td className="px-3.5 py-2.5 text-right text-[14px] font-bold text-indigo-700 whitespace-nowrap">
                                  {totalQuantity.toLocaleString('id-ID')}
                                </td>
                                <td colSpan={2} />
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
        </DialogShell>
      )}
    </>
  )
}
