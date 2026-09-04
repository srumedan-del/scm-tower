'use server'

import { supabaseAdmin } from '@/lib/supabaseAdmin'

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
  const { id, ...payload } = vendor

  if (id) {
    const { error } = await supabaseAdmin
      .from('vendors')
      .update(payload)
      .eq('id', id)
    if (error) throw error
  } else {
    const { error } = await supabaseAdmin
      .from('vendors')
      .insert(payload)
    if (error) throw error
  }
}

export async function deleteVendor(id: number) {
  const { error } = await supabaseAdmin
    .from('vendors')
    .delete()
    .eq('id', id)
  if (error) throw error
}
