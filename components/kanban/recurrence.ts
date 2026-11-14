/**
 * Deadline periode berikutnya untuk tugas berulang (Task Board).
 *   Harian   → hari kerja berikutnya (Sabtu dan Minggu bukan hari kerja)
 *   Mingguan → +7 hari
 *   Bulanan  → tanggal yang sama bulan berikutnya (31 → akhir bulan bila bulan itu lebih pendek)
 * Bila hasilnya sudah lewat (tugas diselesaikan terlambat), digeser per periode sampai >= hari ini.
 * Tanggal dalam format YYYY-MM-DD (WIB).
 */
export function nextOccurrenceDate(frequency: string, deadline: string, today: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline)) return null
  const dayOfMonth = Number(deadline.slice(8, 10))
  let date = deadline
  for (let guard = 0; guard < 400; guard++) {
    date = step(frequency, date, dayOfMonth)
    if (!date) return null
    if (date >= today) return date
  }
  return null
}

function step(frequency: string, iso: string, dayOfMonth: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  if (frequency === 'Harian') {
    do d.setUTCDate(d.getUTCDate() + 1)
    while (d.getUTCDay() === 0 || d.getUTCDay() === 6)
  } else if (frequency === 'Mingguan') {
    d.setUTCDate(d.getUTCDate() + 7)
  } else if (frequency === 'Bulanan') {
    const year = d.getUTCFullYear()
    const month = d.getUTCMonth() + 1
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
    return new Date(Date.UTC(year, month, Math.min(dayOfMonth, lastDay))).toISOString().slice(0, 10)
  } else {
    return ''
  }
  return d.toISOString().slice(0, 10)
}
