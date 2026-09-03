// Server-side Supabase client (pakai service role — bypass RLS untuk full read/write)
// Hanya untuk Server Components & Server Actions
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error(
    'Missing Supabase server env vars. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env.local file.'
  )
}

export const supabaseAdmin = createClient<any>(
  supabaseUrl,
  supabaseServiceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)