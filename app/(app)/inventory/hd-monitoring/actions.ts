'use server'

import { supabaseAdmin } from '@/lib/supabaseAdmin'

export type HdMonitoringRow = {
  id: number
  customer_id: number
  customer_code: string
  customer_name: string | null
  city: string | null
  snapshot_date: string

  // Konfigurasi per customer
  treatment_per_day_per_machine: number
  working_days_per_month: number
  safety_stock_days: number
  rop_days: number
  lead_time_reorder_days: number

  // Input manual
  last_known_stock_date: string | null
  last_known_stock_qty: number | null
  last_shipment_date: string | null
  last_shipment_qty: number | null

  // GENERATED (calculated in DB)
  daily_usage: number | null
  monthly_need: number | null
  safety_stock_qty: number | null
  rop_qty: number | null
  estimated_stock: number | null
  doi_days: number | null
  estimated_stockout_date: string | null
  available_stock: number | null
  available_days: number | null
  fu_po_date: string | null

  // HD machine info (dari customers)
  hd_machine_count: number | null

  notes: string | null
}

export type HdCustomerOption = {
  id: number
  customer_code: string
  customer_name: string | null
  city: string | null
  machine_count: number | null
}

// Ambil semua monitoring HD (snapshot terbaru per customer)
export async function getHdMonitoring(): Promise<HdMonitoringRow[]> {
  const { data, error } = await supabaseAdmin
    .from('hd_stock_monitoring')
    .select(`
      *,
      customers!inner(customer_code, customer_name, city, machine_count)
    `)
    .order('snapshot_date', { ascending: false })
    .order('customer_id')
    .limit(500)

  if (error) throw error
  if (!data) return []

  return data.map((r: any) => ({
    ...r,
    customer_code: r.customers?.customer_code ?? '',
    customer_name: r.customers?.customer_name ?? null,
    city:          r.customers?.city ?? null,
    hd_machine_count: r.customers?.machine_count ?? null,
  }))
}

// Ambil customer HD (is_hd_customer = true atau machine_count > 0)
export async function getHdCustomers(): Promise<HdCustomerOption[]> {
  const { data, error } = await supabaseAdmin
    .from('customers')
    .select('id, customer_code, customer_name, city, machine_count')
    .or('is_hd_customer.eq.true,machine_count.gt.0')
    .eq('is_active', true)
    .order('customer_name')
  if (error) throw error
  return (data ?? []) as HdCustomerOption[]
}

// Upsert snapshot monitoring
export async function upsertHdMonitoring(
  row: Partial<HdMonitoringRow> & { customer_id: number; snapshot_date: string }
) {
  const {
    id, customer_code, customer_name, city, hd_machine_count,
    // GENERATED — jangan di-insert
    daily_usage, monthly_need, safety_stock_qty, rop_qty,
    estimated_stock, doi_days, estimated_stockout_date,
    available_stock, available_days, fu_po_date,
    ...payload
  } = row as any

  if (id) {
    const { error } = await supabaseAdmin.from('hd_stock_monitoring').update(payload).eq('id', id)
    if (error) throw error
  } else {
    const { error } = await supabaseAdmin.from('hd_stock_monitoring').insert(payload)
    if (error) throw error
  }
}

export async function deleteHdMonitoring(id: number) {
  const { error } = await supabaseAdmin.from('hd_stock_monitoring').delete().eq('id', id)
  if (error) throw error
}
