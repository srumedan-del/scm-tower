import { useEffect, useState } from 'react'
import { Alert, StyleSheet, Text } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { enqueue } from '../../src/queue'
import { currentPosition, distanceMeters } from '../../src/tracker'
import { findStop, isLastOpenStop } from '../../src/trips'
import { Button, Card, ChoiceRow, ErrorText, Field, Notice, PhotoField, Screen, notifySaved } from '../../src/ui'
import { colors } from '../../src/theme'

const RECEIVER_TYPES = ['Gudang Farmasi', 'Bagian Logistik', 'Perawat', 'Satpam', 'Lainnya']
const FAR_FROM_CUSTOMER_METERS = 500

export default function PodScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const found = findStop(Number(id))
  const [name, setName] = useState('')
  const [receiverType, setReceiverType] = useState(RECEIVER_TYPES[0])
  const [notes, setNotes] = useState('')
  const [photo, setPhoto] = useState('')
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null)
  const [error, setError] = useState('')

  useEffect(() => { void currentPosition().then(setPosition) }, [])

  if (!found) return <Screen><Text>Pengiriman tidak ditemukan.</Text></Screen>
  const { stop, trip } = found

  const target = stop.target_lat != null && stop.target_lng != null ? { lat: stop.target_lat, lng: stop.target_lng } : null
  const distance = position && target ? distanceMeters(position, target) : null

  function submit() {
    if (!photo) return setError('Ambil foto bukti terima (Surat Jalan yang sudah ditandatangani)')
    if (!name.trim()) return setError('Nama penerima wajib diisi')
    enqueue('pod', `POD ${stop.reference_no}`, {
      shipment_id: stop.id,
      recipient_name: name.trim(),
      receiver_type: receiverType,
      notes,
      photo_url: photo,
      distance_meters: distance ?? undefined,
      lat: position?.lat,
      lng: position?.lng,
      received_at: new Date().toISOString(),
    })
    notifySaved(`POD ${stop.reference_no} tersimpan`)
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
    <Screen footer={<><Text style={styles.step}>{photo && name.trim() ? 'Siap disimpan' : `Lengkapi: ${[!photo && 'foto', !name.trim() && 'nama penerima'].filter(Boolean).join(' dan ')}`}</Text><Button label="Simpan Bukti Terima" onPress={submit} /></>}>
      <Card>
        <Text style={styles.title}>{stop.customer_name}</Text>
        <Text style={styles.meta}>{stop.reference_no}</Text>
      </Card>
      {distance != null && distance > FAR_FROM_CUSTOMER_METERS && (
        <Notice tone="warning">Posisi Anda sekitar {distance.toLocaleString('id-ID')} m dari lokasi customer. Pastikan tujuan sudah benar.</Notice>
      )}
      <PhotoField label="1. Foto Surat Jalan yang sudah ditandatangani" value={photo} onChange={setPhoto} />
      <Field label="2. Nama penerima" value={name} onChangeText={setName} autoCapitalize="words" placeholder="Nama sesuai tanda tangan" />
      <ChoiceRow label="3. Bagian penerima" options={RECEIVER_TYPES} value={receiverType} onChange={setReceiverType} />
      <Field label="Catatan (opsional)" value={notes} onChangeText={setNotes} multiline placeholder="Mis. kemasan penyok, diterima sebagian" />
      {error ? <ErrorText>{error}</ErrorText> : null}
    </Screen>
  )
}

const styles = StyleSheet.create({
  title: { fontSize: 17, fontWeight: '700', color: colors.text },
  meta: { fontSize: 14, color: colors.textSoft },
  step: { fontSize: 13, color: colors.textSoft, textAlign: 'center' },
})
