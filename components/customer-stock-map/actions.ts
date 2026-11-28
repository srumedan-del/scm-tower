'use server'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireAuthenticatedUser } from '@/lib/requireUser'

const HD_SET_ITEM_NO = 'A016-R-V604R'
const ZAINOEL_CUSTOMER_CODE = 'RSP000036'
const ZAINOEL_CURRENT_PSS_NO = 'PSS-2609-0114'
const ZAINOEL_CURRENT_PSS_DATE = '2026-09-01'
const ZAINOEL_CURRENT_PSS_HD_SET_QTY = 750

export type LatestCustomerOrder = {
  documentDate: string
  totalSets: number
}

async function outboundLatestOrders(customerCodes: string[]) {
  await requireAuthenticatedUser()
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

/**
 * Customer HD crossdocking (dikirim langsung dari pusat, mis. RSUD Arifin Achmad, Klinik Nusa Lima)
 * tidak punya PSS Outbound di Medan; order HD set-nya dibaca dari Crossdocking berdasarkan nama.
 */
async function crossdockingLatestOrders(customerCodes: string[]) {
  const { data: customers, error } = await supabaseAdmin
    .from('customers')
    .select('customer_code, customer_name')
    .in('customer_code', customerCodes)
    .eq('customer_type', 'Crossdocking')
  if (error) throw new Error(error.message)
  const codeByName = new Map((customers ?? []).map((row) => [String(row.customer_name).trim().toUpperCase(), String(row.customer_code)]))
  if (!codeByName.size) return {} as Record<string, LatestCustomerOrder>

  const { data: headers, error: headerError } = await supabaseAdmin
    .from('crossdocking_header')
    .select('id, customer_name, document_date, received_from_hq_date, created_at')
    .in('customer_name', [...codeByName.keys()])
  if (headerError) throw new Error(headerError.message)
  if (!headers?.length) return {} as Record<string, LatestCustomerOrder>

  const { data: details, error: detailError } = await supabaseAdmin
    .from('crossdocking_detail')
    .select('crossdocking_id, quantity')
    .in('crossdocking_id', headers.map((header) => header.id))
    .eq('item_no', HD_SET_ITEM_NO)
  if (detailError) throw new Error(detailError.message)
  const setsByHeader = new Map<number, number>()
  for (const detail of details ?? []) {
    setsByHeader.set(Number(detail.crossdocking_id), (setsByHeader.get(Number(detail.crossdocking_id)) ?? 0) + Math.abs(Number(detail.quantity) || 0))
  }

  // Order terakhir = tanggal dokumen terbaru yang berisi HD set; beberapa dokumen di tanggal itu dijumlah.
  const latest: Record<string, LatestCustomerOrder> = {}
  for (const header of headers) {
    const sets = setsByHeader.get(Number(header.id)) ?? 0
    const code = codeByName.get(String(header.customer_name).trim().toUpperCase())
    const documentDate = String(header.document_date ?? header.received_from_hq_date ?? header.created_at ?? '').slice(0, 10)
    if (!code || !sets || !documentDate) continue
    const current = latest[code]
    if (!current || documentDate > current.documentDate) latest[code] = { documentDate, totalSets: sets }
    else if (documentDate === current.documentDate) current.totalSets += sets
  }
  return latest
}

export async function getLatestCustomerOrders(customerCodes: string[]) {
  await requireAuthenticatedUser()
  const codes = [...new Set(customerCodes.map((code) => code.trim()).filter(Boolean))]
  if (!codes.length) return {} as Record<string, LatestCustomerOrder>
  const [outbound, crossdocking] = await Promise.all([outboundLatestOrders(codes), crossdockingLatestOrders(codes)])
  const merged = { ...outbound }
  for (const [code, order] of Object.entries(crossdocking)) {
    if (!merged[code] || order.documentDate > merged[code].documentDate) merged[code] = order
  }
  return merged
}
