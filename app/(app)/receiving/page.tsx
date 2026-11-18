import { wibToday } from '@/lib/wib-time'
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { NavSyncButton } from '@/components/shared/NavSyncButton'
import ReceivingTable from '@/components/receiving/ReceivingTable'
import ReceivingFilter from '@/components/receiving/ReceivingFilter'
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
    .select('*')
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

async function getReceivingDetails(ptrNos?: string[]) {
  let query = supabase
    .from('receiving_detail')
    .select('id, receiving_header_id, document_no, item_no, description, quantity, location_code')
    .order('document_no', { ascending: true })

  if (ptrNos && ptrNos.length > 0) {
    query = query.in('document_no', ptrNos)
  } else {
    query = query.limit(1000)
  }

  const { data } = await query
  return data ?? []
}

export default async function ReceivingPage({ searchParams }: { searchParams: Promise<{ month?: string | string[] }> }) {
  const sp = await searchParams
  const availableMonths = await getAvailableMonths()
  const currentMonthStr = wibToday().slice(0, 7)
  const defaultMonth = availableMonths.includes(currentMonthStr)
    ? currentMonthStr
    : (availableMonths[0] ?? currentMonthStr)

  const rawMonth = sp.month
  let months: string[] = []
  if (rawMonth === undefined) {
    months = [defaultMonth]
  } else if (rawMonth === 'all') {
    months = []
  } else if (typeof rawMonth === 'string') {
    months = rawMonth.split(',').filter(Boolean)
  } else if (Array.isArray(rawMonth)) {
    months = rawMonth.filter(Boolean)
  }

  const rows = await getReceiving(months)
  const ptrNos = rows.map((r: any) => String(r.ptr_no ?? '').trim()).filter(Boolean)

  const details = await getReceivingDetails(ptrNos.length > 0 ? ptrNos : undefined)

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-4 flex-wrap pb-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text">Receiving</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Suspense>
            <ReceivingFilter months={availableMonths} defaultMonth={defaultMonth} />
          </Suspense>
          <NavSyncButton />
        </div>
      </header>

      <ReceivingTable rows={rows} details={details} />
    </div>
  )
}
