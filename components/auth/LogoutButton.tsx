'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export function LogoutButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogout() {
    setLoading(true)
    setError('')

    try {
      const { error: signOutError } = await supabase.auth.signOut()
      if (signOutError) {
        setError(signOutError.message)
        setLoading(false)
        return
      }

      router.replace('/login')
      router.refresh()
    } catch (signOutError) {
      setError(signOutError instanceof Error ? signOutError.message : 'Tidak dapat keluar. Silakan coba lagi.')
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-end lg:items-stretch">
      <button
        type="button"
        onClick={handleLogout}
        disabled={loading}
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-[#D2D2D7] bg-white px-4 py-2 text-sm font-medium text-[#1D1D1F] transition-colors hover:bg-[#F5F5F7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF] disabled:cursor-wait disabled:opacity-60 lg:w-full lg:justify-start"
      >
        {loading ? <Loader2 size={16} aria-hidden="true" className="animate-spin" /> : <LogOut size={16} aria-hidden="true" />}
        {loading ? 'Keluar...' : 'Keluar'}
      </button>
      {error && <p role="alert" className="absolute right-5 top-full mt-1 max-w-64 text-xs text-red-700">{error}</p>}
    </div>
  )
}
