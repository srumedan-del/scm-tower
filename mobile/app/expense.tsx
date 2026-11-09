import { useState } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { enqueue } from '../src/queue'
import { currentPosition } from '../src/tracker'
import { Button, ChoiceRow, ErrorText, Field, PhotoField, Screen } from '../src/ui'

const TYPES = ['Tol', 'Parkir', 'Tambal Ban', 'Retribusi', 'Lainnya']

export default function ExpenseScreen() {
  const { tripNo } = useLocalSearchParams<{ tripNo: string }>()
  const router = useRouter()
  const [expenseType, setExpenseType] = useState(TYPES[0])
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [photo, setPhoto] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit() {
    const amountValue = Number(amount.replace(/\D/g, ''))
    if (!(amountValue > 0)) return setError('Nominal wajib diisi')
    if (expenseType === 'Lainnya' && !notes.trim()) return setError('Tulis keterangan biaya')

    setBusy(true)
    const position = await currentPosition()
    enqueue('expense', `${expenseType} Rp ${amountValue.toLocaleString('id-ID')}`, {
      trip_id: tripNo,
      expense_type: expenseType,
      amount_rupiah: amountValue,
      notes,
      receipt_photo_url: photo || undefined,
      lat: position?.lat,
      lng: position?.lng,
      recorded_at: new Date().toISOString(),
    })
    router.back()
  }

  return (
    <Screen>
      <ChoiceRow label="Jenis biaya" options={TYPES} value={expenseType} onChange={setExpenseType} />
      <Field label="Nominal (Rp)" value={amount} onChangeText={setAmount} keyboardType="number-pad" />
      <PhotoField label="Foto bukti (opsional)" value={photo} onChange={setPhoto} />
      <Field label="Keterangan" value={notes} onChangeText={setNotes} multiline />
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Button label="Simpan Biaya" busy={busy} onPress={submit} />
    </Screen>
  )
}
