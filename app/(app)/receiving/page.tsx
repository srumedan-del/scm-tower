import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { PtrHeaderUploadButton, PtrDetailUploadButton } from '@/components/receiving/ReceivingUploadButton'
import { ReceivingExportButton } from '@/components/receiving/ReceivingExportButton'
import ReceivingTable from '@/components/receiving/ReceivingTable'
import ReceivingFilter from '@/components/receiving/ReceivingFilter'
import ReceivingVerifyButton from '@/components/receiving/ReceivingVerifyButton'
import { Suspense } from 'react'

export const dynamic = 'force-dynamic'

function getNextMonthFirstDay(month: string): string {
  const [y, m] = month.split('-').map(Number)
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`
  return next
}

async function getReceiving(months: string[]) {
  let query = supabase
    .from('receiving_header')
    .select('id, ptr_no, transfer_order_no, transfer_from_code, transfer_to_code, posting_date, shipment_date, receipt_date, shipping_agent_code, ship_to_receipt_days, receipt_to_posting_days, ship_to_posting_days')
    .order('posting_date', { ascending: false })
    .order('ptr_no', { ascending: false })
    .order('transfer_order_no', { ascending: false })

  if (months.length > 0) {
    const conditions = months
      .map((m) => `and(posting_date.gte.${m}-01,posting_date.lt.${getNextMonthFirstDay(m)})`)
      .join(',')
    query = query.or(conditions)
  }

  const { data } = await query
  return data ?? []
}

async function getAvailableMonths() {
  const { data } = await supabase
    .from('receiving_header')
    .select('posting_date')
    .order('posting_date', { ascending: true })
    .limit(1)

  const minDate = data?.[0]?.posting_date
  const minDateNormalized = minDate ?? '2020-01'
  const [minYear, minMonth] = minDateNormalized.slice(0, 7).split('-').map(Number)

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

async function getReceivingDetails() {
  const { data } = await supabase
    .from('receiving_detail')
    .select('id, receiving_header_id, document_no, item_no, description, quantity, uom, location_code')
    .order('document_no', { ascending: true })
    .limit(500)
  return data ?? []
}

export default async function ReceivingPage({ searchParams }: { searchParams: Promise<{ month?: string | string[] }> }) {
  const sp = await searchParams
  const monthParam = sp.month
  const months = typeof monthParam === 'string'
    ? monthParam.split(',').filter(Boolean)
    : (monthParam ?? [])

  const [rows, details, availableMonths] = await Promise.all([getReceiving(months), getReceivingDetails(), getAvailableMonths()])

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">RECEIVING / INBOUND</h1>
        <div className="flex items-center gap-3">
          <Suspense>
            <ReceivingFilter months={availableMonths} />
          </Suspense>
          <ReceivingExportButton months={months} />
          <PtrHeaderUploadButton />
          <PtrDetailUploadButton />
          <ReceivingVerifyButton />
        </div>
      </header>

      <ReceivingTable rows={rows} details={details} />
    </div>
  )
}
