'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { CheckCircle2, MapPinOff, ReceiptText, RefreshCw, Hospital, Wand2 } from 'lucide-react'
import { SkeletonRows } from '@/components/ui/LoadingStates'
import { notify } from '@/lib/feedback'
import { applyShipmentCities, getMaintainOverview, updateCustomerCity, type MaintainOverview } from './actions'

const EMPTY: MaintainOverview = { missingCity: [], customersWithoutCity: [], retailGaps: [], cityOptions: [] }
const th = 'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600'
const td = 'px-4 py-2.5 align-middle'
const input = 'w-full min-w-[160px] rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm uppercase focus:border-indigo-400 focus:outline-none'
const smallButton = 'inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50'

function Section({ icon: Icon, title, count, desc, children, action }: {
  icon: typeof MapPinOff; title: string; count: number; desc: string; children: React.ReactNode; action?: React.ReactNode
}) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <Icon className="h-5 w-5 text-gold-700" aria-hidden="true" /> {title}
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${count ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-700'}`}>{count}</span>
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">{desc}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function AllGood({ text }: { text: string }) {
  return (
    <p className="flex items-center gap-2 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
      <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> {text}
    </p>
  )
}

/** Pemeriksaan kelengkapan data yang dipakai Shipment Tracking dan Shipment Cost. */
export default function MaintainDataPage() {
  const [data, setData] = useState<MaintainOverview>(EMPTY)
  const [loaded, setLoaded] = useState(false)
  const [loading, startLoading] = useTransition()
  const [saving, startSaving] = useTransition()
  const [cityById, setCityById] = useState<Record<number, string>>({})
  const [customerCity, setCustomerCity] = useState<Record<number, string>>({})
  const [saveToMaster, setSaveToMaster] = useState(true)

  const load = () => startLoading(async () => {
    try {
      const next = await getMaintainOverview()
      setData(next)
      setCityById(Object.fromEntries(next.missingCity.map(row => [row.id, row.master_city ?? ''])))
      setCustomerCity({})
      setLoaded(true)
    } catch (error: any) {
      notify.error('Tidak dapat memuat data', error.message)
    }
  })
  useEffect(() => { load() }, [])

  const withSuggestion = useMemo(() => data.missingCity.filter(row => row.master_city), [data.missingCity])

  function saveShipments(items: { id: number; city: string }[], label: string) {
    const valid = items.filter(item => item.city.trim())
    if (!valid.length) return notify.error('Kota belum diisi', 'Isi kota tujuan dulu.')
    startSaving(async () => {
      try {
        const result = await applyShipmentCities(valid, saveToMaster)
        notify.success(label, `${result.updated} shipment diperbarui${result.mastersUpdated ? `, ${result.mastersUpdated} Master Customer dilengkapi` : ''}.`)
        load()
      } catch (error: any) {
        notify.error('Gagal menyimpan', error.message)
      }
    })
  }

  function saveCustomer(id: number) {
    const city = customerCity[id]?.trim()
    if (!city) return notify.error('Kota belum diisi', 'Isi kota customer dulu.')
    startSaving(async () => {
      try {
        const result = await updateCustomerCity(id, city)
        notify.success('Kota customer disimpan', result.shipmentsUpdated ? `${result.shipmentsUpdated} shipment ikut dilengkapi.` : undefined)
        load()
      } catch (error: any) {
        notify.error('Gagal menyimpan', error.message)
      }
    })
  }

  const showSkeleton = loading && !loaded

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Maintain Data</h1>
          <p className="mt-1 text-sm text-slate-500">Data yang belum lengkap di Shipment Tracking, Shipment Cost, dan Master Customer.</p>
        </div>
        <button type="button" onClick={load} disabled={loading} className={smallButton}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" /> Periksa ulang
        </button>
      </header>

      <datalist id="maintain-city-options">
        {data.cityOptions.map(city => <option key={city} value={city} />)}
      </datalist>

      {/* 1 + 2. Kota tujuan kosong: tampil "-" di Shipment Tracking dan Shipment Cost, DK/LK & rate card tidak terbaca. */}
      <Section
        icon={MapPinOff}
        title="Shipment tanpa kota tujuan"
        count={data.missingCity.length}
        desc="Tampil sebagai “-” di Shipment Tracking dan Shipment Cost; DK/LK dan rate card tidak bisa dihitung."
        action={withSuggestion.length > 0 && (
          <button
            type="button"
            disabled={saving}
            onClick={() => saveShipments(withSuggestion.map(row => ({ id: row.id, city: row.master_city! })), 'Kota dari Master Customer diterapkan')}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            <Wand2 className="h-4 w-4" aria-hidden="true" /> Terapkan kota dari Master ({withSuggestion.length})
          </button>
        )}
      >
        {!showSkeleton && loaded && data.missingCity.length === 0 ? <AllGood text="Semua shipment sudah punya kota tujuan." /> : (
          <>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={saveToMaster} onChange={event => setSaveToMaster(event.target.checked)} />
              Simpan juga ke Master Customer bila kotanya masih kosong
            </label>
            <div className="overflow-auto rounded-2xl border border-slate-200 bg-white">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className={th}>PSS / Trip</th>
                    <th className={th}>Customer</th>
                    <th className={th}>Tgl Dokumen</th>
                    <th className={th}>Status</th>
                    <th className={th}>Kota di Master</th>
                    <th className={th}>Kota tujuan</th>
                    <th className={th} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {showSkeleton && <SkeletonRows cols={7} rows={3} />}
                  {data.missingCity.map(row => (
                    <tr key={row.id}>
                      <td className={`${td} font-mono text-xs`}>
                        <div className="font-semibold text-slate-900">{row.pss_no ?? '-'}</div>
                        <div className="text-slate-500">{row.trip_id ?? ''}</div>
                      </td>
                      <td className={`${td} font-semibold text-slate-800`}>
                        {row.customer_name ?? '-'}
                        {row.cost_model && <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600">{row.cost_model}</span>}
                      </td>
                      <td className={td}>{row.document_date ?? '-'}</td>
                      <td className={td}>{row.status ?? '-'}</td>
                      <td className={td}>
                        {row.master_city
                          ? <span className="font-semibold text-green-700">{row.master_city}</span>
                          : <span className="text-xs text-amber-700">{row.master_customer_id ? 'Kosong di Master' : 'Tidak ada di Master'}</span>}
                      </td>
                      <td className={td}>
                        <input
                          list="maintain-city-options"
                          value={cityById[row.id] ?? ''}
                          onChange={event => setCityById(current => ({ ...current, [row.id]: event.target.value }))}
                          placeholder="Ketik kota…"
                          className={input}
                          aria-label={`Kota tujuan ${row.pss_no ?? row.id}`}
                        />
                      </td>
                      <td className={`${td} text-right`}>
                        <button type="button" disabled={saving} onClick={() => saveShipments([{ id: row.id, city: cityById[row.id] ?? '' }], 'Kota tujuan disimpan')} className={smallButton}>
                          Simpan
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Section>

      {/* 3a. Sumber masalah: customer tanpa kota membuat PSS berikutnya ikut kosong. */}
      <Section
        icon={Hospital}
        title="Master Customer tanpa kota"
        count={data.customersWithoutCity.length}
        desc="Isi di sini agar PSS berikutnya otomatis punya kota tujuan. Shipment customer ini yang masih kosong ikut dilengkapi."
      >
        {!showSkeleton && loaded && data.customersWithoutCity.length === 0 ? <AllGood text="Semua customer aktif sudah punya kota." /> : (
          <div className="overflow-auto rounded-2xl border border-slate-200 bg-white">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className={th}>Kode</th>
                  <th className={th}>Customer</th>
                  <th className={th}>Alamat</th>
                  <th className={`${th} text-right`}>Shipment</th>
                  <th className={th}>Kota</th>
                  <th className={th} />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {showSkeleton && <SkeletonRows cols={6} rows={3} />}
                {data.customersWithoutCity.map(customer => (
                  <tr key={customer.id}>
                    <td className={`${td} font-mono text-xs`}>{customer.customer_code ?? '-'}</td>
                    <td className={`${td} font-semibold text-slate-800`}>{customer.customer_name ?? '-'}</td>
                    <td className={`${td} max-w-[280px] text-xs text-slate-500`}>{[customer.address, customer.province].filter(Boolean).join(', ') || '-'}</td>
                    <td className={`${td} text-right font-mono`}>{customer.shipments}</td>
                    <td className={td}>
                      <input
                        list="maintain-city-options"
                        value={customerCity[customer.id] ?? ''}
                        onChange={event => setCustomerCity(current => ({ ...current, [customer.id]: event.target.value }))}
                        placeholder="Ketik kota…"
                        className={input}
                        aria-label={`Kota ${customer.customer_name ?? customer.id}`}
                      />
                    </td>
                    <td className={`${td} text-right`}>
                      <button type="button" disabled={saving} onClick={() => saveCustomer(customer.id)} className={smallButton}>Simpan</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* 3b. Retail In Transit yang belum lengkap: biaya kosong tampil "-" dan tidak masuk Rekap Resi. */}
      <Section
        icon={ReceiptText}
        title="Pengiriman retail belum lengkap"
        count={data.retailGaps.length}
        desc="Retail In Transit tanpa nomor resi, biaya, atau gambar resi. Biaya kosong tampil “-” dan tidak terhitung di Shipment Cost."
        action={<Link href="/shipment" className={smallButton}>Buka Shipment Tracking</Link>}
      >
        {!showSkeleton && loaded && data.retailGaps.length === 0 ? <AllGood text="Semua pengiriman retail sudah lengkap." /> : (
          <div className="overflow-auto rounded-2xl border border-slate-200 bg-white">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className={th}>PSS</th>
                  <th className={th}>Customer</th>
                  <th className={th}>Tgl Dokumen</th>
                  <th className={th}>Vendor</th>
                  <th className={th}>Belum ada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {showSkeleton && <SkeletonRows cols={5} rows={3} />}
                {data.retailGaps.map(row => (
                  <tr key={row.id}>
                    <td className={`${td} font-mono text-xs font-semibold`}>{row.pss_no ?? '-'}</td>
                    <td className={`${td} font-semibold text-slate-800`}>{row.customer_name ?? '-'}</td>
                    <td className={td}>{row.document_date ?? '-'}</td>
                    <td className={td}>{row.transporter ?? '-'}</td>
                    <td className={td}>
                      <div className="flex flex-wrap gap-1">
                        {row.missing.map(item => <span key={item} className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">{item}</span>)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  )
}
