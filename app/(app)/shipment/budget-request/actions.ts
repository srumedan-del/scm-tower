'use server'

import { supabaseAdmin } from '@/lib/supabaseAdmin'

// ─── Types ────────────────────────────────────────────────────────────────────

export type BudgetRequestRow = {
  id: number
  period: string                         // "2026-09"
  lk_amount_projected: number | null
  dk_amount_projected: number | null
  total_projected: number | null         // GENERATED
  buffer_amount: number | null
  subtotal: number | null                // GENERATED
  rounded_request_amount: number | null
  bank_name: string | null
  bank_account_no: string | null
  bank_account_holder: string | null
  notes: string | null
  created_at: string | null
}

export type BudgetApprovalRow = {
  id: number
  budget_request_id: number
  approver_name: string
  sequence_no: number
  status: 'Pending' | 'Approved'
  approved_at: string | null
}

// Agregasi realisasi biaya dari shipment_tracking (Internal, bulan tertentu)
export type RealizationSummary = {
  period: string
  dk_total: number
  lk_total: number
  grand_total: number
  shipment_count: number
}

// ─── Realisasi otomatis dari shipment_tracking ────────────────────────────────

export async function getRealizationSummary(period: string): Promise<RealizationSummary> {
  // period: "2026-09" → filter document_date antara 2026-09-01 dan 2026-09-30
  const [year, month] = period.split('-').map(Number)
  const from = `${period}-01`
  const to   = new Date(year, month, 0).toISOString().slice(0, 10)  // last day of month

  const { data, error } = await supabaseAdmin
    .from('shipment_tracking')
    .select('dk_lk, total_biaya')
    .eq('cost_model', 'Internal')
    .gte('document_date', from)
    .lte('document_date', to)
    .not('total_biaya', 'is', null)

  if (error) throw error

  const rows = (data ?? []) as { dk_lk: string | null; total_biaya: number | null }[]
  const dk_total = rows.filter(r => r.dk_lk === 'DK').reduce((s, r) => s + (r.total_biaya ?? 0), 0)
  const lk_total = rows.filter(r => r.dk_lk === 'LK').reduce((s, r) => s + (r.total_biaya ?? 0), 0)

  return {
    period,
    dk_total,
    lk_total,
    grand_total: dk_total + lk_total,
    shipment_count: rows.length,
  }
}

// ─── Budget Request CRUD ──────────────────────────────────────────────────────

export async function getBudgetRequests(): Promise<BudgetRequestRow[]> {
  const { data, error } = await supabaseAdmin
    .from('budget_request')
    .select('*')
    .order('period', { ascending: false })
  if (error) throw error
  return (data ?? []) as BudgetRequestRow[]
}

export async function getBudgetRequestById(id: number): Promise<{
  request: BudgetRequestRow
  approvals: BudgetApprovalRow[]
  realization: RealizationSummary | null
} | null> {
  const [{ data: req }, { data: approvals }] = await Promise.all([
    supabaseAdmin.from('budget_request').select('*').eq('id', id).single(),
    supabaseAdmin.from('budget_approval_log').select('*').eq('budget_request_id', id).order('sequence_no'),
  ])
  if (!req) return null

  let realization: RealizationSummary | null = null
  try {
    realization = await getRealizationSummary(req.period)
  } catch { /* tabel belum ada */ }

  return {
    request: req as BudgetRequestRow,
    approvals: (approvals ?? []) as BudgetApprovalRow[],
    realization,
  }
}

export async function upsertBudgetRequest(
  row: Partial<BudgetRequestRow> & { period: string }
) {
  const { id, total_projected, subtotal, ...payload } = row as any  // GENERATED excluded

  if (id) {
    const { error } = await supabaseAdmin.from('budget_request').update(payload).eq('id', id)
    if (error) throw error
    return id as number
  } else {
    const { data, error } = await supabaseAdmin.from('budget_request').insert(payload).select('id').single()
    if (error) throw error
    return (data as any).id as number
  }
}

export async function deleteBudgetRequest(id: number) {
  const { error } = await supabaseAdmin.from('budget_request').delete().eq('id', id)
  if (error) throw error
}

// ─── Approval Log CRUD ────────────────────────────────────────────────────────

export async function upsertApproval(row: Partial<BudgetApprovalRow> & { budget_request_id: number; approver_name: string; sequence_no: number }) {
  const { id, ...payload } = row
  if (id) {
    const { error } = await supabaseAdmin.from('budget_approval_log').update(payload).eq('id', id)
    if (error) throw error
  } else {
    const { error } = await supabaseAdmin.from('budget_approval_log').insert(payload)
    if (error) throw error
  }
}

export async function updateApprovalStatus(id: number, status: 'Pending' | 'Approved') {
  const payload: any = { status }
  if (status === 'Approved') payload.approved_at = new Date().toISOString()
  const { error } = await supabaseAdmin.from('budget_approval_log').update(payload).eq('id', id)
  if (error) throw error
}

export async function deleteApproval(id: number) {
  const { error } = await supabaseAdmin.from('budget_approval_log').delete().eq('id', id)
  if (error) throw error
}
