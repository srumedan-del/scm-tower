'use client'

import { useEffect, useMemo, useState } from 'react'
import { Activity, AlertTriangle, Wifi, WifiOff } from 'lucide-react'

type LogEntry = {
  type: 'network' | 'fetch' | 'error' | 'route' | 'visibility'
  message: string
  ts: string
  durationMs?: number
}

type Snapshot = {
  status: 'online' | 'offline'
  route: string
  pageLoadMs: number | null
  slowFetches: number
  logs: LogEntry[]
}

export default function AppHealthMonitor() {
  const [visible, setVisible] = useState(false)
  const [snapshot, setSnapshot] = useState<Snapshot>({
    status: 'offline',
    route: '/',
    pageLoadMs: null,
    slowFetches: 0,
    logs: [],
  })

  useEffect(() => {
    const pushLog = (entry: LogEntry) => {
      setSnapshot(current => ({
        ...current,
        logs: [entry, ...current.logs].slice(0, 12),
        slowFetches: entry.type === 'fetch' && (entry.durationMs ?? 0) > 2500
          ? current.slowFetches + 1
          : current.slowFetches,
      }))
    }

    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
    setSnapshot(current => ({
      ...current,
      status: navigator.onLine ? 'online' : 'offline',
      route: window.location.pathname,
      pageLoadMs: nav ? Math.max(0, Math.round(nav.loadEventEnd - nav.startTime)) : null,
    }))

    const onOnline = () => {
      setSnapshot(current => ({ ...current, status: 'online' }))
      pushLog({ type: 'network', message: 'Browser kembali online', ts: new Date().toISOString() })
    }

    const onOffline = () => {
      setSnapshot(current => ({ ...current, status: 'offline' }))
      pushLog({ type: 'network', message: 'Browser offline / koneksi terputus', ts: new Date().toISOString() })
    }

    const onPageError = (event: ErrorEvent) => {
      pushLog({ type: 'error', message: event.message || 'Runtime error', ts: new Date().toISOString() })
    }

    const onUnhandled = (event: PromiseRejectionEvent) => {
      pushLog({ type: 'error', message: event.reason?.message || 'Unhandled promise rejection', ts: new Date().toISOString() })
    }

    const onVisibility = () => {
      pushLog({
        type: 'visibility',
        message: document.visibilityState === 'hidden' ? 'Tab disembunyikan' : 'Tab aktif kembali',
        ts: new Date().toISOString(),
      })
    }

    const originalFetch = window.fetch.bind(window)
    window.fetch = async (...args) => {
      const start = performance.now()
      try {
        const response = await originalFetch(...args)
        const durationMs = performance.now() - start
        if (durationMs > 2500) {
          pushLog({
            type: 'fetch',
            message: `Request lambat: ${String(args[0])}`,
            ts: new Date().toISOString(),
            durationMs,
          })
        }
        return response
      } catch (error) {
        pushLog({
          type: 'error',
          message: error instanceof Error ? error.message : 'Fetch gagal',
          ts: new Date().toISOString(),
        })
        throw error
      }
    }

    const onRouteChange = () => {
      setSnapshot(current => ({ ...current, route: window.location.pathname }))
      pushLog({ type: 'route', message: `Route aktif: ${window.location.pathname}`, ts: new Date().toISOString() })
    }

    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    window.addEventListener('error', onPageError)
    window.addEventListener('unhandledrejection', onUnhandled)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('popstate', onRouteChange)
    const pushState = window.history.pushState
    window.history.pushState = (...args) => {
      const result = pushState.apply(window.history, args)
      queueMicrotask(onRouteChange)
      return result
    }

    onRouteChange()

    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('error', onPageError)
      window.removeEventListener('unhandledrejection', onUnhandled)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('popstate', onRouteChange)
      window.history.pushState = pushState
    }
  }, [])

  const slowSummary = useMemo(() => snapshot.logs.filter(entry => entry.type === 'fetch' && (entry.durationMs ?? 0) > 2500), [snapshot.logs])

  return (
    <div style={{ position: 'fixed', right: 12, bottom: 12, zIndex: 99999 }}>
      <button
        type="button"
        onClick={() => setVisible(value => !value)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 10px',
          borderRadius: 999,
          border: '1px solid rgba(15,23,42,0.12)',
          background: snapshot.status === 'online' ? '#ecfdf5' : '#fef2f2',
          color: '#111827',
          boxShadow: '0 8px 24px rgba(15,23,42,0.08)',
          fontSize: 11,
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        {snapshot.status === 'online' ? <Wifi size={12} /> : <WifiOff size={12} />}
        App Monitor
      </button>

      {visible && (
        <div
          style={{
            marginTop: 8,
            width: 340,
            maxHeight: 420,
            overflow: 'auto',
            background: 'rgba(255,255,255,0.96)',
            border: '1px solid rgba(15,23,42,0.12)',
            borderRadius: 12,
            boxShadow: '0 16px 36px rgba(15,23,42,0.1)',
            padding: 12,
            color: '#111827',
            fontSize: 11,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <strong style={{ fontSize: 12 }}>Health check</strong>
            <span style={{ color: snapshot.status === 'online' ? '#16a34a' : '#dc2626' }}>{snapshot.status}</span>
          </div>

          <div style={{ display: 'grid', gap: 6 }}>
            <div><strong>Route:</strong> {snapshot.route}</div>
            <div><strong>Page load:</strong> {snapshot.pageLoadMs == null ? 'n/a' : `${snapshot.pageLoadMs} ms`}</div>
            <div><strong>Slow fetch:</strong> {snapshot.slowFetches}</div>
          </div>

          <div style={{ marginTop: 10, borderTop: '1px solid #e5e7eb', paddingTop: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <Activity size={12} />
              <strong>Recent events</strong>
            </div>

            {snapshot.logs.length === 0 ? (
              <div style={{ color: '#6b7280' }}>Belum ada event.</div>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 }}>
                {snapshot.logs.map((entry, index) => (
                  <li key={`${entry.ts}-${index}`} style={{ borderLeft: '2px solid #dbeafe', paddingLeft: 8 }}>
                    <div style={{ color: '#374151', fontWeight: 600 }}>{entry.message}</div>
                    <div style={{ color: '#6b7280', marginTop: 2 }}>
                      {entry.type} {entry.durationMs ? `• ${Math.round(entry.durationMs)} ms` : ''}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {slowSummary.length > 0 && (
              <div style={{ marginTop: 10, padding: 8, borderRadius: 8, background: '#fff7ed', color: '#9a4d00' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertTriangle size={12} />
                  <strong>Perhatian</strong>
                </div>
                <div style={{ marginTop: 4 }}>
                  Ada {slowSummary.length} request yang lambat di atas 2.5 detik.
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
