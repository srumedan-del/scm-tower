import { supabaseAdmin } from '@/lib/supabaseAdmin'

/**
 * Helper untuk menentukan klasifikasi pengiriman Dalam Kota (DK) vs Luar Kota (LK)
 * berdasarkan wilayah operasional Distribution Center / Hub SCM Medan.
 *
 * DK: Medan, Binjai, Deli Serdang, Lubuk Pakam.
 * LK: Seluruh kota/kabupaten di luar area di atas (Pematang Siantar, Kisaran, Banda Aceh, dll).
 */
export function inferDkLk(city?: string | null): 'DK' | 'LK' | null {
  if (!city || !city.trim()) return null
  const c = city.trim().toUpperCase()
  if (
    c.includes('MEDAN') ||
    c.includes('BINJAI') ||
    c.includes('DELI SERDANG') ||
    c.includes('DELISERDANG') ||
    c.includes('LUBUK PAKAM') ||
    c.includes('LUBUKPAKAM')
  ) {
    return 'DK'
  }
  return 'LK'
}

/**
 * Memastikan customer terdaftar di tabel master `customers`.
 * Jika customer baru belum ada, sistem otomatis mendaftarkannya dengan
 * penetapan DK/LK cerdas berdasarkan kota tujuan.
 */
export async function ensureCustomerMaster(customerName?: string | null, city?: string | null) {
  if (!customerName || !customerName.trim()) return
  const trimmed = customerName.trim()
  try {
    const { data: existing } = await supabaseAdmin
      .from('customers')
      .select('id, dk_lk, city')
      .ilike('customer_name', trimmed)
      .limit(1)
      .maybeSingle()

    const calculatedDkLk = inferDkLk(city) ?? 'DK'
    const targetCity = (city && city.trim()) ? city.trim().toUpperCase() : 'MEDAN'

    if (!existing) {
      await supabaseAdmin
        .from('customers')
        .insert({
          customer_name: trimmed,
          city: targetCity,
          dk_lk: calculatedDkLk,
          is_active: true,
        })
    } else if (!existing.dk_lk) {
      await supabaseAdmin
        .from('customers')
        .update({ dk_lk: calculatedDkLk })
        .eq('id', existing.id)
    }
  } catch (err) {
    console.warn('ensureCustomerMaster warning:', err)
  }
}
