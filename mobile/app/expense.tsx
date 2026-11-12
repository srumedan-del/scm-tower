import { useState } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { EXPENSE_TYPES, type ExpenseType } from '../src/costs'
import { enqueue } from '../src/queue'
import { currentPosition } from '../src/tracker'
import { getCachedTrips } from '../src/trips'
import { Button, ChoiceRow, ErrorText, Field, Notice, PhotoField, Screen, notifySaved } from '../src/ui'

export default function ExpenseScreen() {
  const { tripNo } = useLocalSearchParams<{ tripNo: string }>()
  const router = useRouter()
  const stops = getCachedTrips().find(row => row.trip_no === tripNo)?.stops ?? []
  const [expenseType, setExpenseType] = useState<ExpenseType>('Tol')
  const [shipmentId, setShipmentId] = useState<number | null>(stops.length === 1 ? stops[0].id : null)
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [photo, setPhoto] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const isTkbm = expenseType === 'TKBM / SPSI'
  const isOther = expenseType === 'Lainnya'
  const stopLabel = (id: number) => {
    const stop = stops.find(row => row.id === id)
    return stop ? `${stop.reference_no} · ${stop.customer_name ?? ''}` : ''
  }

  async function submit() {
    const amountValue = Number(amount.replace(/\D/g, ''))
    if (!(amountValue > 0)) return setError('Nominal wajib diisi')
    if (isTkbm && !shipmentId) return setError('Pilih PSS / surat jalan untuk biaya TKBM')
    if (isOther && !notes.trim()) return setError('Tulis keterangan biaya lainnya')

    setBusy(true)
    const position = await currentPosition()
    const label = isTkbm ? `TKBM ${stops.find(row => row.id === shipmentId)?.reference_no ?? ''}` : expenseType
    enqueue('expense', `${label} Rp ${amountValue.toLocaleString('id-ID')}`, {
      trip_id: tripNo,
      expense_type: expenseType,
      amount_rupiah: amountValue,
      notes: notes.trim(),
      shipment_id: isTkbm ? shipmentId ?? undefined : undefined,
      receipt_photo_url: photo || undefined,
      lat: position?.lat,
      lng: position?.lng,
      recorded_at: new Date().toISOString(),
    })
    notifySaved('Biaya tersimpan')
    router.back()
  }

  return (
    <Screen footer={<Button label="Simpan Biaya" busy={busy} onPress={submit} />}>
      <ChoiceRow label="Jenis biaya" options={[...EXPENSE_TYPES]} value={expenseType} onChange={value => { setExpenseType(value as ExpenseType); setError('') }} />
      {isTkbm && (
        stops.length ? (
          <ChoiceRow
            label="PSS / surat jalan"
            options={stops.map(stop => stopLabel(stop.id))}
            value={shipmentId ? stopLabel(shipmentId) : ''}
            onChange={value => setShipmentId(stops.find(stop => stopLabel(stop.id) === value)?.id ?? null)}
          />
        ) : <Notice tone="warning">Data PSS trip belum tersedia. Tarik layar Trip untuk memuat ulang.</Notice>
      )}
      <Field label="Nominal (Rp)" value={amount} onChangeText={setAmount} keyboardType="number-pad" placeholder="Sesuai kwitansi" />
      <PhotoField label="Foto bukti / kwitansi (opsional)" value={photo} onChange={setPhoto} />
      <Field
        label={isOther ? 'Keterangan (wajib)' : 'Keterangan (opsional)'}
        value={notes}
        onChangeText={setNotes}
        multiline
        placeholder={isOther ? 'Mis. tambal ban, retribusi, cuci mobil' : expenseType === 'Hotel' ? 'Nama hotel dan jumlah malam' : ''}
      />
      {error ? <ErrorText>{error}</ErrorText> : null}
    </Screen>
  )
}
