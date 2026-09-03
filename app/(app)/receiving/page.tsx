import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { PtrHeaderUploadButton, PtrDetailUploadButton } from '@/components/receiving/ReceivingUploadButton'
import ReceivingTable from '@/components/receiving/ReceivingTable'
import ReceivingFilter from '@/components/receiving/ReceivingFilter'
import { Suspense } from 'react'

export const dynamic = 'force-dynamic'

function getNextMonthFirstDay(month: string): string {
  const [y, m] = month.split('-').map(Number)
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`
  return next
}

async function getReceiving(month?: string) {
  let query = supabase
    .from('receiving_header')
    .select('id, ptr_no, transfer_order_no, transfer_from_code, transfer_to_code, posting_date, shipment_date, receipt_date, shipping_agent_code, ship_to_receipt_days, receipt_to_posting_days, ship_to_posting_days')
    .order('receipt_date', { ascending: false })

  if (month) {
    const end = getNextMonthFirstDay(month)
    query = query.gte('receipt_date', `${month}-01`).lt('receipt_date', end)
  }

  const { data } = await query
  return data ?? []
}

async function getAvailableMonths() {
  const { data } = await supabase
    .from('receiving_header')
    .select('receipt_date')
    .order('receipt_date', { ascending: true })

  const months = new Set<string>()
  for (const row of data ?? []) {
    if (row.receipt_date) {
      months.add(row.receipt_date.slice(0, 7))
    }
  }
  return [...months].sort().reverse()
}

async function getReceivingDetails() {
  const { data } = await supabase
    .from('receiving_detail')
    .select('id, receiving_header_id, document_no, item_no, description, quantity, uom, location_code')
    .order('document_no', { ascending: true })
    .limit(500)
  return data ?? []
}

export default async function ReceivingPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { month } = await searchParams
  const [rows, details, months] = await Promise.all([getReceiving(month), getReceivingDetails(), getAvailableMonths()])

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">RECEIVING / INBOUND</h1>
        <div className="flex items-center gap-3">
          <Suspense>
            <ReceivingFilter months={months} />
          </Suspense>
          <PtrHeaderUploadButton />
          <PtrDetailUploadButton />
        </div>
      </header>

      <ReceivingTable rows={rows} details={details} />
    </div>
  )
}
