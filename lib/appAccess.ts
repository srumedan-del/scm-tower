import type { User } from '@supabase/supabase-js'

/**
 * Akun Supabase Auth belum tentu pengguna SCM Tower: pendaftaran publik Supabase bisa membuat
 * akun tanpa lewat aplikasi. Hanya akun yang ditandai `app_metadata.scm_access = true`
 * (diset server lewat Kelola Pengguna; tidak bisa diubah pemilik akun) yang boleh masuk.
 */
export const SCM_ACCESS_FLAG = 'scm_access'

export function hasScmAccess(user: Pick<User, 'app_metadata'> | null | undefined) {
  return user?.app_metadata?.[SCM_ACCESS_FLAG] === true
}
