/* — Batch RPC helpers (single SQL query replaces thousands of calls) — */
'use server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireAuthenticatedUser } from '@/lib/requireUser'

export async function rpcBulkInsertOutboundDetail(rows: Record<string, any>[]) {
  await requireAuthenticatedUser()
  // Call Supabase RPC (needs SQL function created in DB)
  const { data, error } = await supabaseAdmin.rpc('bulk_insert_outbound_detail', {
    rows: JSON.stringify(rows)
  })
  if (error) throw error
  return { inserted: data ?? 0 }
}

export async function rpcBulkUpdateDocumentLinks(rows: Record<string, any>[]) {
  await requireAuthenticatedUser()
  const { data, error } = await supabaseAdmin.rpc('bulk_update_outbound_detail_document_links', {
    rows: JSON.stringify(rows.map(r => ({ entry_no: r.entry_no, document_no: r.document_no, outbound_header_id: r.outbound_header_id })))
  })
  if (error) throw error
  return { updated: data ?? 0 }
}

export async function rpcBulkUpdateCreatedTimes(rows: Record<string, any>[]) {
  await requireAuthenticatedUser()
  const { data, error } = await supabaseAdmin.rpc('bulk_update_outbound_detail_created_times', {
    rows: JSON.stringify(rows.map(r => ({ entry_no: r.entry_no, document_created_at: r.document_created_at })))
  })
  if (error) throw error
  return { updated: data ?? 0 }
}
