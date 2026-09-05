'use server'

import { supabaseAdmin } from '@/lib/supabaseAdmin'

export type TransporterRow = {
  id: number
  transporter_code: string
  name: string
  type: 'Internal' | 'Eksternal'
  service_model: 'Retail' | 'Trucking' | null
  pic_name: string | null
  pic_phone: string | null
  pic_email: string | null
  is_active: boolean
  notes: string | null
}

export async function getTransporters() {
  const { data, error } = await supabaseAdmin
    .from('master_transporter')
    .select('*')
    .order('type')
    .order('name')
  if (error) throw error
  return (data ?? []) as TransporterRow[]
}

export async function upsertTransporter(t: Partial<TransporterRow> & { id?: number }) {
  const { id, ...payload } = t
  if (id) {
    const { error } = await supabaseAdmin.from('master_transporter').update(payload).eq('id', id)
    if (error) throw error
  } else {
    const { error } = await supabaseAdmin.from('master_transporter').insert(payload)
    if (error) throw error
  }
}

export async function deleteTransporter(id: number) {
  const { error } = await supabaseAdmin.from('master_transporter').delete().eq('id', id)
  if (error) throw error
}
