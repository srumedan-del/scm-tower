'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle, Bot, CheckCircle2, Loader2, Sparkles, X } from 'lucide-react'
import { calculateReceivingLoad, type ReceivingPackaging } from '@/lib/receiving-analytics'

type HeaderRow = {
  id: number | string
  ptr_no?: string | null
  transfer_from_code?: string | null
  transfer_to_code?: string | null
  posting_date?: string | null
  shipment_date?: string | null
  receipt_date?: string | null
  shipping_agent_code?: string | null
  ship_to_receipt_days?: number | null
  receipt_to_posting_days?: number | null
  ship_to_posting_days?: number | null
}

type DetailRow = {
  item_no?: string | null
  description?: string | null
  document_no?: string | null
  quantity?: number | string | null
}

type Props = {
  rows: HeaderRow[]
  details: DetailRow[]
  packaging: ReceivingPackaging[]
}

export default function ReceivingAIAnalysis({ rows, details, packaging }: Props) {
  const [open, setOpen] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzed, setAnalyzed] = useState(false)

  const analysis = useMemo(() => {
    const leadTimes = rows
      .map(row => row.ship_to_posting_days)
      .filter(value => value !== null && value !== undefined && String(value).trim() !== '')
      .map(value => Number(value))
      .filter(value => Number.isFinite(value) && value >= 0)
    const averageLeadTime = leadTimes.length
      ? Math.round((leadTimes.reduce((sum, value) => sum + value, 0) / leadTimes.length) * 10) / 10
      : 0
    const lateRows = rows.filter(row => Number(row.ship_to_posting_days) > 18)
    const missingReceiptDates = rows.filter(row => !row.receipt_date).length
    const agentCounts = new Map<string, number>()
    rows.forEach(row => {
      const agent = String(row.shipping_agent_code ?? 'Tidak diketahui').trim() || 'Tidak diketahui'
      agentCounts.set(agent, (agentCounts.get(agent) ?? 0) + 1)
    })
    const topAgent = [...agentCounts.entries()].sort((a, b) => b[1] - a[1])[0]
    const load = calculateReceivingLoad(details, packaging)
    const packagingMap = new Map(packaging.map(item => [String(item.sku_code ?? '').trim().toUpperCase(), item]))
    const missingPackagingItems = [...new Map(
      details
        .map(detail => String(detail.item_no ?? '').trim())
        .filter(Boolean)
        .map(item => {
          const normalized = item.toUpperCase()
          const master = packagingMap.get(normalized)
          const missing = [] as string[]
          if (!master || Number(master.outer_box_cbm) <= 0) missing.push('Volume')
          if (!master || Number(master.outer_box_weight_kg) <= 0) missing.push('Tonase')
          if (!master || Number(master.pcs_per_pallet) <= 0) missing.push('Pallet')
          return { item, missing }
        })
        .filter(entry => entry.missing.length > 0)
        .map(entry => [entry.item, entry])
    ).values()].slice(0, 10)
    const trendMap = new Map<string, number>()
    rows.forEach(row => {
      const month = row.posting_date?.slice(0, 7) ?? 'Tanpa tanggal'
      trendMap.set(month, (trendMap.get(month) ?? 0) + 1)
    })
    const trend = [...trendMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, count]) => ({ month, count }))
    const itemMap = new Map<string, { quantity: number; lines: number }>()
    details.forEach(detail => {
      const item = String(detail.item_no ?? detail.description ?? 'Item tidak diketahui').trim() || 'Item tidak diketahui'
      const current = itemMap.get(item) ?? { quantity: 0, lines: 0 }
      current.quantity += Number(detail.quantity) || 0
      current.lines += 1
      itemMap.set(item, current)
    })
    const topItems = [...itemMap.entries()]
      .sort(([, a], [, b]) => b.quantity - a.quantity)
      .slice(0, 5)

    return { averageLeadTime, lateRows, missingReceiptDates, topAgent, load, trend, topItems, missingPackagingItems }
  }, [rows, details, packaging])

  const startAnalysis = () => {
    setOpen(true)
    setAnalyzing(true)
    setAnalyzed(false)
    window.setTimeout(() => {
      setAnalyzing(false)
      setAnalyzed(true)
    }, 450)
  }

  return (
    <>
      <button
        type="button"
        onClick={startAnalysis}
        className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
      >
        <Sparkles className="h-4 w-4" />
        Analisis AI
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <section className="w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={event => event.stopPropagation()}>
            <header className="flex items-start justify-between border-b border-slate-200 bg-gradient-to-r from-indigo-50 to-white px-4 py-3">
              <div>
                <div className="flex items-center gap-2 text-indigo-700">
                  <Bot className="h-5 w-5" />
                  <span className="text-xs font-bold uppercase tracking-[0.18em]">Receiving Intelligence</span>
                </div>
                <h2 className="mt-1 text-xl font-bold text-slate-900">Analisa Receiving</h2>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-2 text-slate-400 hover:bg-white hover:text-slate-700" aria-label="Tutup analisis AI">
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="max-h-[calc(90vh-82px)] space-y-3 overflow-y-auto p-4">
              {analyzing ? (
                <div className="flex items-center justify-center gap-3 py-12 text-sm text-slate-600">
                  <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
                  AI sedang membaca pola data receiving...
                </div>
              ) : analyzed ? (
                <>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <Metric label="PTR dianalisis" value={Number(rows.length ?? 0)} />
                    <Metric label="Rata-rata lead time kirim" value={analysis.averageLeadTime > 0 ? `${Number(analysis.averageLeadTime ?? 0)} hari` : '—'} />
                    <Metric label="PTR terlambat" value={Number(analysis.lateRows.length ?? 0)} />
                    <Metric label="Total quantity" value={details.length ? Number(analysis.load.quantity ?? 0).toLocaleString('id-ID') : '—'} />
                    <Metric label="Volume" value={details.length ? `${Number(analysis.load.volumeCbm ?? 0).toFixed(2)} m³` : '—'} />
                    <Metric label="Tonase" value={details.length ? `${Number(analysis.load.tonnage ?? 0).toFixed(2)} ton` : '—'} />
                    <Metric label="Pallet" value={details.length ? Number(analysis.load.pallets ?? 0).toLocaleString('id-ID') : '—'} />
                  </div>

                  {(analysis.load.volumeRows === 0 || analysis.load.weightRows === 0 || analysis.load.palletRows === 0) && analysis.missingPackagingItems.length > 0 && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-sm text-amber-900">
                      <p className="font-semibold">Item belum dimaintain master packaging</p>
                      <p className="mt-1 text-xs text-amber-800">
                        Beberapa item belum memiliki data master untuk Volume, Tonase, atau Pallet, sehingga angka dapat lebih rendah dari kondisi aktual.
                      </p>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        {analysis.missingPackagingItems.map(({ item, missing }) => (
                          <div key={item} className="rounded-lg border border-amber-200 bg-white/60 px-3 py-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium text-slate-800">{item}</span>
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                                {missing.join(', ')}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid gap-3 md:grid-cols-2">
                    <section className="rounded-xl border border-slate-200 p-2.5">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-slate-900">Trend PTR masuk</h3>
                          <p className="text-xs text-slate-500">Jumlah PTR berdasarkan posting month</p>
                        </div>
                        <span className="text-xs font-semibold text-indigo-600">{analysis.trend.reduce((sum, point) => sum + point.count, 0)} PTR</span>
                      </div>
                      <div className="mt-2 space-y-2">
                        {analysis.trend.length ? analysis.trend.map(point => {
                          const maxCount = Math.max(...analysis.trend.map(item => item.count), 1)
                          return <div key={point.month} className="grid grid-cols-[72px_1fr_34px] items-center gap-2 text-xs"><span className="text-slate-500">{point.month}</span><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${(point.count / maxCount) * 100}%` }} /></div><span className="text-right font-semibold text-slate-700">{point.count}</span></div>
                        }) : <p className="py-4 text-sm text-slate-500">Belum ada data trend.</p>}
                      </div>
                    </section>

                    <section className="rounded-xl border border-slate-200 p-2.5">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-slate-900">Analisis by item</h3>
                          <p className="text-xs text-slate-500">Top item berdasarkan total quantity</p>
                        </div>
                        <span className="text-xs font-semibold text-indigo-600">{analysis.topItems.length} item</span>
                      </div>
                      <div className="mt-2 space-y-2">
                        {analysis.topItems.length ? analysis.topItems.map(([item, value]) => <div key={item} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-xs"><span className="min-w-0 truncate font-medium text-slate-700" title={item}>{item}</span><span className="shrink-0 font-bold text-slate-900">{value.quantity.toLocaleString('id-ID')}</span></div>) : <p className="py-3 text-sm text-slate-500">Belum ada detail item.</p>}
                      </div>
                    </section>
                  </div>

                  <div className="space-y-2">
                    {analysis.lateRows.length ? (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-amber-950">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 rounded-md bg-amber-100 p-1 text-amber-700">
                            <AlertTriangle className="h-4 w-4" />
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold">Perlu perhatian pada lead time</p>
                            <p className="mt-1 text-sm text-amber-900">
                              {analysis.lateRows.length} PTR melewati 18 hari. Prioritaskan pengecekan shipment dan shipping agent terkait.
                            </p>
                            <div className="mt-2 space-y-2">
                              {analysis.lateRows.slice(0, 5).map(row => (
                                <div key={`${row.ptr_no ?? 'ptr'}-${row.shipment_date ?? 'date'}`} className="rounded-lg border border-amber-200 bg-white/70 px-3 py-2">
                                  <div className="flex items-center justify-between gap-3">
                                    <span className="font-semibold text-slate-800">{row.ptr_no ?? 'PTR tidak diketahui'}</span>
                                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">
                                      {Number(row.ship_to_posting_days ?? 0)} hari
                                    </span>
                                  </div>
                                  <div className="mt-1 text-xs text-slate-600">
                                    {row.shipping_agent_code ? `Agent: ${row.shipping_agent_code}` : 'Agent: tidak diketahui'}
                                    {row.shipment_date ? ` • Shipment: ${row.shipment_date}` : ''}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <Insight
                        tone="success"
                        icon={<CheckCircle2 className="h-4 w-4" />}
                        title="Lead time terlihat terkendali"
                        detail="Tidak ada PTR yang melewati ambang 18 hari pada data yang sedang tampil."
                      />
                    )}
                  </div>

                  <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-2.5 text-sm text-indigo-950">
                    <p className="font-semibold">Rekomendasi terkait Receiving</p>
                    <p className="mt-1">Review PTR terlambat lebih dulu dan bandingkan performa agent {analysis.topAgent?.[0] ?? 'yang belum teridentifikasi'} ({analysis.topAgent?.[1] ?? 0} PTR). Gunakan filter bulan untuk analisis periode yang lebih spesifik.</p>
                  </div>
                </>
              ) : null}
            </div>
          </section>
        </div>
      )}
    </>
  )
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="text-xs text-slate-500">{label}</div><div className="mt-1 text-lg font-bold text-slate-900">{value}</div></div>
}

function Insight({ tone, icon, title, detail }: { tone: 'warning' | 'success'; icon: React.ReactNode; title: string; detail: string }) {
  return <div className={`flex gap-3 rounded-xl border p-4 ${tone === 'warning' ? 'border-amber-200 bg-amber-50 text-amber-950' : 'border-emerald-200 bg-emerald-50 text-emerald-950'}`}><div className="mt-0.5">{icon}</div><div><p className="font-semibold">{title}</p><p className="mt-1 text-sm opacity-80">{detail}</p></div></div>
}
