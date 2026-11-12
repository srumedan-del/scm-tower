import { useState } from 'react'
import { Alert, StyleSheet, Text } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { enqueue } from '../../src/queue'
import { findStop, isLastOpenStop } from '../../src/trips'
import { Button, Card, ChoiceRow, ErrorText, Field, Notice, PhotoField, Screen, notifySaved } from '../../src/ui'
import { colors } from '../../src/theme'

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

  function save() {
    enqueue('failed', `Gagal kirim ${stop.reference_no}`, {
      shipment_id: stop.id,
      failure_reason: reason,
      notes,
      photo_url: photo,
      failed_at: new Date().toISOString(),
    })
    notifySaved(`${stop.reference_no} dicatat gagal kirim`)
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

  function submit() {
    if (!photo) return setError('Foto bukti wajib diambil')
    if (reason === 'Lainnya' && !notes.trim()) return setError('Tulis alasan gagal kirim di catatan')
    Alert.alert('Catat gagal kirim?', `${stop.customer_name ?? stop.reference_no}\nAlasan: ${reason}\n\nBarang dibawa kembali ke gudang.`, [
      { text: 'Batal', style: 'cancel' },
      { text: 'Ya, catat', style: 'destructive', onPress: save },
    ])
  }

  return (
    <Screen footer={<Button label="Simpan Gagal Kirim" tone="danger" onPress={submit} />}>
      <Card>
        <Text style={styles.title}>{stop.customer_name}</Text>
        <Text style={styles.meta}>{stop.reference_no}</Text>
      </Card>
      <Notice tone="warning">Hubungi admin sebelum mencatat gagal kirim, bila memungkinkan.</Notice>
      <ChoiceRow label="Alasan" options={REASONS} value={reason} onChange={setReason} />
      <PhotoField label="Foto bukti (lokasi, toko tutup, atau barang)" value={photo} onChange={setPhoto} />
      <Field label={reason === 'Lainnya' ? 'Catatan (wajib)' : 'Catatan (opsional)'} value={notes} onChangeText={setNotes} multiline />
      {error ? <ErrorText>{error}</ErrorText> : null}
    </Screen>
  )
}

const styles = StyleSheet.create({
  title: { fontSize: 17, fontWeight: '700', color: colors.text },
  meta: { fontSize: 14, color: colors.textSoft },
})
