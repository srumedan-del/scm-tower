'use server'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireAuthenticatedUser } from '@/lib/requireUser'

export type VendorRow = {
  id: number
  vendor_code: string
  vendor_name: string
  vendor_type: string | null
  pic_name: string | null
  phone: string | null
  email: string | null
  coverage_area: string | null
  default_sla: number | null
  is_active: boolean | null
  created_at?: string | null
}

export async function getVendors() {
  const { data, error } = await supabaseAdmin
    .from('vendors')
    .select('*')
    .order('vendor_name')
    .limit(200)
  if (error) throw error
  return data ?? []
}

export async function upsertVendor(vendor: Omit<VendorRow, 'created_at'>) {
  await requireAuthenticatedUser()
  const { id, ...payload } = vendor

  let savedVendor: Pick<VendorRow, 'id' | 'vendor_name' | 'vendor_type' | 'pic_name' | 'phone' | 'email' | 'is_active'>
  if (id) {
    const { data, error } = await supabaseAdmin
      .from('vendors')
      .update(payload)
      .eq('id', id)
      .select('id, vendor_name, vendor_type, pic_name, phone, email, is_active')
      .single()
    if (error) throw error
    savedVendor = data
  } else {
    const { data, error } = await supabaseAdmin
      .from('vendors')
      .insert(payload)
      .select('id, vendor_name, vendor_type, pic_name, phone, email, is_active')
      .single()
    if (error) throw error
    savedVendor = data
  }

  // `vendors` is the master. Keep the legacy TMS table in sync so existing
  // views and historical transporter_id references remain compatible.
  const vendorType = String(savedVendor.vendor_type ?? '').toUpperCase()
  const vendorName = String(savedVendor.vendor_name ?? '').toUpperCase()
  const type = vendorType.includes('INTERNAL') ? 'Internal' : 'Eksternal'
  const service_model = type === 'Internal'
    ? null
    : (vendorType.includes('RETAIL') || vendorName.includes('INDAH LOGISTIK') || vendorName.includes('JNE'))
      ? 'Retail'
      : 'Trucking'
  const { error: syncError } = await supabaseAdmin.from('master_transporter').upsert({
    transporter_code: `VENDOR-${savedVendor.id}`,
    name: savedVendor.vendor_name,
    type,
    service_model,
    pic_name: savedVendor.pic_name,
    pic_phone: savedVendor.phone,
    pic_email: savedVendor.email,
    is_active: savedVendor.is_active !== false,
    notes: `Synced automatically from vendors.id=${savedVendor.id}`,
  }, { onConflict: 'transporter_code' })
  if (syncError) throw syncError
}

export async function deleteVendor(id: number) {
  await requireAuthenticatedUser()
  const { error } = await supabaseAdmin
    .from('vendors')
    .delete()
    .eq('id', id)
  if (error) throw error
}
