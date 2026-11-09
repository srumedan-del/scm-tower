import { useState } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { enqueue } from '../src/queue'
import { currentPosition } from '../src/tracker'
import { Button, ChoiceRow, ErrorText, Field, PhotoField, Screen } from '../src/ui'

const FUEL_TYPES = ['Bio Solar', 'Dexlite', 'Pertamina Dex', 'Pertalite', 'Pertamax']

export default function FuelScreen() {
  const { tripNo } = useLocalSearchParams<{ tripNo: string }>()
  const router = useRouter()
  const [spbu, setSpbu] = useState('')
  const [fuelType, setFuelType] = useState(FUEL_TYPES[0])
  const [liters, setLiters] = useState('')
  const [amount, setAmount] = useState('')
  const [odometer, setOdometer] = useState('')
  const [odoPhoto, setOdoPhoto] = useState('')
  const [receiptPhoto, setReceiptPhoto] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit() {
    const litersValue = Number(liters.replace(',', '.'))
    const amountValue = Number(amount.replace(/\D/g, ''))
    if (!spbu.trim()) return setError('Nama SPBU wajib diisi')
    if (!(litersValue > 0) || !(amountValue > 0)) return setError('Liter dan nominal wajib diisi')
    if (!odoPhoto || !receiptPhoto) return setError('Foto odometer dan foto struk wajib diambil')

    setBusy(true)
    const position = await currentPosition()
    enqueue('fuel', `BBM ${litersValue} liter`, {
      trip_id: tripNo,
      spbu_name_location: spbu.trim(),
      spbu_latitude: position?.lat,
      spbu_longitude: position?.lng,
      fuel_type: fuelType,
      liters: litersValue,
      amount_rupiah: amountValue,
      odometer_after: odometer ? parseInt(odometer, 10) : undefined,
      photo_odometer_after_url: odoPhoto,
      photo_receipt_url: receiptPhoto,
      logged_at: new Date().toISOString(),
    })
    router.back()
  }

  return (
    <Screen>
      <Field label="Nama SPBU" value={spbu} onChangeText={setSpbu} autoCapitalize="words" />
      <ChoiceRow label="Jenis BBM" options={FUEL_TYPES} value={fuelType} onChange={setFuelType} />
      <Field label="Jumlah liter" value={liters} onChangeText={setLiters} keyboardType="decimal-pad" />
      <Field label="Nominal (Rp)" value={amount} onChangeText={setAmount} keyboardType="number-pad" />
      <Field label="Odometer (KM)" value={odometer} onChangeText={setOdometer} keyboardType="number-pad" />
      <PhotoField label="Foto odometer" value={odoPhoto} onChange={setOdoPhoto} />
      <PhotoField label="Foto struk" value={receiptPhoto} onChange={setReceiptPhoto} />
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Button label="Simpan BBM" busy={busy} onPress={submit} />
    </Screen>
  )
}
