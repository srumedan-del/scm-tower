'use client'

import React, { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { driverChangeDefaultPin, driverLogin } from '../actions'
import { Button, ErrorText, Field } from '../dashboard/ui'

export default function DriverLoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [pin, setPin] = useState('')
  const [mustChangePin, setMustChangePin] = useState(false)
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [error, setError] = useState('')
  const [loading, startTransition] = useTransition()
  const digits = (setter: (value: string) => void) => (value: string) => setter(value.replace(/\D/g, ''))

  function handleLogin(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    if (!username.trim() || !pin.trim()) return setError('Username dan PIN wajib diisi')
    if (mustChangePin && newPin !== confirmPin) return setError('Konfirmasi PIN tidak sama')

    startTransition(async () => {
      const result = mustChangePin
        ? await driverChangeDefaultPin(username, pin, newPin)
        : await driverLogin(username, pin)
      if (result.success) return router.replace('/driver/dashboard')
      if ('mustChangePin' in result && result.mustChangePin) return setMustChangePin(true)
      setError(result.error || 'Login gagal')
    })
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#0D1C33]">
      <div className="flex flex-col gap-1.5 px-6 pb-7 pt-[72px]">
        <div className="mb-3 flex h-[52px] w-[52px] items-center justify-center rounded-[14px] bg-[#C5A25D] text-base font-extrabold text-[#0D1C33]">SC</div>
        <h1 className="text-[26px] font-bold text-white">SCM Tower Driver</h1>
        <p className="text-sm text-[#E8D5A3]">Pengiriman, BBM, dan bukti terima</p>
      </div>
      <form onSubmit={handleLogin} className="flex flex-1 flex-col gap-3 rounded-t-3xl bg-[#F7F5F0] p-4 pt-6">
        <Field label="Username" value={username} onChange={setUsername} autoCapitalize="none" disabled={mustChangePin} />
        <Field label="PIN" value={pin} onChange={setPin} type="password" inputMode="numeric" maxLength={6} disabled={mustChangePin} />
        {mustChangePin && (
          <>
            <p className="text-sm text-[#111827]">PIN Anda masih bawaan. Buat PIN baru 6 angka untuk melanjutkan.</p>
            <Field label="PIN baru" value={newPin} onChange={digits(setNewPin)} type="password" inputMode="numeric" maxLength={6} />
            <Field label="Ulangi PIN baru" value={confirmPin} onChange={digits(setConfirmPin)} type="password" inputMode="numeric" maxLength={6} />
          </>
        )}
        {error ? <ErrorText>{error}</ErrorText> : null}
        <Button type="submit" label={mustChangePin ? 'Simpan PIN & Masuk' : 'Masuk'} busy={loading} />
      </form>
    </div>
  )
}
