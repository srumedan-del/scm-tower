'use server'

import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function getExistingReceivingHeaderPtrs(ptrs: string[]) {
  if (!ptrs.length) return { data: [], error: null }

  const { data, error } = await supabaseAdmin
    .from('receiving_header')
    .select('ptr_no')
    .in('ptr_no', ptrs)

  return { data: data ?? [], error }
}

export async function insertReceivingHeaderRows(rows: Record<string, any>[]) {
  if (!rows.length) return { inserted: 0 }

  const { data, error } = await supabaseAdmin
    .from('receiving_header')
    .insert(rows)
    .select()

  if (error) {
    throw error
  }

  return { inserted: data?.length ?? 0 }
}

/* ── PTR Detail helpers ─────────────────────────────────── */

export async function getReceivingHeadersByPtrs(ptrs: string[]) {
  if (!ptrs.length) return { data: [], error: null }

  const { data, error } = await supabaseAdmin
    .from('receiving_header')
    .select('id, ptr_no')
    .in('ptr_no', ptrs)

  return { data: data ?? [], error }
}

export async function insertReceivingDetailRows(rows: Record<string, any>[]) {
  if (!rows.length) return { inserted: 0 }

  const { data, error } = await supabaseAdmin
    .from('receiving_detail')
    .insert(rows)
    .select()

  if (error) {
    throw error
  }

  return { inserted: data?.length ?? 0 }
}
