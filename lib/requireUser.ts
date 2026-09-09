import { createSupabaseServerClient } from '@/lib/supabaseServer'

/**
 * Server Actions are public POST entry points. This guard must be called by
 * every mutation before using supabaseAdmin (which bypasses RLS).
 */
export async function requireAuthenticatedUser() {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.auth.getUser()

  if (error || !data.user) {
    throw new Error('Unauthorized')
  }

  return data.user
}
