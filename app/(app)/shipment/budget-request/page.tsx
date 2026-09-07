'use client'

import { useEffect, useState, useTransition } from 'react'
import {
  getBudgetRequests, getRealizationSummary,
  type BudgetRequestRow, type RealizationSummary,
} from './actions'
import BudgetRequestPanel from '@/components/budget-request/BudgetRequestPanel'
import { Plus, FileText, TrendingUp, Banknote } from 'lucide-react'

function fmtRp(v: number | null | undefined) {
  if (v == null) return '—'
  return 'Rp ' + Math.round(v).toLocaleString('id-ID')
}

function periodLabel(p: string) {
  const [y, m] = p.split('-')
  return new Date(Number(y), Number(m) - 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
}

export default function BudgetRequestPage() {
  const [rows, setRows]         = useState<BudgetRequestRow[]>([])
  const [selected, setSelected] = useState<BudgetRequestRow | null>(null)
  const [adding, setAdding]     = useState(false)
  const [loading, startLoad]    = useTransition()
  const [avail, setAvail]       = useState<boolean | null>(null)

  // Realisasi bulan berjalan (preview)
  const [curPeriod] = useState(() => new Date().toISOString().slice(0, 7))
  const [curRealiz, setCurRealiz] = useState<RealizationSummary | null>(null)

  function load() {
    startLoad(async () => {
      try {
        const data = await getBudgetRequests()
        setRows(data)
        setAvail(true)
        // Ambil realisasi bulan berjalan
        try {
          const r = await getRealizationSummary(curPeriod)
          setCurRealiz(r)
        } catch { /* ignore */ }
      } catch (e: any) {
        if (e.message?.includes('schema cache') || e.message?.includes('relation')) setAvail(false)
        else setAvail(true)
      }
    })
  }

  useEffect(() => { load() }, [])

  return (
    <div className="space-y-4">
      {/* Header */}
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">PENGAJUAN DANA</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Biaya Kirim Internal — Proyeksi &amp; Realisasi Bulanan
          </p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500"
        >
          <Plus className="h-4 w-4" /> Buat Pengajuan
        </button>
      </header>

      {/* Schema belum ada */}
      {avail === false && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <strong>Tabel Budget Request belum dibuat.</strong> Jalankan{' '}
          <code className="bg-amber-100 px-1 rounded font-mono">supabase/schema_v15.sql</code>{' '}
          di Supabase SQL Editor terlebih dahulu.
        </div>
      )}

      {/* Realisasi bulan berjalan */}
      {avail === true && curRealiz && curRealiz.shipment_count > 0 && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-indigo-800 mb-3">
            <TrendingUp className="h-4 w-4" />
            Realisasi Biaya Bulan Berjalan — {periodLabel(curPeriod)}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-white border border-indigo-100 p-3">
              <div className="text-xs text-gray-500">DK (Dalam Kota)</div>
              <div className="text-lg font-bold text-gray-800">{fmtRp(curRealiz.dk_total)}</div>
            </div>
            <div className="rounded-lg bg-white border border-indigo-100 p-3">
              <div className="text-xs text-gray-500">LK (Luar Kota)</div>
              <div className="text-lg font-bold text-gray-800">{fmtRp(curRealiz.lk_total)}</div>
            </div>
            <div className="rounded-lg bg-white border border-indigo-100 p-3">
              <div className="text-xs text-gray-500">Total ({curRealiz.shipment_count} shipment)</div>
              <div className="text-lg font-bold text-indigo-700">{fmtRp(curRealiz.grand_total)}</div>
            </div>
          </div>
          <div className="mt-2 text-xs text-indigo-600">
            * Dari shipment_tracking transporter Internal yang sudah terisi biaya. Belum termasuk shipment yang belum diinput biayanya.
          </div>
        </div>
      )}

      {/* Daftar pengajuan */}
      <div className="bg-white border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-600">Periode</th>
              <th className="text-right px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-600">Proyeksi DK</th>
              <th className="text-right px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-600">Proyeksi LK</th>
              <th className="text-right px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-600">Buffer SCM</th>
              <th className="text-right px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-600">Subtotal Pengajuan</th>
              <th className="text-right px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-600 whitespace-nowrap">Final Pengajuan</th>
              <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-600">Bank</th>
              <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-600">Catatan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400 text-sm">Memuat...</td></tr>
            )}
            {!loading && rows.length === 0 && avail !== false && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-gray-400 text-sm">
                  Belum ada pengajuan dana. Klik <strong>+ Buat Pengajuan</strong>.
                </td>
              </tr>
            )}
            {rows.map(r => {
              const subtotal = (r.lk_amount_projected ?? 0) + (r.dk_amount_projected ?? 0) + (r.buffer_amount ?? 0)
              return (
                <tr
                  key={r.id}
                  onClick={() => setSelected(r)}
                  className="hover:bg-blue-50 cursor-pointer"
                >
                  <td className="px-4 py-2.5">
                    <div className="font-semibold">{periodLabel(r.period)}</div>
                    <div className="text-xs text-gray-400 font-mono">{r.period}</div>
                  </td>
                  <td className="px-4 py-2.5 text-right text-xs">{fmtRp(r.dk_amount_projected)}</td>
                  <td className="px-4 py-2.5 text-right text-xs">{fmtRp(r.lk_amount_projected)}</td>
                  <td className="px-4 py-2.5 text-right text-xs">{fmtRp(r.buffer_amount)}</td>
                  <td className="px-4 py-2.5 text-right text-xs font-medium">{fmtRp(subtotal)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <span className="font-bold text-indigo-700">{fmtRp(r.rounded_request_amount)}</span>
                  </td>
                  <td className="px-4 py-2.5 text-xs">
                    {r.bank_name ? (
                      <div>
                        <div className="font-medium">{r.bank_name}</div>
                        <div className="font-mono text-gray-500">{r.bank_account_no}</div>
                      </div>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-500 max-w-[160px] truncate">{r.notes ?? '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Info */}
      {avail === true && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-xs text-gray-500 space-y-1">
          <div className="font-semibold text-gray-700 mb-1 flex items-center gap-1">
            <FileText className="h-3.5 w-3.5" /> Alur Pengajuan Dana
          </div>
          <div>1. Hitung realisasi bulan sebelumnya dari data shipment_tracking (otomatis di atas)</div>
          <div>2. Input proyeksi DK + LK bulan berjalan &amp; buffer SCM → kalkulasi subtotal otomatis</div>
          <div>3. Tentukan nilai pengajuan final (pembulatan ke atas)</div>
          <div>4. Isi approval checklist: Kepala Gudang → Supervisor → Finance Pusat</div>
          <div>5. Export dokumen teks untuk dikirim ke finance pusat</div>
        </div>
      )}

      {(selected || adding) && (
        <BudgetRequestPanel
          request={selected}
          onClose={() => { setSelected(null); setAdding(false) }}
          onSaved={() => { setSelected(null); setAdding(false); load() }}
        />
      )}
    </div>
  )
}
