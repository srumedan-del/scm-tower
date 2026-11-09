'use server'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { hashPin, isDefaultPin, isValidNewPin } from '@/lib/driverAuth'
import { requireAuthenticatedUser } from '@/lib/requireUser'

export type DriverRow = {
  id: number
  driver_code: string
  driver_name: string
  role: 'Driver' | 'Helper'
  sim_no: string | null
  phone: string | null
  is_active: boolean
  notes: string | null
  username?: string | null
  /** Hanya dikirim saat admin mengganti PIN; nilai tersimpan tidak pernah dikembalikan ke browser. */
  pin?: string | null
  pin_is_default?: boolean
}

export async function getDrivers() {
  await requireAuthenticatedUser()
  const { data, error } = await supabaseAdmin
    .from('master_driver')
    .select('*')
    .order('driver_name')
  if (error) throw error
  return (data ?? []).map(({ pin, ...driver }) => ({
    ...driver,
    pin: null,
    pin_is_default: isDefaultPin(pin),
  })) as DriverRow[]
}

export async function getNextDriverCode(role: 'Driver' | 'Helper'): Promise<string> {
  await requireAuthenticatedUser()
  const prefix = role === 'Driver' ? 'DRV-' : 'HLP-'
  const { data, error } = await supabaseAdmin
    .from('master_driver')
    .select('driver_code')
    .ilike('driver_code', `${prefix}%`)

  if (error) {
    console.error('Error fetching driver codes:', error)
    return `${prefix}001`
  }

  let maxNum = 0
  for (const row of data ?? []) {
    const code = String(row.driver_code ?? '').trim().toUpperCase()
    if (code.startsWith(prefix)) {
      const numPart = code.slice(prefix.length).replace(/[^0-9]/g, '')
      const n = parseInt(numPart, 10)
      if (!isNaN(n) && n > maxNum) {
        maxNum = n
      }
    }
  }

  const nextNum = maxNum + 1
  return `${prefix}${String(nextNum).padStart(3, '0')}`
}

export async function upsertDriver(driver: Partial<DriverRow> & { id?: number }) {
  await requireAuthenticatedUser()
  const { id, pin, pin_is_default: _pinIsDefault, ...payload } = driver
  const newPin = pin?.trim()
  if (newPin) {
    if (!isValidNewPin(newPin)) throw new Error('PIN harus 6 angka dan tidak boleh 123456')
    // PIN baru dari admin sekaligus membuka kunci percobaan PIN driver.
    Object.assign(payload, { pin: hashPin(newPin), pin_failed_attempts: 0, pin_locked_until: null })
  }
  if (!id && (!payload.driver_code || !payload.driver_code.trim())) {
    payload.driver_code = await getNextDriverCode(payload.role ?? 'Driver')
  }
  if (id) {
    const { error } = await supabaseAdmin.from('master_driver').update(payload).eq('id', id)
    if (error) throw error
  } else {
    const { error } = await supabaseAdmin.from('master_driver').insert(payload)
    if (error) throw error
  }
}

export async function deleteDriver(id: number) {
  await requireAuthenticatedUser()
  const { error } = await supabaseAdmin.from('master_driver').delete().eq('id', id)
  if (error) throw error
}
