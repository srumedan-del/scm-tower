'use server'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireAuthenticatedUser } from '@/lib/requireUser'

const BUCKET = 'pod-documents'
const MAX_BYTES = 8 * 1024 * 1024

/** Link sementara (1 jam) untuk gambar resi yang tersimpan privat. */
export async function getResiImageUrl(trackingId: number) {
  await requireAuthenticatedUser()
  const { data, error } = await supabaseAdmin
    .from('shipment_tracking')
    .select('resi_image_path')
    .eq('id', trackingId)
    .maybeSingle()
  if (error) throw error
  const path = data?.resi_image_path as string | null | undefined
  if (!path) return null
  const { data: signed } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(path, 60 * 60)
  return signed?.signedUrl ?? null
}

/** Bagian nama file yang aman: huruf/angka, spasi jadi tanda hubung. */
function fileSafe(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
}

/** Simpan gambar resi (data URL base64 dari browser) untuk satu PSS; gambar lama diganti.
 *  Nama file: <VENDOR>_<NO-RESI>.jpg (nomor resi dari form bila belum disimpan). */
export async function uploadResiImage(trackingId: number, dataUrl: string, noResiInput?: string | null) {
  await requireAuthenticatedUser()
  const match = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/)
  if (!match) throw new Error('File harus berupa gambar JPG, PNG, atau WEBP')
  const bytes = Buffer.from(match[2], 'base64')
  if (!bytes.length || bytes.length > MAX_BYTES) throw new Error('Ukuran gambar maksimal 8 MB')

  const { data: current, error: readError } = await supabaseAdmin
    .from('shipment_tracking')
    .select('resi_image_path, no_resi, pss_no, transporter_id, notes')
    .eq('id', trackingId)
    .maybeSingle()
  if (readError) throw readError
  if (!current) throw new Error('Shipment tidak ditemukan')

  let vendor = current.notes?.match(/Vendor:\s*([^|]+)/i)?.[1]?.trim() ?? ''
  if (current.transporter_id != null) {
    const { data: transporter } = await supabaseAdmin.from('master_transporter').select('name').eq('id', current.transporter_id).maybeSingle()
    vendor = String(transporter?.name ?? '').trim() || vendor
  }
  const resi = String(noResiInput ?? '').trim() || String(current.no_resi ?? '').trim()
  const baseName = [fileSafe(vendor) || 'VENDOR', fileSafe(resi) || fileSafe(current.pss_no ?? '') || String(trackingId)].join('_')

  const extension = match[1] === 'image/png' ? 'png' : match[1] === 'image/webp' ? 'webp' : 'jpg'
  // Folder per PSS agar resi yang sama di dua PSS tidak saling menimpa.
  const path = `resi/${trackingId}/${baseName}.${extension}`
  const { error: uploadError } = await supabaseAdmin.storage.from(BUCKET).upload(path, bytes, { contentType: match[1], upsert: true })
  if (uploadError) throw uploadError

  const { error: updateError } = await supabaseAdmin.from('shipment_tracking').update({ resi_image_path: path }).eq('id', trackingId)
  if (updateError) {
    if (current.resi_image_path !== path) await supabaseAdmin.storage.from(BUCKET).remove([path])
    throw updateError
  }
  if (current.resi_image_path && current.resi_image_path !== path) await supabaseAdmin.storage.from(BUCKET).remove([current.resi_image_path])

  const { data: signed } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(path, 60 * 60)
  return signed?.signedUrl ?? null
}

export async function removeResiImage(trackingId: number) {
  await requireAuthenticatedUser()
  const { data, error } = await supabaseAdmin
    .from('shipment_tracking')
    .select('resi_image_path')
    .eq('id', trackingId)
    .maybeSingle()
  if (error) throw error
  const { error: updateError } = await supabaseAdmin.from('shipment_tracking').update({ resi_image_path: null }).eq('id', trackingId)
  if (updateError) throw updateError
  if (data?.resi_image_path) await supabaseAdmin.storage.from(BUCKET).remove([data.resi_image_path])
}

// ─── Rekap cetak per vendor per bulan ────────────────────────────────────────

export type ResiRecapRow = {
  id: number
  trip_id: string | null
  pss_no: string | null
  document_date: string | null
  dispatch_time: string | null
  customer_name: string | null
  destination_city: string | null
  no_resi: string | null
  amount: number | null
  status: string | null
  image_url: string | null
}

export type ResiRecap = { vendors: string[]; vendor: string | null; month: string; rows: ResiRecapRow[] }

function nextMonthFirstDay(month: string) {
  const [year, mon] = month.split('-').map(Number)
  const date = new Date(Date.UTC(year, mon, 1))
  return date.toISOString().slice(0, 10)
}

function isRetail(row: { cost_model?: string | null; no_resi?: string | null }, vendor: string) {
  if (row.cost_model === 'Retail' || row.no_resi?.trim()) return true
  const text = vendor.toUpperCase()
  return text.includes('INDAH LOGISTIK') || text.includes('JNE') || text.includes('RETAIL')
}

/** Kiriman retail satu bulan (document date), dikelompokkan per vendor; gambar resi dalam link sementara. */
export async function getResiRecap(month: string, vendor?: string | null): Promise<ResiRecap> {
  await requireAuthenticatedUser()
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error('Bulan tidak valid')

  const { data, error } = await supabaseAdmin
    .from('shipment_tracking')
    .select('id, trip_id, pss_no, document_date, dispatch_time, customer_name, destination_city, no_resi, total_biaya_eksternal, status, cost_model, transporter_id, notes, resi_image_path')
    .gte('document_date', `${month}-01`)
    .lt('document_date', nextMonthFirstDay(month))
    .neq('status', 'Failed Delivery')
    .order('document_date', { ascending: true })
    .order('pss_no', { ascending: true })
    .limit(2000)
  if (error) throw error

  const rows = data ?? []
  const transporterIds = [...new Set(rows.map(row => row.transporter_id).filter((id): id is number => id != null))]
  const names = new Map<number, string>()
  if (transporterIds.length) {
    const { data: transporters, error: transporterError } = await supabaseAdmin.from('master_transporter').select('id, name').in('id', transporterIds)
    if (transporterError) throw transporterError
    for (const transporter of transporters ?? []) names.set(Number(transporter.id), String(transporter.name ?? '').trim())
  }

  const withVendor = rows
    .map(row => ({
      row,
      vendor: (row.transporter_id != null ? names.get(Number(row.transporter_id)) : null)
        ?? row.notes?.match(/Vendor:\s*([^|]+)/i)?.[1]?.trim()
        ?? '',
    }))
    .filter(({ row, vendor: name }) => name && row.cost_model !== 'Internal' && isRetail(row, name))

  const vendors = [...new Set(withVendor.map(item => item.vendor))].sort((a, b) => a.localeCompare(b))
  const selected = vendor && vendors.includes(vendor) ? vendor : vendors[0] ?? null
  const picked = withVendor.filter(item => item.vendor === selected).map(item => item.row)

  const paths = picked.map(row => row.resi_image_path).filter((path): path is string => Boolean(path))
  const signed = new Map<string, string>()
  if (paths.length) {
    const { data: urls } = await supabaseAdmin.storage.from(BUCKET).createSignedUrls(paths, 60 * 60)
    for (const url of urls ?? []) if (url.path && url.signedUrl) signed.set(url.path, url.signedUrl)
  }

  return {
    vendors,
    vendor: selected,
    month,
    rows: picked.map(row => ({
      id: row.id,
      trip_id: row.trip_id,
      pss_no: row.pss_no,
      document_date: row.document_date,
      dispatch_time: row.dispatch_time,
      customer_name: row.customer_name,
      destination_city: row.destination_city,
      no_resi: row.no_resi,
      amount: row.total_biaya_eksternal == null ? null : Number(row.total_biaya_eksternal),
      status: row.status,
      image_url: row.resi_image_path ? signed.get(row.resi_image_path) ?? null : null,
    })),
  }
}
