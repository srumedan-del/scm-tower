'use server'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireAuthenticatedUser } from '@/lib/requireUser'

/**
 * Stok gudang Medan per hari dari snapshot SIRUP 07.00 (tabel sirup_stock_row, migrasi v53).
 * Baris lengkap disimpan 30 hari di Supabase; tanggal yang lebih lama hanya ada di arsip CSV D:/sirup.
 */
export type StockRow = {
  no_item: string
  nama_item: string | null
  kategori: string | null
  bincode: string | null
  lot_no: string | null
  serial_no: string | null
  expiration_date: string | null
  qty: number
  /** Qty item+bin+LOT yang sama di snapshot sebelumnya; null bila tidak ada pembanding. */
  prev_qty: number | null
}

export async function getStockDates(): Promise<string[]> {
  await requireAuthenticatedUser()
  const { data, error } = await supabaseAdmin
    .from('sirup_stock_snapshot')
    .select('snapshot_date')
    .order('snapshot_date', { ascending: false })
    .limit(60)
  if (error) throw error
  return [...new Set((data ?? []).map(r => String(r.snapshot_date)))]
}

type RawRow = Omit<StockRow, 'prev_qty' | 'qty'> & { qty: number | string | null }

async function rowsOf(date: string): Promise<RawRow[]> {
  const { data, error } = await supabaseAdmin
    .from('sirup_stock_row')
    .select('no_item, nama_item, kategori, bincode, lot_no, serial_no, expiration_date, qty')
    .eq('snapshot_date', date)
    .limit(5000)
  if (error) throw error
  return (data ?? []) as RawRow[]
}

const keyOf = (r: { no_item: string; bincode: string | null; lot_no: string | null; serial_no: string | null }) =>
  [r.no_item, r.bincode ?? '', r.lot_no ?? '', r.serial_no ?? ''].join('|')

export async function getStockByDate(date: string): Promise<{ date: string; prevDate: string | null; rows: StockRow[] }> {
  await requireAuthenticatedUser()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Tanggal tidak valid')

  const { data: prev } = await supabaseAdmin
    .from('sirup_stock_snapshot')
    .select('snapshot_date')
    .lt('snapshot_date', date)
    .order('snapshot_date', { ascending: false })
    .limit(1)
  const prevDate = prev?.[0]?.snapshot_date ? String(prev[0].snapshot_date) : null

  const [current, before] = await Promise.all([rowsOf(date), prevDate ? rowsOf(prevDate) : Promise.resolve([])])
  // Pembanding hanya berlaku bila baris tanggal sebelumnya masih tersimpan (30 hari).
  const hasPrev = before.length > 0
  const prevQty = new Map<string, number>()
  for (const r of before) prevQty.set(keyOf(r), (prevQty.get(keyOf(r)) ?? 0) + Number(r.qty ?? 0))

  const rows: StockRow[] = current.map(r => ({
    ...r,
    qty: Number(r.qty ?? 0),
    prev_qty: hasPrev ? prevQty.get(keyOf(r)) ?? 0 : null,
  }))
  return { date, prevDate: hasPrev ? prevDate : null, rows }
}
