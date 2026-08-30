// Server-side Supabase client (pakai service role — bypass RLS untuk full read/write)
// Hanya untuk Server Components & Server Actions
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)