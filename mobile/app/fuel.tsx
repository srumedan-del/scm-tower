import { useState } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { enqueue } from '../src/queue'
import { currentPosition } from '../src/tracker'
import { getCachedTrips } from '../src/trips'
import { Button, ChoiceRow, ErrorText, Field, Notice, PhotoField, Screen, SectionTitle, notifySaved } from '../src/ui'

const FUEL_TYPES = ['Bio Solar', 'Dexlite', 'Pertamina Dex', 'Pertalite', 'Pertamax']

export default function FuelScreen() {
  const { tripNo } = useLocalSearchParams<{ tripNo: string }>()
  const router = useRouter()
  const startKm = getCachedTrips().find(row => row.trip_no === tripNo)?.odometer_start ?? null
  const [spbu, setSpbu] = useState('')
  const [fuelType, setFuelType] = useState(FUEL_TYPES[0])
  const [liters, setLiters] = useState('')
  const [amount, setAmount] = useState('')
  const [odometer, setOdometer] = useState('')
  const [odoPhoto, setOdoPhoto] = useState('')
  const [receiptPhoto, setReceiptPhoto] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const litersValue = Number(liters.replace(',', '.'))
  const amountValue = Number(amount.replace(/\D/g, ''))
  const pricePerLiter = litersValue > 0 && amountValue > 0 ? amountValue / litersValue : null

  async function submit() {
    const km = parseInt(odometer, 10)
    if (!spbu.trim()) return setError('Nama SPBU wajib diisi')
    if (!(litersValue > 0) || !(amountValue > 0)) return setError('Liter dan nominal wajib diisi')
    if (pricePerLiter != null && (pricePerLiter < 5_000 || pricePerLiter > 25_000)) {
      return setError(`Periksa jumlah liter. Rp ${amountValue.toLocaleString('id-ID')} untuk ${litersValue.toLocaleString('id-ID')} liter berarti Rp ${Math.round(pricePerLiter).toLocaleString('id-ID')} per liter. Gunakan koma untuk desimal, contoh 7,21.`)
    }
    if (!Number.isInteger(km) || km <= 0) return setError('Isi KM odometer saat pengisian')
    if (startKm != null && km < startKm) return setError(`KM odometer lebih kecil dari KM awal trip (${startKm.toLocaleString('id-ID')} KM)`)
    if (!odoPhoto || !receiptPhoto) return setError('Foto odometer dan foto struk wajib diambil')

    setBusy(true)
    const position = await currentPosition()
    enqueue('fuel', `BBM ${litersValue.toLocaleString('id-ID')} liter`, {
      trip_id: tripNo,
      spbu_name_location: spbu.trim(),
      spbu_latitude: position?.lat,
      spbu_longitude: position?.lng,
      fuel_type: fuelType,
      liters: litersValue,
      amount_rupiah: amountValue,
      odometer_after: km,
      photo_odometer_after_url: odoPhoto,
      photo_receipt_url: receiptPhoto,
      logged_at: new Date().toISOString(),
    })
    notifySaved('Catatan BBM tersimpan')
    router.back()
  }

  return (
    <Screen footer={<Button label="Simpan BBM" busy={busy} onPress={submit} />}>
      <SectionTitle>Pengisian</SectionTitle>
      <Field label="Nama SPBU" value={spbu} onChangeText={setSpbu} autoCapitalize="words" placeholder="Mis. SPBU 14.201.123 Tebing Tinggi" />
      <ChoiceRow label="Jenis BBM" options={FUEL_TYPES} value={fuelType} onChange={setFuelType} />
      <Field label="Jumlah liter (pakai koma untuk desimal)" value={liters} onChangeText={setLiters} keyboardType="decimal-pad" placeholder="Contoh 7,21" />
      <Field label="Nominal (Rp)" value={amount} onChangeText={setAmount} keyboardType="number-pad" placeholder="Sesuai struk" />
      {pricePerLiter != null && (
        <Notice tone={pricePerLiter < 5_000 || pricePerLiter > 25_000 ? 'warning' : 'info'}>
          Harga per liter: Rp {Math.round(pricePerLiter).toLocaleString('id-ID')}
        </Notice>
      )}
      <Field label="KM odometer" value={odometer} onChangeText={setOdometer} keyboardType="number-pad" placeholder={startKm != null ? `KM awal trip ${startKm.toLocaleString('id-ID')}` : 'Angka di odometer'} />

      <SectionTitle>Foto bukti</SectionTitle>
      <PhotoField label="Foto odometer" value={odoPhoto} onChange={setOdoPhoto} />
      <PhotoField label="Foto struk" value={receiptPhoto} onChange={setReceiptPhoto} />
      {error ? <ErrorText>{error}</ErrorText> : null}
    </Screen>
  )
}
