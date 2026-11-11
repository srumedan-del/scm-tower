'use client'

import { useRef, useState, useTransition, type FormEvent } from 'react'
import { AlertCircle, Building2, Hash, Loader2, Lock, Package, Store, Trash2, Truck, Warehouse } from 'lucide-react'
import { upsertVendor, deleteVendor } from '@/app/(app)/vendor/actions'
import { confirmAction, showSuccess } from '@/lib/feedback'
import { FormDialog, FormField, FormSection, formControlClass } from '@/components/ui/FormDialog'

type Vendor = {
  id: number
  vendor_code: string
  vendor_name: string
  vendor_type: string | null
  pic_name: string | null
  phone: string | null
  email: string | null
  coverage_area: string | null
  default_sla: number | null
  is_active: boolean | null
  tkbm_included?: boolean | null
}

type VendorForm = Omit<Vendor, 'id' | 'vendor_code'>
type FieldErrors = { vendor_name?: string; email?: string }

const VENDOR_TYPES = [
  { value: 'TRUCKING', label: 'Trucking', icon: Truck },
  { value: 'COURIER', label: 'Courier', icon: Package },
  { value: 'INTERNAL', label: 'Internal', icon: Warehouse },
  { value: 'RETAIL', label: 'Retail', icon: Store },
]

const EMPTY_FORM: VendorForm = {
  vendor_name: '', vendor_type: 'TRUCKING',
  pic_name: '', phone: '', email: '', coverage_area: '',
  default_sla: null, is_active: true, tkbm_included: false,
}

function toForm(vendor: Vendor | null): VendorForm {
  if (!vendor) return { ...EMPTY_FORM }
  return {
    vendor_name:   vendor.vendor_name   ?? '',
    vendor_type:   vendor.vendor_type   ?? 'TRUCKING',
    pic_name:      vendor.pic_name      ?? '',
    phone:         vendor.phone         ?? '',
    email:         vendor.email         ?? '',
    coverage_area: vendor.coverage_area ?? '',
    default_sla:   vendor.default_sla,
    is_active:     vendor.is_active     ?? true,
    tkbm_included: vendor.tkbm_included ?? false,
  }
}

export default function VendorEditPanel({
  vendor, onClose, onSaved,
}: {
  vendor: Vendor | null
  onClose: () => void
  onSaved: () => void
}) {
  const [initialForm] = useState(() => toForm(vendor))
  const [form, setForm] = useState(initialForm)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [err, setErr] = useState<string | null>(null)
  const [saving, startSaving] = useTransition()
  const [deleting, startDeleting] = useTransition()
  const nameRef = useRef<HTMLInputElement>(null)
  const emailRef = useRef<HTMLInputElement>(null)
  const busy = saving || deleting

  function up<K extends keyof VendorForm>(key: K, value: VendorForm[K]) {
    setForm(current => ({ ...current, [key]: value }))
    if (key === 'vendor_name' || key === 'email') setErrors(current => ({ ...current, [key]: undefined }))
  }

  async function requestClose() {
    if (busy) return
    const dirty = JSON.stringify(form) !== JSON.stringify(initialForm)
    if (dirty && !(await confirmAction({
      title: 'Buang perubahan?',
      message: 'Data yang sudah diisi belum tersimpan.',
      confirmLabel: 'Ya, Buang',
    }))) return
    onClose()
  }

  async function del() {
    if (!vendor) return
    if (!(await confirmAction({ title: 'Hapus vendor?', message: `Vendor ${vendor.vendor_code} akan dihapus.` }))) return
    startDeleting(async () => {
      try {
        await deleteVendor(vendor.id)
        onClose()
        void showSuccess({
          title: 'Vendor dihapus',
          details: [{ label: 'Kode vendor', value: vendor.vendor_code }, { label: 'Nama', value: vendor.vendor_name }],
        }).then(onSaved)
      } catch (e: any) {
        setErr(e.message)
      }
    })
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const vendorName = form.vendor_name.trim().toUpperCase()
    const email = (form.email ?? '').trim().toLowerCase()
    const nextErrors: FieldErrors = {}
    if (!vendorName) nextErrors.vendor_name = 'Nama vendor wajib diisi.'
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) nextErrors.email = 'Format email belum benar.'
    setErrors(nextErrors)
    if (nextErrors.vendor_name) return nameRef.current?.focus()
    if (nextErrors.email) return emailRef.current?.focus()

    startSaving(async () => {
      setErr(null)
      try {
        const { vendor_code } = await upsertVendor({
          id: vendor?.id ?? 0,
          vendor_name:   vendorName,
          vendor_type:   form.vendor_type || null,
          pic_name:      (form.pic_name ?? '').trim().toUpperCase() || null,
          phone:         (form.phone ?? '').trim() || null,
          email:         email || null,
          coverage_area: (form.coverage_area ?? '').trim().toUpperCase() || null,
          default_sla:   form.default_sla == null || Number.isNaN(Number(form.default_sla)) ? null : Number(form.default_sla),
          is_active:     !!form.is_active,
          tkbm_included: form.vendor_type === 'TRUCKING' ? !!form.tkbm_included : false,
        })
        onClose()
        void showSuccess({
          title: vendor ? 'Perubahan tersimpan' : 'Vendor berhasil ditambahkan',
          details: [
            { label: 'Kode vendor', value: vendor_code },
            { label: 'Nama', value: vendorName },
            { label: 'Tipe', value: VENDOR_TYPES.find(type => type.value === form.vendor_type)?.label ?? form.vendor_type ?? '-' },
          ],
        }).then(onSaved)
      } catch (e: any) {
        setErr(e.message)
      }
    })
  }

  return (
    <FormDialog
      title={vendor ? 'Edit Vendor' : 'Tambah Vendor'}
      subtitle={vendor ? vendor.vendor_name : 'Daftarkan vendor transport baru'}
      icon={Building2}
      onClose={requestClose}
      onSubmit={save}
      footer={
        <>
          <div>
            {vendor && (
              <button
                type="button"
                onClick={del}
                disabled={busy}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                {deleting ? 'Menghapus…' : 'Hapus'}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={requestClose}
              disabled={busy}
              className="min-h-11 rounded-xl border border-gray-300 bg-white px-5 text-sm font-medium text-slate-700 transition-colors hover:bg-gray-100 disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {saving ? 'Menyimpan…' : vendor ? 'Simpan Perubahan' : 'Simpan Vendor'}
            </button>
          </div>
        </>
      }
    >
      <FormSection title="Identitas">
        <div>
          <span className="mb-1.5 block text-[13px] font-medium text-slate-700">Kode vendor</span>
          {vendor ? (
            <div className="flex h-11 items-center gap-2.5 rounded-xl border border-gray-200 bg-gray-50 px-3.5">
              <Lock className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              <span className="font-mono text-sm font-medium text-slate-700">{vendor.vendor_code}</span>
            </div>
          ) : (
            <div className="flex h-11 items-center gap-2.5 rounded-xl border border-dashed border-gold-400 bg-gold-50 px-3.5">
              <Hash className="h-4 w-4 shrink-0 text-gold-700" aria-hidden="true" />
              <span className="text-sm font-medium text-gold-800">Dibuat otomatis saat disimpan</span>
            </div>
          )}
        </div>

        <FormField label="Nama vendor" required error={errors.vendor_name}>
          <input
            ref={nameRef}
            data-autofocus
            value={form.vendor_name}
            onChange={e => up('vendor_name', e.target.value)}
            aria-invalid={!!errors.vendor_name}
            aria-required="true"
            className={formControlClass}
            placeholder="PT. Nama Perusahaan"
          />
        </FormField>

        <fieldset>
          <legend className="mb-1.5 block text-[13px] font-medium text-slate-700">Tipe vendor</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {VENDOR_TYPES.map(({ value, label, icon: Icon }) => (
              <label key={value} className="cursor-pointer">
                <input
                  type="radio"
                  name="vendor_type"
                  value={value}
                  checked={form.vendor_type === value}
                  onChange={() => up('vendor_type', value)}
                  className="peer sr-only"
                />
                <span className="flex h-11 items-center justify-center gap-2 rounded-xl border border-gray-300 text-sm font-medium text-slate-600 transition-colors hover:border-gold-400 peer-checked:border-indigo-600 peer-checked:bg-indigo-50 peer-checked:text-indigo-800 peer-focus-visible:ring-2 peer-focus-visible:ring-gold-400">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {label}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </FormSection>

      <FormSection title="Kontak">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Nama PIC">
            <input value={form.pic_name ?? ''} onChange={e => up('pic_name', e.target.value)} className={formControlClass} placeholder="Nama penanggung jawab" />
          </FormField>
          <FormField label="Telepon">
            <input type="tel" value={form.phone ?? ''} onChange={e => up('phone', e.target.value)} className={formControlClass} placeholder="+62 ..." />
          </FormField>
        </div>
        <FormField label="Email" error={errors.email}>
          <input
            ref={emailRef}
            type="email"
            value={form.email ?? ''}
            onChange={e => up('email', e.target.value)}
            aria-invalid={!!errors.email}
            className={formControlClass}
            placeholder="pic@perusahaan.com"
          />
        </FormField>
      </FormSection>

      <FormSection title="Operasional">
        <FormField label="Area layanan" hint="Pisahkan dengan koma jika lebih dari satu.">
          <input value={form.coverage_area ?? ''} onChange={e => up('coverage_area', e.target.value)} className={formControlClass} placeholder="Medan, Banda Aceh" />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="SLA default">
            <span className="relative block">
              <input
                type="number"
                min={0}
                value={form.default_sla ?? ''}
                onChange={e => up('default_sla', e.target.value === '' ? null : Number(e.target.value))}
                className={`${formControlClass} pr-14`}
                placeholder="0"
              />
              <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-sm text-slate-500">hari</span>
            </span>
          </FormField>
          <div>
            <span className="mb-1.5 block text-[13px] font-medium text-slate-700">Status</span>
            <label className="flex h-11 cursor-pointer items-center gap-3 rounded-xl border border-gray-300 px-3.5">
              <input
                type="checkbox"
                role="switch"
                checked={!!form.is_active}
                onChange={e => up('is_active', e.target.checked)}
                className="peer sr-only"
              />
              <span
                aria-hidden="true"
                className="relative h-6 w-10 shrink-0 rounded-full bg-gray-300 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-transform peer-checked:bg-green-600 peer-checked:after:translate-x-4 peer-focus-visible:ring-2 peer-focus-visible:ring-gold-400"
              />
              <span className="text-sm font-medium text-slate-700">{form.is_active ? 'Aktif' : 'Nonaktif'}</span>
            </label>
          </div>
        </div>
        {form.vendor_type === 'TRUCKING' && (
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-300 px-3.5 py-3">
            <input
              type="checkbox"
              checked={!!form.tkbm_included}
              onChange={e => up('tkbm_included', e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-indigo-600"
            />
            <span>
              <span className="block text-sm font-medium text-slate-700">Tarif all-in, sudah termasuk TKBM</span>
              <span className="block text-xs text-slate-500">Isian TKBM di Shipment Cost disembunyikan untuk vendor ini. Kosongkan jika TKBM ditagih terpisah (mis. ASSA).</span>
            </span>
          </label>
        )}
      </FormSection>

      {err && (
        <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="[overflow-wrap:anywhere]">{err}</span>
        </div>
      )}
    </FormDialog>
  )
}
