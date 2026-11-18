/**
 * Kolom seperti outbound_header.document_created_at bertipe timestamp tanpa zona waktu dan berisi
 * jam dinding WIB dari NAV (mis. "2026-11-18T09:10:04"). Di server Vercel (UTC), new Date() pada teks
 * tanpa zona dianggap UTC sehingga tampil 7 jam lebih lambat (16:10). Helper ini membacanya sebagai WIB.
 */
const HAS_ZONE = /(Z|[+-]\d{2}:?\d{2})$/i

export function parseWib(value: string | null | undefined): Date | null {
  if (!value) return null
  const text = String(value).trim().replace(' ', 'T')
  const iso = HAS_ZONE.test(text) ? text : /^\d{4}-\d{2}-\d{2}$/.test(text) ? `${text}T00:00:00+07:00` : `${text}+07:00`
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? null : date
}
