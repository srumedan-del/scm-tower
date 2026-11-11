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
  /** Tarif trucking sudah termasuk TKBM (all-in). */
  tkbm_included?: boolean | null
  multidrop_fee_in_city?: number | null
  multidrop_fee_out_city?: number | null
  created_at?: string | null
}

export async function getVendors() {
  await requireAuthenticatedUser()
  const { data, error } = await supabaseAdmin
    .from('vendors')
    .select('*')
    .order('vendor_name')
    .limit(200)
  if (error) throw error
  return data ?? []
}

const VENDOR_CODE_PREFIX = 'VND-'
const SAVED_VENDOR_COLUMNS = 'id, vendor_code, vendor_name, vendor_type, pic_name, phone, email, is_active'

// Kode VOTH berasal dari luar sistem, jadi nomor buatan sistem memakai prefix sendiri.
async function nextVendorCode() {
  const { data, error } = await supabaseAdmin
    .from('vendors')
    .select('vendor_code')
    .like('vendor_code', `${VENDOR_CODE_PREFIX}%`)
  if (error) throw error
  const maxNum = (data ?? []).reduce((max, row) => {
    const n = parseInt(String(row.vendor_code).slice(VENDOR_CODE_PREFIX.length), 10)
    return Number.isNaN(n) ? max : Math.max(max, n)
  }, 0)
  return `${VENDOR_CODE_PREFIX}${String(maxNum + 1).padStart(4, '0')}`
}

async function insertVendorWithCode(payload: Omit<VendorRow, 'id' | 'vendor_code' | 'created_at'>) {
  for (let attempt = 0; ; attempt++) {
    const vendor_code = await nextVendorCode()
    const { data, error } = await supabaseAdmin
      .from('vendors')
      .insert({ ...payload, vendor_code })
      .select(SAVED_VENDOR_COLUMNS)
      .single()
    if (!error) return data
    // Dua admin menyimpan bersamaan: ambil nomor berikutnya.
    if (error.code !== '23505' || attempt >= 2) throw error
  }
}

export async function upsertVendor(vendor: Omit<VendorRow, 'vendor_code' | 'created_at'>) {
  await requireAuthenticatedUser()
  const { id, ...payload } = vendor

  let savedVendor: Pick<VendorRow, 'id' | 'vendor_code' | 'vendor_name' | 'vendor_type' | 'pic_name' | 'phone' | 'email' | 'is_active'>
  if (id) {
    const { data, error } = await supabaseAdmin
      .from('vendors')
      .update(payload)
      .eq('id', id)
      .select(SAVED_VENDOR_COLUMNS)
      .single()
    if (error) throw error
    savedVendor = data
  } else {
    savedVendor = await insertVendorWithCode(payload)
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

  return { vendor_code: savedVendor.vendor_code }
}

export async function deleteVendor(id: number) {
  await requireAuthenticatedUser()
  const { error } = await supabaseAdmin
    .from('vendors')
    .delete()
    .eq('id', id)
  if (error) throw error
}
