'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

/** Garis emas tipis di atas layar selama pindah halaman. */
export function RouteProgress() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [width, setWidth] = useState(0)
  const [visible, setVisible] = useState(false)
  const timers = useRef<number[]>([])

  const clearTimers = () => {
    timers.current.forEach(window.clearTimeout)
    timers.current = []
  }

  // Mulai saat tautan internal diklik.
  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const anchor = (event.target as HTMLElement | null)?.closest('a')
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return
      const url = new URL(anchor.href, window.location.href)
      if (url.origin !== window.location.origin) return
      if (url.pathname === window.location.pathname && url.search === window.location.search) return
      clearTimers()
      setVisible(true)
      setWidth(18)
      timers.current.push(window.setTimeout(() => setWidth(55), 180))
      timers.current.push(window.setTimeout(() => setWidth(80), 900))
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [])

  // Selesai saat halaman baru tampil.
  useEffect(() => {
    if (!visible) return
    clearTimers()
    setWidth(100)
    timers.current.push(window.setTimeout(() => { setVisible(false); setWidth(0) }, 450))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams])

  useEffect(() => clearTimers, [])

  return (
    <div
      aria-hidden="true"
      className="lux-route-progress"
      style={{ width: `${width}%`, opacity: visible ? 1 : 0 }}
    />
  )
}
