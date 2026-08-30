'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function Login(){
	const router = useRouter()
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [error, setError] = useState('')
	const [loading, setLoading] = useState(false)

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
		router.push('/dashboard')
	}

	return <div className="flex min-h-screen items-center justify-center p-6"><form onSubmit={signIn} className="w-full max-w-md rounded-xl border border-border bg-white p-8"><h1 className="text-2xl font-bold">Login SCM Control Tower</h1><p className="mb-6 mt-2 text-muted">Khusus admin untuk maintain data customer.</p><label className="mb-3 block text-sm font-medium">Email<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 w-full rounded-lg border border-border p-3" /></label><label className="mb-4 block text-sm font-medium">Password<input required type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 w-full rounded-lg border border-border p-3" /></label>{error && <p className="mb-4 text-sm text-red">{error}</p>}<button disabled={loading} className="w-full rounded-lg bg-blue p-3 font-medium text-white">{loading ? 'Memeriksa...' : 'Login sebagai admin'}</button></form></div>
}
