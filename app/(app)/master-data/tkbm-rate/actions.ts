'use server'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireAuthenticatedUser } from '@/lib/requireUser'

export type TkbmRateType = 'per_koli' | 'per_bulan'

export type TkbmRateRow = {
  id: number
  customer_code: string | null
  customer_name: string
  rate_type: TkbmRateType
  amount: number
  effective_from: string
  is_active: boolean
  notes: string | null
}

export type TkbmCustomerOption = { customer_code: string; customer_name: string }

export async function getTkbmRates() {
  await requireAuthenticatedUser()
  const { data, error } = await supabaseAdmin
    .from('master_tkbm_rate')
    .select('id, customer_code, customer_name, rate_type, amount, effective_from, is_active, notes')
    .order('customer_name')
    .order('effective_from', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(row => ({ ...row, amount: Number(row.amount) })) as TkbmRateRow[]
}

export async function getTkbmCustomerOptions() {
  await requireAuthenticatedUser()
  const { data, error } = await supabaseAdmin
    .from('customers')
    .select('customer_code, customer_name')
    .order('customer_name')
    .limit(1000)
  if (error) throw new Error(error.message)
  return (data ?? []).filter(row => row.customer_code) as TkbmCustomerOption[]
}

export async function upsertTkbmRate(input: Omit<TkbmRateRow, 'id'> & { id?: number }) {
  await requireAuthenticatedUser()
  const { id, ...rest } = input
  const payload = {
    customer_code: rest.customer_code?.trim().toUpperCase() || null,
    customer_name: rest.customer_name.trim().toUpperCase(),
    rate_type: rest.rate_type,
    amount: rest.amount,
    effective_from: rest.effective_from,
    is_active: rest.is_active,
    notes: rest.notes?.trim() || null,
    updated_at: new Date().toISOString(),
  }
  if (!payload.customer_name) throw new Error('Nama customer wajib diisi')
  if (payload.rate_type !== 'per_koli' && payload.rate_type !== 'per_bulan') throw new Error('Jenis tarif tidak valid')
  if (!Number.isFinite(payload.amount) || payload.amount < 0) throw new Error('Tarif harus angka 0 atau lebih')
  if (!payload.effective_from) throw new Error('Tanggal berlaku wajib diisi')

  const { error } = id
    ? await supabaseAdmin.from('master_tkbm_rate').update(payload).eq('id', id)
    : await supabaseAdmin.from('master_tkbm_rate').insert(payload)
  if (error) {
    if (error.code === '23505') throw new Error('Customer ini sudah punya tarif dengan tanggal berlaku yang sama')
    throw new Error(error.message)
  }
}

export async function deleteTkbmRate(id: number) {
  await requireAuthenticatedUser()
  const { error } = await supabaseAdmin.from('master_tkbm_rate').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
