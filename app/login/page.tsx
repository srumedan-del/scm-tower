'use client'

import { FormEvent, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Mail, Lock, LogIn, AlertCircle, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'

function LoginForm() {
  const searchParams = useSearchParams()
  const requestedRedirect = searchParams.get('redirectTo')
  const redirectTo = requestedRedirect?.startsWith('/') && !requestedRedirect.startsWith('//')
    ? requestedRedirect
    : '/dashboard'

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  async function signIn(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError('')

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

    if (signInError) {
      setError(signInError.message)
      setLoading(false)
      return
    }

    // Auth cookies are written by the browser client. Use a document navigation so
    // the proxy receives the new session instead of reusing the pre-login router state.
    window.location.assign(redirectTo)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface p-6 relative overflow-hidden">
      {/* Background decorative blobs */}
      <div className="absolute top-[-80px] left-[-80px] w-80 h-80 rounded-full bg-blue/10 blur-3xl pointer-events-none animate-drift" />
      <div className="absolute bottom-[-60px] right-[-60px] w-64 h-64 rounded-full bg-green/10 blur-3xl pointer-events-none animate-drift" style={{ animationDelay: '3s' }} />

      <motion.form
        onSubmit={signIn}
        className="w-full max-w-md rounded-2xl border border-border bg-white p-8 shadow-xl shadow-black/5 relative z-10"
        initial={{ opacity: 0, y: 32, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Logo & Heading */}
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.35 }}
        >
          <div className="flex items-center gap-3 mb-5">
            <motion.div
              className="grid h-11 w-11 place-items-center rounded-xl bg-blue text-sm font-bold text-white shadow-md shadow-blue/30"
              whileHover={{ scale: 1.08, rotate: 3 }}
              transition={{ type: 'spring', stiffness: 400, damping: 15 }}
            >
              SC
            </motion.div>
            <div>
              <p className="font-bold text-text text-base leading-tight">SCM Tower</p>
              <p className="text-xs text-muted">Control Center</p>
            </div>
          </div>
          <h1 className="text-xl font-bold text-text">Selamat datang kembali</h1>
          <p className="mt-1 text-sm text-muted">Masuk untuk melanjutkan ke dashboard</p>
        </motion.div>

        {/* Email field */}
        <motion.div
          className="mb-4"
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.22, duration: 0.3 }}
        >
          <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">
            Email
          </label>
          <div className="relative">
            <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface pl-10 pr-4 py-2.5 text-sm
                focus:outline-none focus:ring-2 focus:ring-blue/30 focus:border-blue
                transition-all duration-200 placeholder:text-gray-300"
              placeholder="nama@email.com"
            />
          </div>
        </motion.div>

        {/* Password field */}
        <motion.div
          className="mb-5"
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.28, duration: 0.3 }}
        >
          <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">
            Password
          </label>
          <div className="relative">
            <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface pl-10 pr-4 py-2.5 text-sm
                focus:outline-none focus:ring-2 focus:ring-blue/30 focus:border-blue
                transition-all duration-200 placeholder:text-gray-300"
              placeholder="••••••••"
            />
          </div>
        </motion.div>

        {/* Error message */}
        <AnimatePresence>
          {error && (
            <motion.div
              className="mb-4 flex items-start gap-2.5 rounded-lg bg-red/8 border border-red/20 px-3.5 py-2.5"
              initial={{ opacity: 0, y: -8, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -8, height: 0 }}
              transition={{ duration: 0.2 }}
            >
              <AlertCircle size={15} className="text-red mt-0.5 shrink-0" />
              <p className="text-sm text-red">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Submit button */}
        <motion.button
          disabled={loading}
          type="submit"
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue py-2.5 text-sm
            font-semibold text-white shadow-md shadow-blue/25
            hover:bg-blue/90 active:scale-[0.98]
            disabled:opacity-60 disabled:cursor-not-allowed
            transition-all duration-200"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.3 }}
          whileHover={{ y: -1, boxShadow: '0 8px 24px rgba(39,131,222,0.3)' }}
          whileTap={{ scale: 0.98 }}
        >
          {loading
            ? <><Loader2 size={15} className="animate-spin" /> Memeriksa...</>
            : <><LogIn size={15} /> Masuk</>
          }
        </motion.button>
      </motion.form>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
