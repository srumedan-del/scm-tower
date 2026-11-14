'use server'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireAuthenticatedUser } from '@/lib/requireUser'
import { extractOpnameLines, LINE_STATUSES, OPNAME_PERIODS, SESSION_STATUSES, type OpnamePeriod } from '@/lib/stock-opname'

export type OpnameSession = {
  id: number
  opname_date: string
  source: 'sirup' | 'upload'
  source_note: string | null
  period?: OpnamePeriod
  pic: string | null
  status: typeof SESSION_STATUSES[number]
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  line_count?: number
  counted_count?: number
  diff_count?: number
}

export type OpnameLine = {
  id: number
  session_id: number
  sort_order: number
  bincode: string | null
  kategori: string | null
  no_item: string | null
  nama_item: string | null
  serial_no: string | null
  lot_no: string | null
  expiration_date: string | null
  qty_system: number
  qty_physical: number | null
  penyebab: string | null
  action_plan: string | null
  line_status: typeof LINE_STATUSES[number] | null
}

export type OpnameSigner = { name: string; title: string }
export type OpnameSettings = { signers: OpnameSigner[]; default_pic: string | null }

const MIGRATION_HINT = 'Jalankan dulu supabase/migration_v50_stock_opname.sql di Supabase.'
const PERIOD_HINT = 'Jalankan dulu supabase/migration_v51_stock_opname_period.sql di Supabase.'

function explain(error: { message: string }) {
  if (/period/.test(error.message) && /does not exist|schema cache|column/.test(error.message)) return PERIOD_HINT
  return /stock_opname/.test(error.message) && /does not exist|schema cache/.test(error.message) ? MIGRATION_HINT : error.message
}

function checkPeriod(period: string): OpnamePeriod {
  if (!OPNAME_PERIODS.includes(period as OpnamePeriod)) throw new Error('Periode opname tidak valid')
  return period as OpnamePeriod
}

async function userLabel() {
  const user = await requireAuthenticatedUser()
  return String(user.user_metadata?.full_name || user.user_metadata?.name || user.email || 'unknown')
}

export async function listOpnameSessions(period: OpnamePeriod): Promise<OpnameSession[]> {
  await requireAuthenticatedUser()
  const { data, error } = await supabaseAdmin.from('stock_opname_session').select('*').eq('period', checkPeriod(period)).order('opname_date', { ascending: false }).order('id', { ascending: false }).limit(100)
  if (error) throw new Error(explain(error))
  const sessions = (data ?? []) as OpnameSession[]
  if (!sessions.length) return sessions
  const { data: lines } = await supabaseAdmin.from('stock_opname_line').select('session_id, qty_system, qty_physical').in('session_id', sessions.map(s => s.id))
  return sessions.map(session => {
    const own = (lines ?? []).filter(line => Number(line.session_id) === session.id)
    const counted = own.filter(line => line.qty_physical != null)
    return {
      ...session,
      line_count: own.length,
      counted_count: counted.length,
      diff_count: counted.filter(line => Number(line.qty_physical) !== Number(line.qty_system)).length,
    }
  })
}

export async function getOpnameSession(id: number): Promise<{ session: OpnameSession; lines: OpnameLine[] }> {
  await requireAuthenticatedUser()
  const [{ data: session, error }, { data: lines, error: linesError }] = await Promise.all([
    supabaseAdmin.from('stock_opname_session').select('*').eq('id', id).maybeSingle(),
    supabaseAdmin.from('stock_opname_line').select('*').eq('session_id', id).order('sort_order'),
  ])
  if (error) throw new Error(explain(error))
  if (linesError) throw new Error(explain(linesError))
  if (!session) throw new Error('Sesi opname tidak ditemukan')
  return {
    session: session as OpnameSession,
    lines: (lines ?? []).map(line => ({ ...line, qty_system: Number(line.qty_system), qty_physical: line.qty_physical == null ? null : Number(line.qty_physical) })) as OpnameLine[],
  }
}

/** Buat sesi dari baris tabel SIRUP (file Export to Excel atau pengambilan otomatis). */
export async function createOpnameFromRows(input: { rows: unknown[][]; period: OpnamePeriod; opname_date: string; pic: string | null; source: 'sirup' | 'upload'; source_note?: string | null }) {
  const createdBy = await userLabel()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.opname_date)) throw new Error('Tanggal opname tidak valid')
  const { lines, totalRows } = extractOpnameLines(input.rows)
  if (!lines.length) throw new Error(`Tidak ada baris Hollow Fiber/Dialyzer atau Blood Tubing Set di bincode MDN-PAR-CON (dari ${totalRows} baris file).`)
  const { data: session, error } = await supabaseAdmin
    .from('stock_opname_session')
    .insert({ period: checkPeriod(input.period), opname_date: input.opname_date, pic: input.pic?.trim() || null, source: input.source, source_note: input.source_note ?? null, created_by: createdBy })
    .select('id')
    .single()
  if (error) throw new Error(explain(error))
  const { error: lineError } = await supabaseAdmin
    .from('stock_opname_line')
    .insert(lines.map((line, index) => ({ ...line, session_id: session.id, sort_order: index + 1 })))
  if (lineError) {
    await supabaseAdmin.from('stock_opname_session').delete().eq('id', session.id)
    throw new Error(explain(lineError))
  }
  return { id: Number(session.id), lineCount: lines.length, totalRows }
}

export type OpnameLineUpdate = Pick<OpnameLine, 'id' | 'qty_physical' | 'penyebab' | 'action_plan' | 'line_status'>

export async function saveOpnameLines(sessionId: number, updates: OpnameLineUpdate[]) {
  await requireAuthenticatedUser()
  const now = new Date().toISOString()
  for (const update of updates) {
    if (update.line_status && !LINE_STATUSES.includes(update.line_status)) throw new Error('Status baris tidak valid')
    const qty = update.qty_physical == null || Number.isNaN(Number(update.qty_physical)) ? null : Number(update.qty_physical)
    const { error } = await supabaseAdmin
      .from('stock_opname_line')
      .update({
        qty_physical: qty,
        penyebab: update.penyebab?.trim() || null,
        action_plan: update.action_plan?.trim() || null,
        line_status: update.line_status || null,
        updated_at: now,
      })
      .eq('id', update.id)
      .eq('session_id', sessionId)
    if (error) throw new Error(explain(error))
  }
  await supabaseAdmin.from('stock_opname_session').update({ updated_at: now }).eq('id', sessionId)
}

export async function updateOpnameSession(id: number, patch: { status?: OpnameSession['status']; pic?: string | null; opname_date?: string; notes?: string | null }) {
  await requireAuthenticatedUser()
  if (patch.status && !SESSION_STATUSES.includes(patch.status)) throw new Error('Status sesi tidak valid')
  if (patch.opname_date && !/^\d{4}-\d{2}-\d{2}$/.test(patch.opname_date)) throw new Error('Tanggal opname tidak valid')
  const { error } = await supabaseAdmin.from('stock_opname_session').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) throw new Error(explain(error))
}

export async function deleteOpnameSession(id: number) {
  await requireAuthenticatedUser()
  const { error } = await supabaseAdmin.from('stock_opname_session').delete().eq('id', id)
  if (error) throw new Error(explain(error))
}

export async function getOpnameSettings(): Promise<OpnameSettings> {
  await requireAuthenticatedUser()
  const { data, error } = await supabaseAdmin.from('stock_opname_settings').select('signers, default_pic').eq('id', 1).maybeSingle()
  if (error) throw new Error(explain(error))
  return { signers: (data?.signers as OpnameSigner[] | undefined) ?? [], default_pic: data?.default_pic ?? null }
}

export async function saveOpnameSettings(settings: OpnameSettings) {
  await requireAuthenticatedUser()
  const signers = settings.signers.map(s => ({ name: s.name.trim().toUpperCase(), title: s.title.trim().toUpperCase() })).filter(s => s.name).slice(0, 5)
  const { error } = await supabaseAdmin.from('stock_opname_settings').upsert({ id: 1, signers, default_pic: settings.default_pic?.trim() || null, updated_at: new Date().toISOString() })
  if (error) throw new Error(explain(error))
}

