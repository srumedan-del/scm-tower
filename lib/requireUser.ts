import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { isAuthRetryableFetchError } from '@supabase/supabase-js'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

async function loginPath() {
  const referer = (await headers()).get('referer')
  if (!referer) return '/login'
  try {
    const { pathname, search } = new URL(referer)
    return `/login?redirectTo=${encodeURIComponent(pathname + search)}`
  } catch {
    return '/login'
  }
}

/**
 * Server Actions are public POST entry points. This guard must be called by
 * every action before using supabaseAdmin (which bypasses RLS), and outside
 * any try/catch because redirect() works by throwing.
 *
 * Sesi yang habis mengarahkan user ke halaman login. Jika sesi sebenarnya masih
 * valid (misalnya bentrok refresh token), proxy mengembalikannya ke aplikasi.
 */
export async function requireAuthenticatedUser() {
  const supabase = await createSupabaseServerClient()
  let result = await supabase.auth.getUser()
  if (isAuthRetryableFetchError(result.error)) result = await supabase.auth.getUser()

  if (result.data.user) return result.data.user
  if (isAuthRetryableFetchError(result.error)) {
    throw new Error('Layanan login tidak dapat dihubungi, silakan coba lagi')
  }

  console.warn('[auth] sesi tidak valid:', result.error?.code ?? result.error?.message ?? 'no user')
  redirect(await loginPath())
}
