'use client'

import { useEffect, useRef, useState } from 'react'

/** Angka yang menghitung naik saat pertama tampil. Langsung angka akhir bila "kurangi animasi" aktif. */
export function CountUp({ value, duration = 700 }: { value: number; duration?: number }) {
  const [shown, setShown] = useState(value)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) { setShown(value); return }
    started.current = true
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || value === 0) { setShown(value); return }
    let frame = 0
    const begin = performance.now()
    const tick = (now: number) => {
      const progress = Math.min(1, (now - begin) / duration)
      const eased = 1 - Math.pow(1 - progress, 3)
      setShown(Math.round(value * eased))
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    setShown(0)
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value, duration])

  return <span className="tabular-nums">{shown.toLocaleString('id-ID')}</span>
}
