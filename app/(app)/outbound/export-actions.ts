'use server'

import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function getOutboundExportData(months?: string[]) {
  let q = supabaseAdmin
    .from('outbound_header')
    .select(
      'pss_no, psi_no, document_date, order_no, customer_no, customer_name, ' +
      'ship_to_city, cust_receipt_date, promised_delivery_date, ' +
      'delivery_delay_days, is_late, location_code, shipping_agent_code, ' +
      'package_tracking_no, source_file, import_period'
    )
    .order('document_date', { ascending: false })
    .limit(5000)

  if (months && months.length > 0) {
    const conditions = months.map(m => {
      const [y, mo] = m.split('-').map(Number)
      const next = mo === 12 ? `${y+1}-01-01` : `${y}-${String(mo+1).padStart(2,'0')}-01`
      return `and(document_date.gte.${m}-01,document_date.lt.${next})`
    }).join(',')
    q = q.or(conditions)
  }

  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

export async function getOutboundDetailExportData(months?: string[]) {
  // Ambil detail berdasarkan outbound_header yang sama (join via document_no)
  let q = supabaseAdmin
    .from('outbound_detail')
    .select(
      'entry_no, document_no, posting_date, item_no, description, ' +
      'quantity, qty_out, lot_no, expiration_date, location_code, ' +
      'entry_type, source_file'
    )
    .order('document_no')
    .order('entry_no')
    .limit(20000)

  const { data, error } = await q
  if (error) throw error
  return data ?? []
}
