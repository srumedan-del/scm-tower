/**
 * Helper untuk menentukan klasifikasi pengiriman Dalam Kota (DK) vs Luar Kota (LK)
 * berdasarkan wilayah operasional Distribution Center / Hub SCM Medan.
 *
 * DK: Medan, Binjai, Deli Serdang, Lubuk Pakam, Serdang Bedagai (keputusan owner, 18 Nov 2026).
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
    c.includes('LUBUKPAKAM') ||
    c.includes('SERDANG BEDAGAI') ||
    c.includes('SERGAI')
  ) {
    return 'DK'
  }
  return 'LK'
}
