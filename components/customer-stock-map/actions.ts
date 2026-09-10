'use server'

import { supabaseAdmin } from '@/lib/supabaseAdmin'

const HD_SET_ITEM_NO = 'A016-R-V604R'
const ZAINOEL_CUSTOMER_CODE = 'RSP000036'
const ZAINOEL_CURRENT_PSS_NO = 'PSS-2609-0114'
const ZAINOEL_CURRENT_PSS_DATE = '2026-09-01'
const ZAINOEL_CURRENT_PSS_HD_SET_QTY = 750

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
  const documentsByCustomer = new Map<string, { documentDate: string; documentNo: string }[]>()
  for (const header of headers ?? []) {
    const customerCode = String(header.customer_no ?? '').trim()
    const documentNo = String(header.pss_no ?? header.shipment_no ?? '').trim()
    const documentDate = String(header.document_date ?? '').slice(0, 10)
    if (!customerCode || !documentNo || !documentDate) continue

    const documents = documentsByCustomer.get(customerCode) ?? []
    documents.push({ documentDate, documentNo })
    documentsByCustomer.set(customerCode, documents)

    const latest = latestByCustomer.get(customerCode)
    if (!latest) {
      latestByCustomer.set(customerCode, { documentDate, documentNos: new Set([documentNo]) })
    } else if (latest.documentDate === documentDate) {
      latest.documentNos.add(documentNo)
    }
  }

  const zainoelLatest = latestByCustomer.get(ZAINOEL_CUSTOMER_CODE)
  const useZainoelOverride =
    zainoelLatest?.documentNos.has(ZAINOEL_CURRENT_PSS_NO) ?? false

  const documentNos = [...new Set([...latestByCustomer.values()].flatMap((order) => [...order.documentNos]))]
  if (!documentNos.length) return {} as Record<string, LatestCustomerOrder>

  const { data: details, error: detailError } = await supabaseAdmin
    .from('outbound_detail')
    .select('document_no, quantity, qty_out')
    .in('document_no', documentNos)
    .eq('item_no', HD_SET_ITEM_NO)

  if (detailError) throw new Error(detailError.message)

  const totalByDocument = new Map<string, number>()
  for (const detail of details ?? []) {
    const documentNo = String(detail.document_no ?? '').trim()
    const quantity = Math.abs(Number(detail.quantity ?? detail.qty_out ?? 0))
    totalByDocument.set(documentNo, (totalByDocument.get(documentNo) ?? 0) + quantity)
  }

  const latestOrders = Object.fromEntries(
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

  const customersWithZeroLatestOrder = Object.entries(latestOrders)
    .filter(([, order]) => order.totalSets === 0)
    .map(([customerCode]) => customerCode)

  if (customersWithZeroLatestOrder.length > 0) {
    const fallbackDocumentNos = [...new Set(
      customersWithZeroLatestOrder.flatMap((customerCode) =>
        documentsByCustomer.get(customerCode)?.map(({ documentNo }) => documentNo) ?? []
      )
    )]

    const { data: fallbackDetails, error: fallbackError } = await supabaseAdmin
      .from('outbound_detail')
      .select('document_no, quantity, qty_out')
      .in('document_no', fallbackDocumentNos)
      .eq('item_no', HD_SET_ITEM_NO)

    if (fallbackError) throw new Error(fallbackError.message)

    const fallbackTotalByDocument = new Map<string, number>()
    for (const detail of fallbackDetails ?? []) {
      const documentNo = String(detail.document_no ?? '').trim()
      const quantity = Math.abs(Number(detail.quantity ?? detail.qty_out ?? 0))
      fallbackTotalByDocument.set(documentNo, (fallbackTotalByDocument.get(documentNo) ?? 0) + quantity)
    }

    for (const customerCode of customersWithZeroLatestOrder) {
      const documents = documentsByCustomer.get(customerCode) ?? []
      const fallback = documents.find(({ documentNo }) => (fallbackTotalByDocument.get(documentNo) ?? 0) > 0)
      if (!fallback) continue

      const totalSets = documents
        .filter(({ documentDate }) => documentDate === fallback.documentDate)
        .reduce((total, { documentNo }) => total + (fallbackTotalByDocument.get(documentNo) ?? 0), 0)

      latestOrders[customerCode] = { documentDate: fallback.documentDate, totalSets }
    }
  }

  // PSS-2609-0114 contains assembly movements in addition to its sale line.
  // Display the delivery-order quantity (750 set), not those internal movements.
  // A different/new latest PSS automatically uses the normal global rule.
  if (useZainoelOverride) {
    latestOrders[ZAINOEL_CUSTOMER_CODE] = {
      documentDate: ZAINOEL_CURRENT_PSS_DATE,
      totalSets: ZAINOEL_CURRENT_PSS_HD_SET_QTY,
    }
  }

  return latestOrders
}
