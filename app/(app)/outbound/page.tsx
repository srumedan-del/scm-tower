import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { OutboundHeaderUploadButton, OutboundDetailUploadButton } from '@/components/outbound/OutboundUploadButton'
import OutboundDeleteButton from '@/components/outbound/OutboundDeleteButton'
import PssDetailModal from '@/components/outbound/PssDetailModal'
import OutboundFilter from '@/components/outbound/OutboundFilter'
import { Suspense } from 'react'

export const dynamic = 'force-dynamic'

function getNextMonthFirstDay(month: string): string {
  const [y, m] = month.split('-').map(Number)
  const next = m === 12
    ? `${y + 1}-01-01`
    : `${y}-${String(m + 1).padStart(2, '0')}-01`
  return next
}

async function getAvailableMonths() {
  const { data } = await supabase
    .from('outbound_header')
    .select('document_date')
    .not('document_date', 'is', null)
    .order('document_date', { ascending: true })
    .limit(1)

  const minDate = data?.[0]?.document_date
  const minDateNorm = minDate ?? '2026-01'
  const [minYear, minMonth] = minDateNorm.slice(0, 7).split('-').map(Number)

  const now = new Date()
  const maxYear = now.getFullYear()
  const maxMonth = now.getMonth() + 1

  const months: string[] = []
  for (let y = minYear; y <= maxYear; y++) {
    const startM = y === minYear ? minMonth : 1
    const endM = y === maxYear ? maxMonth : 12
    for (let m = startM; m <= endM; m++) {
      months.push(`${y}-${String(m).padStart(2, '0')}`)
    }
  }
  return months.sort().reverse()
}

async function getOutboundHeaders(months: string[]) {
  let query = supabase
    .from('outbound_header')
    .select(
      'id, pss_no, shipment_no, document_date, order_no, ' +
      'customer_no, customer_name, cust_receipt_date, ' +
      'delivery_delay_days, is_late'
    )
    .order('document_date', { ascending: false })
    .order('pss_no', { ascending: false })

  if (months.length > 0) {
    const conditions = months
      .map((m) => `and(document_date.gte.${m}-01,document_date.lt.${getNextMonthFirstDay(m)})`)
      .join(',')
    query = query.or(conditions)
  }

  const { data } = await query.limit(500)
  return data ?? []
}

export default async function OutboundPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string | string[] }>
}) {
  const sp = await searchParams
  const monthParam = sp.month
  const months = typeof monthParam === 'string'
    ? monthParam.split(',').filter(Boolean)
    : (monthParam ?? [])

  const [rows, availableMonths] = await Promise.all([
    getOutboundHeaders(months),
    getAvailableMonths(),
  ])

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">OUTBOUND</h1>
        <div className="flex items-center gap-3">
          <Suspense>
            <OutboundFilter months={availableMonths} />
          </Suspense>
          <OutboundHeaderUploadButton />
          <OutboundDetailUploadButton />
        </div>
      </header>

      <div className="bg-white border border-border rounded-xl overflow-hidden">
        <div className="border-b px-4 py-3 flex items-center justify-between">
          <span className="text-xs text-gray-500 font-medium">
            {rows.length} DOKUMEN
            {months.length > 0 ? ` · ${months.length} BULAN DIPILIH` : ''}
          </span>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-900 whitespace-nowrap">
                DOCUMENT DATE
              </th>
              <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-900 whitespace-nowrap">
                PSS NO
              </th>
              <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-900 whitespace-nowrap">
                ORDER NO
              </th>
              <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-900">
                CUSTOMER
              </th>
              <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-900 whitespace-nowrap">
                RECEIPT DATE
              </th>
              <th className="text-right px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-900 whitespace-nowrap">
                DELAY
              </th>
              <th className="text-center px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-900">
                ACTION
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r: any) => {
              const pssNo = String(r.pss_no ?? r.shipment_no ?? '-')
              const isLate = r.is_late === true
              const delayDays = r.delivery_delay_days ?? null

              return (
                <tr key={r.id} className="border-t border-border hover:bg-blue-50">
                  <td className="px-4 py-2.5 text-xs whitespace-nowrap">
                    {r.document_date?.slice(0, 10) ?? '-'}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <PssDetailModal pssNo={pssNo} />
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs whitespace-nowrap">
                    {String(r.order_no ?? '-').toUpperCase()}
                  </td>
                  <td className="px-4 py-2.5 text-xs max-w-[220px] truncate">
                    <span className="font-mono text-gray-400 mr-1 text-xs">
                      {r.customer_no ?? ''}
                    </span>
                    {String(r.customer_name ?? '-')}
                  </td>
                  <td className="px-4 py-2.5 text-xs whitespace-nowrap">
                    {r.cust_receipt_date?.slice(0, 10) ?? '-'}
                  </td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    {delayDays !== null ? (
                      <span
                        className={`inline-block rounded-md px-2 py-0.5 text-xs font-bold ${
                          isLate ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                        }`}
                      >
                        {delayDays} HARI
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs">-</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <OutboundDeleteButton
                      row={{
                        id: r.id,
                        outbound_header_id: r.id,
                        document_no: pssNo,
                      }}
                    />
                  </td>
                </tr>
              )
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-gray-400 text-sm">
                  {months.length > 0
                    ? 'TIDAK ADA DATA UNTUK BULAN YANG DIPILIH'
                    : 'BELUM ADA DATA OUTBOUND'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
