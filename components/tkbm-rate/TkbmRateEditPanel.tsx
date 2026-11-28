'use client'

import { DialogShell, DialogHeader, dialogBodyClass, dialogFooterClass, dialogPrimaryClass, dialogDangerClass, FormField as Field, DialogCancelButton } from '@/components/ui/FormDialog'
import { HandCoins } from 'lucide-react'
import { useEffect, useState, useTransition } from 'react'
import SearchableSelect from '@/components/ui/SearchableSelect'
import {
  upsertTkbmRate, deleteTkbmRate, getTkbmCustomerOptions,
  type TkbmRateRow, type TkbmRateType, type TkbmCustomerOption,
} from '@/app/(app)/master-data/tkbm-rate/actions'
import { confirmAction, showSuccess } from '@/lib/feedback'

export function formatTkbmRate(rate: Pick<TkbmRateRow, 'amount' | 'rate_type'>) {
  return `Rp${Number(rate.amount).toLocaleString('id-ID')}${rate.rate_type === 'per_koli' ? '/koli' : '/bulan'}`
}

type Form = {
  customer_code: string
  customer_name: string
  rate_type: TkbmRateType
  amount: string
  effective_from: string
  is_active: boolean
  notes: string
}

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })

export default function TkbmRateEditPanel({
  rate, onClose, onSaved,
}: {
  rate: TkbmRateRow | null
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState<Form>(() => rate ? {
    customer_code: rate.customer_code ?? '',
    customer_name: rate.customer_name,
    rate_type: rate.rate_type,
    amount: String(rate.amount),
    effective_from: rate.effective_from,
    is_active: rate.is_active,
    notes: rate.notes ?? '',
  } : {
    customer_code: '', customer_name: '', rate_type: 'per_koli', amount: '',
    effective_from: today(), is_active: true, notes: '',
  })
  const [customers, setCustomers] = useState<TkbmCustomerOption[]>([])
  const [saving, startSaving] = useTransition()
  const [deleting, startDeleting] = useTransition()
  const [err, setErr] = useState<string | null>(null)
  const up = <K extends keyof Form>(k: K, v: Form[K]) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    getTkbmCustomerOptions().then(setCustomers).catch(() => setCustomers([]))
  }, [])

  const customerOptions = customers.map(c => ({ value: c.customer_code, label: `${c.customer_code} · ${c.customer_name}` }))
  if (form.customer_code && !customers.some(c => c.customer_code === form.customer_code)) {
    customerOptions.unshift({ value: form.customer_code, label: `${form.customer_code} · ${form.customer_name}` })
  }

  function pickCustomer(code: string) {
    const found = customers.find(c => c.customer_code === code)
    setForm(f => ({ ...f, customer_code: code, customer_name: found?.customer_name ?? f.customer_name }))
  }

  async function del() {
    if (!rate) return
    if (!(await confirmAction({ title: 'Hapus tarif TKBM?', message: `Tarif ${rate.customer_name} (${formatTkbmRate(rate)}) akan dihapus.` }))) return
    startDeleting(async () => {
      try { await deleteTkbmRate(rate.id); onSaved(); void showSuccess({ title: 'Tarif TKBM dihapus' }) }
      catch (e: any) { setErr(e.message) }
    })
  }

  function save() {
    startSaving(async () => {
      setErr(null)
      const amount = Number(form.amount.replace(/\./g, '').replace(',', '.'))
      if (!form.customer_name.trim()) { setErr('Nama customer wajib diisi'); return }
      if (!form.amount.trim() || !Number.isFinite(amount) || amount < 0) { setErr('Tarif harus angka 0 atau lebih'); return }
      try {
        await upsertTkbmRate({
          id: rate?.id,
          customer_code: form.customer_code || null,
          customer_name: form.customer_name,
          rate_type: form.rate_type,
          amount,
          effective_from: form.effective_from,
          is_active: form.is_active,
          notes: form.notes || null,
        })
        onSaved(); void showSuccess({ title: 'Tarif TKBM tersimpan', message: form.customer_name.toUpperCase() })
      } catch (e: any) { setErr(e.message) }
    })
  }

  return (
    <DialogShell onClose={onClose} size="2xl">
      <DialogHeader title={rate ? 'Edit Tarif TKBM' : 'Tambah Tarif TKBM'} subtitle={rate ? rate.customer_name : 'Biaya bongkar muat di tujuan'} icon={HandCoins} />

      <div className={dialogBodyClass}>
        <Field label="Customer (dari Master Customer)">
          <SearchableSelect
            value={form.customer_code}
            onChange={pickCustomer}
            options={customerOptions}
            placeholder="Pilih customer"
            className="inp"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Kode customer">
            <input value={form.customer_code} onChange={e => up('customer_code', e.target.value.toUpperCase())}
              className="inp font-mono" placeholder="Kosongkan bila belum ada" />
          </Field>
          <Field label="Nama customer *">
            <input value={form.customer_name} onChange={e => up('customer_name', e.target.value)} className="inp" />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Jenis tarif">
            <select value={form.rate_type} onChange={e => up('rate_type', e.target.value as TkbmRateType)} className="inp">
              <option value="per_koli">Per koli</option>
              <option value="per_bulan">Flat per bulan</option>
            </select>
          </Field>
          <Field label={form.rate_type === 'per_koli' ? 'Tarif per koli (Rp) *' : 'Tarif per bulan (Rp) *'}>
            <input value={form.amount} onChange={e => up('amount', e.target.value)} inputMode="numeric" className="inp text-right" placeholder="2500" />
          </Field>
          <Field label="Berlaku sejak *">
            <input type="date" value={form.effective_from} onChange={e => up('effective_from', e.target.value)} className="inp" />
          </Field>
        </div>
        <p className="text-xs text-slate-500">
          {form.rate_type === 'per_koli'
            ? 'Biaya = total koli PSS × tarif per koli.'
            : 'Biaya = tarif flat untuk setiap bulan yang ada pengiriman ke customer ini.'}
          {' '}Bila tarif naik, tambahkan baris baru dengan tanggal berlaku baru agar riwayat tarif lama tetap tersimpan.
        </p>
        <Field label="Catatan">
          <textarea value={form.notes} onChange={e => up('notes', e.target.value)} className="inp" rows={2} />
        </Field>
        <Field label="Status">
          <label className="flex items-center gap-2 mt-1">
            <input type="checkbox" checked={form.is_active} onChange={e => up('is_active', e.target.checked)} />
            <span className="text-sm">Aktif</span>
          </label>
        </Field>
        {err && <p className="text-red-600 text-sm bg-red-50 rounded p-2">{err}</p>}
      </div>

      <div className={dialogFooterClass}>
        <div>
          {rate && (
            <button onClick={del} disabled={deleting} className={dialogDangerClass}>
              {deleting ? 'Menghapus…' : 'Hapus'}
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <DialogCancelButton onClose={onClose} />
          <button onClick={save} disabled={saving} className={dialogPrimaryClass} data-busy={saving}>
            {saving ? 'Menyimpan…' : 'Simpan'}
          </button>
        </div>
      </div>
    </DialogShell>
  )
}
