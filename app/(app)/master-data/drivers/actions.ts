'use server'

import { supabaseAdmin } from '@/lib/supabaseAdmin'

export type DriverRow = {
  id: number
  driver_code: string
  driver_name: string
  role: 'Driver' | 'Helper'
  sim_no: string | null
  phone: string | null
  is_active: boolean
  notes: string | null
}

export async function getDrivers() {
  const { data, error } = await supabaseAdmin
    .from('master_driver')
    .select('*')
    .order('driver_name')
  if (error) throw error
  return (data ?? []) as DriverRow[]
}

export async function upsertDriver(driver: Partial<DriverRow> & { id?: number }) {
  const { id, ...payload } = driver
  if (id) {
    const { error } = await supabaseAdmin.from('master_driver').update(payload).eq('id', id)
    if (error) throw error
  } else {
    const { error } = await supabaseAdmin.from('master_driver').insert(payload)
    if (error) throw error
  }
}

export async function deleteDriver(id: number) {
  const { error } = await supabaseAdmin.from('master_driver').delete().eq('id', id)
  if (error) throw error
}
