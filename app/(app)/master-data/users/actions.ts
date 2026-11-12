'use server'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireAuthenticatedUser } from '@/lib/requireUser'

export type AppUser = {
  id: string
  email: string | null
  full_name: string | null
  created_at: string
  last_sign_in_at: string | null
  active: boolean
  is_me: boolean
}

// Supabase memblokir login selama masa "ban"; 100 tahun berarti nonaktif.
const DEACTIVATED_FOR = '876000h'
const MIN_PASSWORD = 8

function checkPassword(password: string) {
  if (password.length < MIN_PASSWORD) throw new Error(`Password minimal ${MIN_PASSWORD} karakter.`)
}

export async function listUsers(): Promise<AppUser[]> {
  const me = await requireAuthenticatedUser()
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 })
  if (error) throw new Error(error.message)
  return data.users
    .map(user => ({
      id: user.id,
      email: user.email ?? null,
      full_name: (user.user_metadata?.full_name as string | undefined) ?? null,
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at ?? null,
      active: !user.banned_until || new Date(user.banned_until) <= new Date(),
      is_me: user.id === me.id,
    }))
    .sort((a, b) => (a.full_name ?? a.email ?? '').localeCompare(b.full_name ?? b.email ?? ''))
}

export async function createAppUser(input: { full_name: string; email: string; password: string }) {
  await requireAuthenticatedUser()
  const email = input.email.trim().toLowerCase()
  const fullName = input.full_name.trim()
  if (!fullName) throw new Error('Nama wajib diisi.')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Format email tidak valid.')
  checkPassword(input.password)
  const { error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })
  if (error) {
    if (/already|registered|exists/i.test(error.message)) throw new Error('Email ini sudah terdaftar.')
    throw new Error(error.message)
  }
}

export async function updateAppUserName(id: string, fullName: string) {
  await requireAuthenticatedUser()
  if (!fullName.trim()) throw new Error('Nama wajib diisi.')
  const { error } = await supabaseAdmin.auth.admin.updateUserById(id, { user_metadata: { full_name: fullName.trim() } })
  if (error) throw new Error(error.message)
}

export async function resetAppUserPassword(id: string, password: string) {
  await requireAuthenticatedUser()
  checkPassword(password)
  const { error } = await supabaseAdmin.auth.admin.updateUserById(id, { password })
  if (error) throw new Error(error.message)
}

export async function setAppUserActive(id: string, active: boolean) {
  const me = await requireAuthenticatedUser()
  if (id === me.id && !active) throw new Error('Anda tidak bisa menonaktifkan akun sendiri.')
  const { error } = await supabaseAdmin.auth.admin.updateUserById(id, { ban_duration: active ? 'none' : DEACTIVATED_FOR })
  if (error) throw new Error(error.message)
}

export async function countAppUsers() {
  await requireAuthenticatedUser()
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 })
  if (error) return 0
  return data.users.length
}
