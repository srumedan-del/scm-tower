'use server'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireAuthenticatedUser } from '@/lib/requireUser'
import { jakartaToday } from '@/lib/sla'

const blank = (value: unknown) => value == null || String(value).trim() === ''
const likeExact = (value: unknown) => String(value ?? '').trim().replace(/[\\%_]/g, char => `\\${char}`)

export type ReceiptConfirmation = {
  tracking_id: number
  pss_no: string | null
  customer_name: string | null
  destination_city: string | null
  no_resi: string | null
  status: string | null
  customer_id: number | null
  pic_name: string | null
  pic_phone: string | null
  received_date: string | null
  confirmed_with: string | null
  note: string | null
  confirmed_by: string | null
  confirmed_at: string | null
}

async function findCustomer(code: string | null, name: string | null) {
  if (!blank(code)) {
    const { data } = await supabaseAdmin.from('customers').select('id, pic_name, pic_phone').eq('customer_code', String(code).trim()).limit(1)
    if (data?.[0]) return data[0]
  }
  if (blank(name)) return null
  const { data } = await supabaseAdmin.from('customers').select('id, pic_name, pic_phone').ilike('customer_name', likeExact(name)).limit(1)
  return data?.[0] ?? null
}

/** Data modal konfirmasi penerimaan: shipment + kontak PIC dari Master Customer. */
export async function getReceiptConfirmation(trackingId: number): Promise<ReceiptConfirmation> {
  await requireAuthenticatedUser()
  const { data: row, error } = await supabaseAdmin
    .from('shipment_tracking')
    .select('id, pss_no, customer_code, customer_name, destination_city, no_resi, status, receipt_received_date, receipt_confirmed_with, receipt_confirm_note, receipt_confirmed_by, receipt_confirmed_at')
    .eq('id', trackingId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!row) throw new Error('Shipment tidak ditemukan.')
  const customer = await findCustomer(row.customer_code, row.customer_name)
  return {
    tracking_id: row.id,
    pss_no: row.pss_no,
    customer_name: row.customer_name,
    destination_city: row.destination_city,
    no_resi: row.no_resi,
    status: row.status,
    customer_id: customer?.id ?? null,
    pic_name: customer?.pic_name ?? null,
    pic_phone: customer?.pic_phone ?? null,
    received_date: row.receipt_received_date,
    confirmed_with: row.receipt_confirmed_with,
    note: row.receipt_confirm_note,
    confirmed_by: row.receipt_confirmed_by,
    confirmed_at: row.receipt_confirmed_at,
  }
}

function cleanPhone(value: string) {
  const phone = value.trim().replace(/\s+/g, ' ')
  const digits = phone.replace(/\D/g, '')
  if (!/^[+\d][\d\s\-().]*$/.test(phone) || digits.length < 8 || digits.length > 15) throw new Error('Nomor telepon tidak valid (8–15 angka).')
  return phone
}

export async function saveReceiptConfirmation(input: {
  tracking_id: number
  received_date: string
  confirmed_with: string
  note: string
  pic_name: string
  pic_phone: string
  /** Simpan PIC & telepon ke Master Customer. */
  save_pic: boolean
}) {
  const user = await requireAuthenticatedUser()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.received_date)) throw new Error('Tanggal diterima wajib diisi.')
  if (input.received_date > jakartaToday()) throw new Error('Tanggal diterima tidak boleh setelah hari ini.')
  const confirmedWith = input.confirmed_with.trim()
  if (confirmedWith.length < 2) throw new Error('Isi nama orang yang mengonfirmasi di pelanggan.')
  if (confirmedWith.length > 80 || input.note.length > 500) throw new Error('Isian terlalu panjang.')

  const { data: row, error } = await supabaseAdmin.from('shipment_tracking').select('id, customer_code, customer_name').eq('id', input.tracking_id).maybeSingle()
  if (error) throw new Error(error.message)
  if (!row) throw new Error('Shipment tidak ditemukan.')

  if (input.save_pic) {
    const customer = await findCustomer(row.customer_code, row.customer_name)
    if (!customer) throw new Error('Customer tidak ada di Master Customer, kontak PIC tidak bisa disimpan.')
    const picName = input.pic_name.trim().slice(0, 80) || null
    const picPhone = input.pic_phone.trim() ? cleanPhone(input.pic_phone) : null
    const { error: customerError } = await supabaseAdmin.from('customers').update({ pic_name: picName, pic_phone: picPhone }).eq('id', customer.id)
    if (customerError) throw new Error(customerError.message)
  }

  const { error: updateError } = await supabaseAdmin.from('shipment_tracking').update({
    receipt_received_date: input.received_date,
    receipt_confirmed_with: confirmedWith,
    receipt_confirm_note: input.note.trim() || null,
    receipt_confirmed_by: user.email ?? null,
    receipt_confirmed_at: new Date().toISOString(),
  }).eq('id', row.id)
  if (updateError) throw new Error(updateError.message)
}

export async function clearReceiptConfirmation(trackingId: number) {
  await requireAuthenticatedUser()
  const { error } = await supabaseAdmin.from('shipment_tracking').update({
    receipt_received_date: null, receipt_confirmed_with: null, receipt_confirm_note: null, receipt_confirmed_by: null, receipt_confirmed_at: null,
  }).eq('id', trackingId)
  if (error) throw new Error(error.message)
}
