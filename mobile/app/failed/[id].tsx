import { useState } from 'react'
import { Alert, Text } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { enqueue } from '../../src/queue'
import { findStop, isLastOpenStop } from '../../src/trips'
import { Button, ChoiceRow, ErrorText, Field, PhotoField, Screen } from '../../src/ui'

const REASONS = ['Salah barang', 'Customer tutup', 'Alamat tidak ditemukan', 'Ditolak penerima', 'Lainnya']

export default function FailedScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const found = findStop(Number(id))
  const [reason, setReason] = useState(REASONS[0])
  const [notes, setNotes] = useState('')
  const [photo, setPhoto] = useState('')
  const [error, setError] = useState('')

  if (!found) return <Screen><Text>Pengiriman tidak ditemukan.</Text></Screen>
  const { stop, trip } = found

  function submit() {
    if (!photo) return setError('Foto bukti wajib diambil')
    enqueue('failed', `Gagal kirim ${stop.reference_no}`, {
      shipment_id: stop.id,
      failure_reason: reason,
      notes,
      photo_url: photo,
      failed_at: new Date().toISOString(),
    })
    if (isLastOpenStop(trip, stop.id)) {
      Alert.alert(
        'Semua pengiriman selesai',
        'Jangan lupa isi BBM sebelum kembali ke gudang, lalu catat pengisiannya di aplikasi.\n\nSetelah tiba di gudang SRU, tekan Tutup Trip dan isi KM akhir.',
        [
          { text: 'Nanti', style: 'cancel', onPress: () => router.back() },
          { text: 'Catat BBM', onPress: () => router.replace(`/fuel?tripNo=${encodeURIComponent(trip.trip_no)}`) },
        ],
      )
      return
    }
    router.back()
  }

  return (
    <Screen>
      <ChoiceRow label="Alasan" options={REASONS} value={reason} onChange={setReason} />
      <PhotoField label="Foto bukti" value={photo} onChange={setPhoto} />
      <Field label="Catatan (opsional)" value={notes} onChangeText={setNotes} multiline />
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Button label="Simpan Gagal Kirim" tone="danger" onPress={submit} />
    </Screen>
  )
}
