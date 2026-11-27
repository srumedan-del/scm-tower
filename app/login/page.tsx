'use client'

import { FormEvent, useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion, AnimatePresence, MotionConfig } from 'framer-motion'
import { Mail, Lock, LogIn, AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { hasScmAccess } from '@/lib/appAccess'

const NO_ACCESS_MESSAGE = 'Akun ini tidak memiliki akses ke SCM Tower. Hubungi admin.'

function LoginForm() {
  const searchParams = useSearchParams()
  const requestedRedirect = searchParams.get('redirectTo')
  const redirectTo = requestedRedirect?.startsWith('/') && !requestedRedirect.startsWith('//')
    ? requestedRedirect
    : '/'

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState(searchParams.get('error') === 'no-access' ? NO_ACCESS_MESSAGE : '')
  const [loading, setLoading]   = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // Dialihkan ke sini karena akun tanpa akses SCM: buang sesinya.
  useEffect(() => {
    if (searchParams.get('error') === 'no-access') void supabase.auth.signOut()
  }, [searchParams])

  async function signIn(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError('')

    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password })

    if (signInError) {
      setError(signInError.message === 'Invalid login credentials' ? 'Email atau password salah' : signInError.message)
      setLoading(false)
      return
    }
    if (!hasScmAccess(data.user)) {
      await supabase.auth.signOut()
      setError(NO_ACCESS_MESSAGE)
      setLoading(false)
      return
    }

    // Auth cookies are written by the browser client. Use a document navigation so
    // the proxy receives the new session instead of reusing the pre-login router state.
    window.location.assign(redirectTo)
  }

  return (
    <MotionConfig reducedMotion="user">
      <main className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
        <section className="lux-login-panel hidden flex-col justify-between p-12 text-white lg:flex">
          {/* Latar video loop dari Higgsfield; gambar diam di CSS tetap jadi cadangan (dan saat hemat animasi). */}
          <video
            className="lux-login-video"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            poster="/images/login-warehouse.webp"
            aria-hidden="true"
            tabIndex={-1}
          >
            <source src="/videos/login-warehouse.webm" type="video/webm" />
            <source src="/videos/login-warehouse.mp4" type="video/mp4" />
          </video>
          <div className="relative flex items-center gap-3">
            <span className="lux-brand-mark grid h-11 w-11 place-items-center rounded-xl text-sm font-bold tracking-wider">SC</span>
            <span className="lux-display text-xl font-semibold leading-tight">SCM Control Tower</span>
          </div>

          <div className="relative">
            <p className="lux-display max-w-md text-4xl font-semibold leading-[1.15] tracking-[-0.025em] xl:text-[2.75rem]">
              Satu ruang kendali untuk setiap pergerakan barang.
            </p>
            <svg viewBox="6 0 414 64" className="mt-8 w-full max-w-md" aria-hidden="true">
              <path d="M36 24 H384" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
              {[[36, 'Receiving'], [152, 'Outbound'], [268, 'Shipment'], [384, 'Delivered']].map(([x, label]) => (
                <g key={label}>
                  <circle cx={x} cy="24" r="3.5" fill="#C29858" />
                  <text x={x} y="56" textAnchor="middle" fontSize="12" letterSpacing="0.02em" fill="rgba(255,255,255,0.62)">{label}</text>
                </g>
              ))}
            </svg>
          </div>
        </section>

        <section className="flex items-center justify-center px-5 py-10 sm:px-8">
          <motion.div
            className="w-full max-w-sm"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="mb-8 flex items-center gap-3 lg:hidden">
              <span className="lux-brand-mark grid h-11 w-11 place-items-center rounded-xl text-sm font-bold tracking-wider">SC</span>
              <span className="lux-display text-lg font-semibold text-indigo-900">SCM Control Tower</span>
            </div>

            <h1 className="lux-display text-[1.75rem] font-semibold tracking-[-0.02em] text-indigo-900">Selamat datang kembali</h1>

            <form onSubmit={signIn} className="mt-8 space-y-5">
              <div>
                <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-800">Email</label>
                <div className="relative">
                  <Mail size={16} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    id="email"
                    required
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="min-h-12 w-full rounded-lg border border-gray-300 bg-white px-4 pl-10 text-sm text-slate-900 outline-none transition-interactive placeholder:text-slate-400 focus:border-gold-500 focus:ring-3 focus:ring-gold-300/40"
                    placeholder="nama@email.com"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-800">Password</label>
                <div className="relative">
                  <Lock size={16} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    id="password"
                    required
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="min-h-12 w-full rounded-lg border border-gray-300 bg-white px-11 text-sm text-slate-900 outline-none transition-interactive placeholder:text-slate-400 focus:border-gold-500 focus:ring-3 focus:ring-gold-300/40"
                    placeholder="Masukkan password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(value => !value)}
                    aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                    aria-pressed={showPassword}
                    className="absolute right-1 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-lg text-slate-500 transition-colors hover:text-indigo-700"
                  >
                    {showPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                  </button>
                </div>
              </div>

              <AnimatePresence>
                {error && (
                  <motion.div
                    role="alert"
                    className="flex items-start gap-2.5 rounded-xl border border-status-error/25 bg-status-error/10 px-3.5 py-3"
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

              <button
                disabled={loading}
                type="submit"
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading
                  ? <><Loader2 size={16} aria-hidden="true" className="animate-spin" /> Memeriksa...</>
                  : <><LogIn size={16} aria-hidden="true" /> Masuk</>
                }
              </button>
            </form>
          </motion.div>
        </section>
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
