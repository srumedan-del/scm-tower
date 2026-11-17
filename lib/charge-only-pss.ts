import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * PSS ongkos kirim: semua barisnya item biaya non-stok (kode BIA-..., mis. BIA-NHD-133), tanpa barang fisik.
 * Bukan tugas pengiriman, jadi tidak ditampilkan di Outbound dan tidak bisa dibuatkan shipment.
 * Aturan owner (Nov 2026): berlaku untuk setiap PSS dengan pola yang sama.
 */
export const CHARGE_ITEM_PATTERN = /^BIA-/i

export async function getChargeOnlyPss(db: SupabaseClient<any>, pssNos: string[]): Promise<Set<string>> {
  const unique = [...new Set(pssNos.map((no) => no.trim()).filter(Boolean))]
  const itemsByPss = new Map<string, string[]>()
  // Per 100 nomor: daftar yang lebih panjang membuat alamat permintaan terlalu panjang dan gagal.
  for (let i = 0; i < unique.length; i += 100) {
    const { data, error } = await db.from('outbound_detail').select('document_no, item_no').in('document_no', unique.slice(i, i + 100)).limit(5000)
    // Gagal cek: PSS tetap ditampilkan seperti biasa (lebih aman daripada menyembunyikan tugas kirim).
    if (error) { console.error('[getChargeOnlyPss]', error.message); continue }
    for (const row of data ?? []) {
      const key = String(row.document_no ?? '').trim()
      if (!itemsByPss.has(key)) itemsByPss.set(key, [])
      itemsByPss.get(key)!.push(String(row.item_no ?? ''))
    }
  }
  const result = new Set<string>()
  for (const [pss, items] of itemsByPss) {
    if (items.length && items.every((item) => CHARGE_ITEM_PATTERN.test(item.trim()))) result.add(pss)
  }
  return result
}
