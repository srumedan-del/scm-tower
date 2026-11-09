import { useEffect, useState } from 'react'
import { StyleSheet, Text } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { enqueue } from '../../src/queue'
import { currentPosition, distanceMeters } from '../../src/tracker'
import { findStop } from '../../src/trips'
import { Button, ChoiceRow, ErrorText, Field, PhotoField, Screen } from '../../src/ui'
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
  const { stop } = found

  const target = stop.target_lat != null && stop.target_lng != null ? { lat: stop.target_lat, lng: stop.target_lng } : null
  const distance = position && target ? distanceMeters(position, target) : null

  function submit() {
    if (!name.trim()) return setError('Nama penerima wajib diisi')
    if (!photo) return setError('Foto bukti terima wajib diambil')
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
    router.back()
  }

  return (
    <Screen>
      <Text style={styles.title}>{stop.customer_name}</Text>
      <Text style={styles.meta}>{stop.reference_no}</Text>
      {distance != null && distance > FAR_FROM_CUSTOMER_METERS && (
        <Text style={styles.warning}>Posisi Anda sekitar {distance.toLocaleString('id-ID')} m dari lokasi customer. Pastikan tujuan sudah benar.</Text>
      )}
      <Field label="Nama penerima" value={name} onChangeText={setName} autoCapitalize="words" />
      <ChoiceRow label="Tipe penerima" options={RECEIVER_TYPES} value={receiverType} onChange={setReceiverType} />
      <PhotoField label="Foto bukti terima" value={photo} onChange={setPhoto} />
      <Field label="Catatan (opsional)" value={notes} onChangeText={setNotes} multiline />
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Button label="Simpan POD" onPress={submit} />
    </Screen>
  )
}

const styles = StyleSheet.create({
  title: { fontSize: 17, fontWeight: '700', color: colors.text },
  meta: { fontSize: 14, color: colors.textSoft },
  warning: { fontSize: 14, color: colors.warning, backgroundColor: colors.warningSoft, padding: 12, borderRadius: 10 },
})
