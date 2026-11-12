'use server'

import { getUntrackedPss } from './shipment/actions'
import { getPendingPts } from './crossdocking/actions'
import { jakartaToday, workingDaysSince, PTS_PENDING_REMINDER_DAYS } from '@/lib/sla'

const DATA_START = '2026-11-01'

export type NavBadges = Partial<Record<string, number>>

/** Jumlah pekerjaan tertunda per menu sidebar. Kesalahan satu sumber tidak menggagalkan yang lain. */
export async function getNavBadges(): Promise<NavBadges> {
  const today = jakartaToday()
  const [untracked, pendingPts] = await Promise.all([
    getUntrackedPss(today.slice(0, 7)).catch(() => []),
    getPendingPts(DATA_START).catch(() => []),
  ])
  return {
    '/shipment': untracked.length,
    '/crossdocking': pendingPts.filter(row => workingDaysSince(row.document_date, today) > PTS_PENDING_REMINDER_DAYS).length,
  }
}
