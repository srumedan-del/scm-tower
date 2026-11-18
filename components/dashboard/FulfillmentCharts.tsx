'use client'

import { Bar, BarChart, CartesianGrid, Cell, LabelList, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { TransporterPoint, WeekPoint } from '@/lib/fulfillment-metrics'

// Warna seri (palet aman buta warna dari skill bi-dashboard-design); status hanya untuk target.
const SERIES_OTIF = '#2563EB'
const SERIES_ONTIME = '#0D9488'
const TARGET = '#6B7280'
const GOOD = '#1A7F37'
const WARN = '#B7791F'
const BAD = '#C62828'

const fmtPct = (value: unknown) => (value == null ? '-' : `${Number(value).toLocaleString('id-ID', { maximumFractionDigits: 1 })}%`)

/** OTIF dan On-time per minggu dokumen, dengan garis target. */
export function FulfillmentTrend({ data, target }: { data: WeekPoint[]; target: number }) {
  if (!data.length) return <p className="py-10 text-center text-sm text-slate-400">Belum ada PSS terukur.</p>
  // Sumbu mulai sedikit di bawah nilai terendah (kelipatan 10) agar selisih antarminggu terbaca.
  const values = data.flatMap(d => [d.otif, d.onTime]).filter((v): v is number => v != null)
  const lowest = Math.max(0, Math.floor((Math.min(target, ...values) - 10) / 10) * 10)
  return (
    <div className="h-56 w-full" role="img" aria-label={`Tren OTIF dan On-time per minggu, target ${target}%`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 16, right: 24, bottom: 0, left: -12 }}>
          <CartesianGrid stroke="#EEECE7" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} />
          <YAxis domain={[lowest, 100]} tickCount={5} allowDecimals={false} tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} unit="%" />
          <Tooltip
            formatter={(value, name) => [fmtPct(value), name]}
            labelFormatter={(label, payload) => `Minggu ${label} · ${payload?.[0]?.payload?.count ?? 0} PSS`}
            contentStyle={{ borderRadius: 10, border: '1px solid #E5E3DE', fontSize: 12 }}
          />
          <ReferenceLine y={target} stroke={TARGET} strokeDasharray="5 4" label={{ value: `Target ${target}%`, position: 'insideBottomLeft', fontSize: 11, fill: TARGET }} />
          <Line type="monotone" dataKey="onTime" name="On-time" stroke={SERIES_ONTIME} strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
          <Line type="monotone" dataKey="otif" name="OTIF" stroke={SERIES_OTIF} strokeWidth={2.5} dot={{ r: 3.5 }} isAnimationActive={false}>
            <LabelList dataKey="otif" position="top" formatter={(v: unknown) => fmtPct(v)} style={{ fontSize: 11, fill: SERIES_OTIF, fontWeight: 600 }} />
          </Line>
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

/** OTIF per transporter, diurutkan, warna status terhadap target. */
export function TransporterOtif({ data, target }: { data: TransporterPoint[]; target: number }) {
  if (!data.length) return <p className="py-10 text-center text-sm text-slate-400">Belum ada data transporter.</p>
  const colorOf = (value: number | null) => (value == null ? TARGET : value >= target ? GOOD : value >= target - 15 ? WARN : BAD)
  return (
    <div style={{ height: Math.max(140, data.length * 38 + 24) }} className="w-full" role="img" aria-label="OTIF per transporter dibanding target">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 56, bottom: 4, left: 8 }}>
          <XAxis type="number" domain={[0, 100]} hide />
          <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 11, fill: '#374151' }} axisLine={false} tickLine={false} />
          <Tooltip
            formatter={(value) => [fmtPct(value), 'OTIF']}
            labelFormatter={(label, payload) => `${label} · ${payload?.[0]?.payload?.count ?? 0} PSS`}
            contentStyle={{ borderRadius: 10, border: '1px solid #E5E3DE', fontSize: 12 }}
          />
          <ReferenceLine x={target} stroke={TARGET} strokeDasharray="5 4" />
          <Bar dataKey="otif" radius={[0, 6, 6, 0]} barSize={18} minPointSize={3} isAnimationActive={false}>
            {data.map(row => <Cell key={row.name} fill={colorOf(row.otif)} />)}
            <LabelList
              dataKey="otif"
              position="right"
              content={(props: any) => {
                const row = data[props.index]
                return (
                  <text x={props.x + props.width + 6} y={props.y + props.height / 2 + 4} fontSize={11} fill="#374151" fontWeight={600}>
                    {fmtPct(row?.otif)} <tspan fill="#9CA3AF" fontWeight={400}>({row?.count})</tspan>
                  </text>
                )
              }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
