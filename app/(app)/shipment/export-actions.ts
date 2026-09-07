'use server'

import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function getShipmentExportData(status?: string) {
  let q = supabaseAdmin
    .from('vw_shipment_tms')
    .select(
      'id, source_type, pss_no, trip_id, status, ' +
      'customer_code, customer_name, destination_city, dk_lk, ' +
      'document_date, promised_delivery_date, dispatch_time, delivery_time, ' +
      'is_on_time, ' +
      'transporter_name, transporter_type, transporter_service_model, ' +
      'vehicle_no, driver_name, helper_name, route_code, ' +
      'cost_model, payment_voucher_no, ' +
      'bbm_liter, bbm_rupiah, bongkar_muat_cost, hotel_cost, ' +
      'uang_makan_driver, uang_makan_helper, toll_cost, parkir_cost, kirim_paket_cost, ' +
      'invoice_no_eksternal, total_biaya_eksternal, ' +
      'invoice_value, total_biaya, cost_ratio, ' +
      'notes, created_at'
    )
    .order('promised_delivery_date', { ascending: false })
    .limit(5000)

  if (status && status !== 'all') q = q.eq('status', status)

  const { data, error } = await q
  if (error) throw error
  return data ?? []
}
