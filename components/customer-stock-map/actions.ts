'use server'

import { supabaseAdmin } from '@/lib/supabaseAdmin'

const HD_SET_ITEM_NO = 'A016-R-V604R'

export type LatestCustomerOrder = {
  documentDate: string
  totalSets: number
}

export async function getLatestCustomerOrders(customerCodes: string[]) {
  const codes = [...new Set(customerCodes.map((code) => code.trim()).filter(Boolean))]
  if (!codes.length) return {} as Record<string, LatestCustomerOrder>

  const { data: headers, error: headerError } = await supabaseAdmin
    .from('outbound_header')
    .select('customer_no, pss_no, shipment_no, document_date')
    .in('customer_no', codes)
    .not('document_date', 'is', null)
    .order('document_date', { ascending: false })

  if (headerError) throw new Error(headerError.message)

  const latestByCustomer = new Map<string, { documentDate: string; documentNos: Set<string> }>()
  for (const header of headers ?? []) {
    const customerCode = String(header.customer_no ?? '').trim()
    const documentNo = String(header.pss_no ?? header.shipment_no ?? '').trim()
    const documentDate = String(header.document_date ?? '').slice(0, 10)
    if (!customerCode || !documentNo || !documentDate) continue

    const latest = latestByCustomer.get(customerCode)
    if (!latest) {
      latestByCustomer.set(customerCode, { documentDate, documentNos: new Set([documentNo]) })
    } else if (latest.documentDate === documentDate) {
      latest.documentNos.add(documentNo)
    }
  }

  const documentNos = [...new Set([...latestByCustomer.values()].flatMap((order) => [...order.documentNos]))]
  if (!documentNos.length) return {} as Record<string, LatestCustomerOrder>

  const { data: details, error: detailError } = await supabaseAdmin
    .from('outbound_detail')
    .select('document_no, item_no, quantity, qty_out')
    .in('document_no', documentNos)

  if (detailError) throw new Error(detailError.message)

  const totalByDocument = new Map<string, number>()
  for (const detail of details ?? []) {
    if (String(detail.item_no ?? '').trim().toUpperCase() !== HD_SET_ITEM_NO) continue
    const documentNo = String(detail.document_no ?? '').trim()
    const quantity = Math.abs(Number(detail.quantity ?? detail.qty_out ?? 0))
    totalByDocument.set(documentNo, (totalByDocument.get(documentNo) ?? 0) + quantity)
  }

  return Object.fromEntries(
    [...latestByCustomer.entries()].map(([customerCode, order]) => [
      customerCode,
      {
        documentDate: order.documentDate,
        totalSets: [...order.documentNos].reduce(
          (total, documentNo) => total + (totalByDocument.get(documentNo) ?? 0),
          0
        ),
      },
    ])
  ) as Record<string, LatestCustomerOrder>
}
