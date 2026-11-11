/**
 * SLA pengiriman Sinar Roda: DK 1 hari kerja dan LK 5 hari kerja dari tanggal
 * dokumen. Sabtu dan Minggu bukan hari kerja. Shipment tanpa DK/LK dihitung LK.
 */

type IsoDate = string

function toUtcDate(date: IsoDate) {
  return new Date(`${date.slice(0, 10)}T00:00:00Z`)
}

function toIsoDate(date: Date): IsoDate {
  return date.toISOString().slice(0, 10)
}

function isWorkingDay(date: Date) {
  const day = date.getUTCDay()
  return day !== 0 && day !== 6
}

function addDay(date: Date) {
  return new Date(date.getTime() + 86_400_000)
}

/** Jumlah hari kerja setelah `from` sampai dengan `to`. */
function workingDaysBetween(from: IsoDate, to: IsoDate) {
  let count = 0
  const end = toUtcDate(to)
  for (let date = addDay(toUtcDate(from)); date <= end; date = addDay(date)) {
    if (isWorkingDay(date)) count++
  }
  return count
}

/** Hari kerja yang sudah lewat sejak tanggal dokumen (tanggal dokumen sendiri tidak dihitung). */
export function workingDaysSince(from: IsoDate, today: IsoDate) {
  return today <= from.slice(0, 10) ? 0 : workingDaysBetween(from, today)
}

/** PTS yang belum diputuskan (Crossdocking atau Realokasi) lebih dari ini masuk pengingat. */
export const PTS_PENDING_REMINDER_DAYS = 2

export function jakartaToday(now = new Date()): IsoDate {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(now)
}

export function slaDueDate(documentDate: IsoDate, dkLk: string | null | undefined): IsoDate {
  let remaining = dkLk === 'DK' ? 1 : 5
  let date = toUtcDate(documentDate)
  while (remaining > 0) {
    date = addDay(date)
    if (isWorkingDay(date)) remaining--
  }
  return toIsoDate(date)
}

/** Batas SLA adalah akhir hari kerja terakhir, waktu Jakarta. */
export function slaDueAt(documentDate: IsoDate, dkLk: string | null | undefined) {
  return new Date(`${slaDueDate(documentDate, dkLk)}T23:59:59+07:00`)
}

/** Sisa hari kerja: positif masih ada waktu, 0 jatuh tempo hari ini, negatif terlambat. */
export function slaWorkingDaysLeft(documentDate: IsoDate, dkLk: string | null | undefined, today: IsoDate) {
  const due = slaDueDate(documentDate, dkLk)
  if (today <= due) return workingDaysBetween(today, due)
  return -Math.max(1, workingDaysBetween(due, today))
}
