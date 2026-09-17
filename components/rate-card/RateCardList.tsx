'use client'

import { useState } from 'react'
import SearchableSelect from '@/components/ui/SearchableSelect'
import { RateCardRow } from './RateCardRow'
import RateCardAddButton from './RateCardAddButton'

type Rate = {
  id?: number
  rate_code: string
  origin: string
  destination: string
  vehicle_type: string | null
  tonnage: number | null
  cbm: number | null
  tariff_model: string | null
  price: number | null
  status: string | null
  service_name: string | null
  effective_from: string | null
  vendor_id: number | null
  vendor_name?: string | null
}

function normalize(value: unknown) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').toUpperCase()
}

export default function RateCardList({ rates }: { rates: Rate[] }) {
  const [destination, setDestination] = useState('')
  const [vendor, setVendor] = useState('')
  const destinations = [...new Set(rates.map(rate => normalize(rate.destination)).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right, 'id'))
  const vendors = [...new Set(rates.map(rate => normalize(rate.vendor_name)).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right, 'id'))
  const filteredRates = rates.filter(rate =>
    (!destination || normalize(rate.destination) === destination) &&
    (!vendor || normalize(rate.vendor_name) === vendor)
  )

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <h1 className="text-3xl font-bold tracking-tight">MASTER RATE CARD</h1>
        <div className="flex flex-wrap items-center justify-start gap-2 lg:justify-end">
          <SearchableSelect
            value={destination}
            onChange={setDestination}
            placeholder="Semua kota tujuan"
            options={destinations.map(city => ({ value: city, label: city }))}
            className="h-10 w-[min(100%,14rem)] rounded-lg border-gray-300 bg-white px-3 text-sm shadow-sm transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
          <SearchableSelect
            value={vendor}
            onChange={setVendor}
            placeholder="Semua vendor"
            options={vendors.map(name => ({ value: name, label: name }))}
            className="h-10 w-[min(100%,14rem)] rounded-lg border-gray-300 bg-white px-3 text-sm shadow-sm transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
          <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 shadow-sm">
            {filteredRates.length} rate card{filteredRates.length === 1 ? '' : 's'}
            {destination ? ` untuk ${destination}` : ''}
            {vendor ? ` dari ${vendor}` : ''}
          </div>
          <RateCardAddButton />
        </div>
      </div>

      <section className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-white">
        <div className="data-list-scroll min-h-0 flex-1 overflow-x-hidden overflow-y-auto max-h-none">
          <table className="w-full table-fixed text-xs sm:text-sm">
          <colgroup>
            <col className="w-[13%]" />
            <col className="w-[16%]" />
            <col className="w-[20%]" />
            <col className="w-[18%]" />
            <col className="w-[13%]" />
            <col className="w-[12%]" />
            <col className="w-[8%]" />
          </colgroup>
          <thead className="border-b border-border bg-gray-50">
            <tr>
              <th className="px-2 py-3 text-center text-[11px] font-bold uppercase tracking-wide text-gray-900 sm:px-3">RATE CODE</th>
              <th className="px-2 py-3 text-center text-[11px] font-bold uppercase tracking-wide text-gray-900 sm:px-3">VENDOR</th>
              <th className="px-2 py-3 text-center text-[11px] font-bold uppercase tracking-wide text-gray-900 sm:px-3">ORIGIN → DESTINATION</th>
              <th className="px-2 py-3 text-center text-[11px] font-bold uppercase tracking-wide text-gray-900 sm:px-3">TYPE SERVICE</th>
              <th className="px-2 py-3 text-center text-[11px] font-bold uppercase tracking-wide text-gray-900 sm:px-3">TARIFF MODEL</th>
              <th className="px-2 py-3 text-center text-[11px] font-bold uppercase tracking-wide text-gray-900 sm:px-3">PRICE</th>
              <th className="px-2 py-3 text-center text-[11px] font-bold uppercase tracking-wide text-gray-900 sm:px-3">STATUS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredRates.map(rate => <RateCardRow key={rate.id ?? rate.rate_code} rate={rate as any} />)}
            {filteredRates.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">BELUM ADA RATE CARD UNTUK KOTA INI.</td></tr>
            )}
          </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}