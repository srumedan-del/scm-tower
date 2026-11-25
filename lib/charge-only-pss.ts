import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * PSS yang bukan tugas pengiriman, jadi tidak ditampilkan di Outbound dan tidak bisa dibuatkan shipment/Trip:
 * - PSS ongkos kirim: semua barisnya item biaya non-stok (kode BIA-..., mis. BIA-NHD-133), tanpa barang fisik.
 * - PSS batal: setiap item dikirim lalu dibatalkan di NAV (Undo Shipment, baris + dan − sama besar),
 *   sehingga qty bersih per item 0. Contoh PSS-2611-2790.
 * Aturan owner (Nov 2026): berlaku untuk setiap PSS dengan pola yang sama.
 */
export const CHARGE_ITEM_PATTERN = /^BIA-/i

export async function getChargeOnlyPss(db: SupabaseClient<any>, pssNos: string[]): Promise<Set<string>> {
  const unique = [...new Set(pssNos.map((no) => no.trim()).filter(Boolean))]
  const linesByPss = new Map<string, { item: string; qty: number }[]>()
  // Per 100 nomor: daftar yang lebih panjang membuat alamat permintaan terlalu panjang dan gagal.
  for (let i = 0; i < unique.length; i += 100) {
    const { data, error } = await db.from('outbound_detail').select('document_no, item_no, quantity').in('document_no', unique.slice(i, i + 100)).limit(5000)
    // Gagal cek: PSS tetap ditampilkan seperti biasa (lebih aman daripada menyembunyikan tugas kirim).
    if (error) { console.error('[getChargeOnlyPss]', error.message); continue }
    for (const row of data ?? []) {
      const key = String(row.document_no ?? '').trim()
      if (!linesByPss.has(key)) linesByPss.set(key, [])
      linesByPss.get(key)!.push({ item: String(row.item_no ?? '').trim(), qty: Number(row.quantity ?? 0) })
    }
  }
  const result = new Set<string>()
  for (const [pss, lines] of linesByPss) {
    if (!lines.length) continue
    if (lines.every((line) => CHARGE_ITEM_PATTERN.test(line.item))) { result.add(pss); continue }
    const netByItem = new Map<string, number>()
    for (const line of lines) netByItem.set(line.item, (netByItem.get(line.item) ?? 0) + line.qty)
    const hasMovement = lines.some((line) => line.qty !== 0)
    if (hasMovement && [...netByItem.values()].every((net) => Math.abs(net) < 1e-9)) result.add(pss)
  }
  return result
}
