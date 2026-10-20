'use client'

import { FormEvent, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion, AnimatePresence, MotionConfig } from 'framer-motion'
import { Mail, Lock, LogIn, AlertCircle, Loader2, Activity } from 'lucide-react'
import { supabase } from '@/lib/supabase'

function LoginForm() {
  const searchParams = useSearchParams()
  const requestedRedirect = searchParams.get('redirectTo')
  const redirectTo = requestedRedirect?.startsWith('/') && !requestedRedirect.startsWith('//')
    ? requestedRedirect
    : '/'

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
    <MotionConfig reducedMotion="user">
      <main className="flex min-h-screen items-center justify-center bg-white px-4 py-10 sm:px-6">
      <motion.div
        className="w-full max-w-md"
        initial={{ opacity: 0, y: 18, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="rounded-3xl border border-[#E5E5EA] bg-white p-6 shadow-[0_12px_40px_rgba(0,0,0,0.07)] sm:p-9">
        <motion.form
          onSubmit={signIn}
          className="w-full"
        >
          <motion.div
            className="mb-8"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.3 }}
          >
            <div className="mb-7 flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-primary text-sm font-bold text-foreground-inverse shadow-sm">
                <Activity size={24} aria-hidden="true" className="text-foreground-inverse" />
              </div>
              <div>
                <p className="text-base font-semibold leading-tight text-foreground-primary">SCM Control Tower</p>
                <p className="mt-1 text-xs text-foreground-secondary">Ruang kerja Medan</p>
              </div>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground-primary sm:text-3xl">Selamat datang kembali</h1>
            <p className="mt-2 text-sm leading-6 text-foreground-secondary">Masuk untuk melanjutkan ke ruang kendali operasional.</p>
          </motion.div>

          <motion.div
            className="mb-5"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.14, duration: 0.3 }}
          >
            <label htmlFor="email" className="mb-2 block text-sm font-medium text-foreground-primary">Email</label>
            <div className="relative">
              <Mail size={16} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground-secondary" />
              <input
                id="email"
                required
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-border-default bg-foreground-inverse px-4 py-3 pl-10 text-sm text-foreground-primary shadow-sm outline-none transition-interactive placeholder:text-foreground-tertiary/60 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/15"
                placeholder="nama@email.com"
              />
            </div>
          </motion.div>

          <motion.div
            className="mb-6"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.3 }}
          >
            <label htmlFor="password" className="mb-2 block text-sm font-medium text-foreground-primary">Password</label>
            <div className="relative">
              <Lock size={16} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground-secondary" />
              <input
                id="password"
                required
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-border-default bg-foreground-inverse px-4 py-3 pl-10 text-sm text-foreground-primary shadow-sm outline-none transition-interactive placeholder:text-foreground-tertiary/60 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/15"
                placeholder="Masukkan password"
              />
            </div>
          </motion.div>

          <AnimatePresence>
            {error && (
              <motion.div
                role="alert"
                className="mb-4 flex items-start gap-2.5 rounded-xl border border-status-error/20 bg-status-error/10 px-3.5 py-3"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
              >
                <AlertCircle size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-status-error" />
                <p className="text-sm text-status-error">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.button
            disabled={loading}
            type="submit"
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-primary text-foreground-inverse text-sm font-semibold transition-interactive hover:bg-brand-primary/90 focus-ring disabled:cursor-not-allowed disabled:opacity-60"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.26, duration: 0.3 }}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.99 }}
          >
            {loading
              ? <><Loader2 size={16} aria-hidden="true" className="animate-spin" /> Memeriksa...</>
              : <><LogIn size={16} aria-hidden="true" /> Masuk</>
            }
          </motion.button>
        </motion.form>
        </div>
      </motion.div>
      </main>
    </MotionConfig>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
