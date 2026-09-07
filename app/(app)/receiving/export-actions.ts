'use server'

import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function getReceivingExportData(months?: string[]) {
  let q = supabaseAdmin
    .from('receiving_header')
    .select(
      'ptr_no, transfer_order_no, transfer_from_code, transfer_to_code, ' +
      'posting_date, shipment_date, receipt_date, shipping_agent_code, ' +
      'ship_to_receipt_days, receipt_to_posting_days, ship_to_posting_days, ' +
      'source_file, import_period'
    )
    .order('posting_date', { ascending: false })
    .limit(5000)

  if (months && months.length > 0) {
    const conditions = months.map(m => {
      const [y, mo] = m.split('-').map(Number)
      const next = mo === 12 ? `${y+1}-01-01` : `${y}-${String(mo+1).padStart(2,'0')}-01`
      return `and(posting_date.gte.${m}-01,posting_date.lt.${next})`
    }).join(',')
    q = q.or(conditions)
  }

  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

export async function getReceivingDetailExportData() {
  const { data, error } = await supabaseAdmin
    .from('receiving_detail')
    .select(
      'id, document_no, item_no, description, quantity, uom, ' +
      'lot_no, expiration_date, location_code, posting_date, source_file'
    )
    .order('document_no')
    .limit(20000)
  if (error) throw error
  return data ?? []
}
