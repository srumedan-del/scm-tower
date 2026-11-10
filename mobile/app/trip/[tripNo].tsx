import { useState } from 'react'
import { Alert, Linking, StyleSheet, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useTrips } from '../../src/hooks'
import { enqueue } from '../../src/queue'
import { startTracking } from '../../src/tracker'
import { isStopDone, mapsUrl, vehicleLabel } from '../../src/trips'
import { Button, Card, ErrorText, Field, Screen, StatusPill } from '../../src/ui'
import { colors } from '../../src/theme'

export default function TripScreen() {
  const { tripNo } = useLocalSearchParams<{ tripNo: string }>()
  const router = useRouter()
  const { trips } = useTrips()
  const trip = trips.find(row => row.trip_no === tripNo)
  const [odometer, setOdometer] = useState('')
  const [error, setError] = useState('')

  if (!trip) return <Screen><Text style={styles.meta}>Trip tidak ditemukan.</Text></Screen>

  function start() {
    const value = parseInt(odometer, 10)
    if (!Number.isInteger(value) || value < 0) return setError('Isi odometer awal')
    setError('')
    const lastKm = trip?.last_odometer
    if (lastKm != null && value < lastKm) {
      Alert.alert(
        'KM lebih kecil dari KM terakhir',
        `KM terakhir kendaraan ini ${lastKm.toLocaleString('id-ID')}, yang diisi ${value.toLocaleString('id-ID')}. Pastikan angkanya benar.`,
        [{ text: 'Periksa Lagi', style: 'cancel' }, { text: 'Tetap Mulai', onPress: () => void beginTrip(value) }],
      )
      return
    }
    void beginTrip(value)
  }

  // Setelah trip dimulai, langsung arahkan driver ke tujuan pertama yang belum selesai.
  function openFirstDestination() {
    const next = trip?.stops.find(stop => !isStopDone(stop))
    if (!next) return
    Linking.openURL(mapsUrl(next)).catch(() => Alert.alert('Tidak bisa membuka peta', 'Pastikan Google Maps atau browser terpasang.'))
  }

  async function beginTrip(value: number) {
    enqueue('trip-start', `Mulai trip ${tripNo}`, { trip_id: tripNo, odometer_start: value })
    const tracking = await startTracking(tripNo)
    if (!tracking) {
      Alert.alert(
        'Pelacakan lokasi tidak aktif',
        'Izinkan lokasi "Sepanjang waktu" di pengaturan ponsel agar admin bisa memantau trip.',
        [{ text: 'OK', onPress: openFirstDestination }],
      )
      return
    }
    openFirstDestination()
  }

  const allDone = trip.stops.every(isStopDone)
  const vehicle = vehicleLabel(trip)

  return (
    <Screen>
      <Card>
        <Text style={styles.label}>Kendaraan</Text>
        <Text style={styles.vehicle}>{vehicle ?? 'Belum ditentukan admin'}</Text>
      </Card>
      {!trip.started_at && (
        <Card>
          {trip.last_odometer != null ? <Text style={styles.meta}>KM terakhir kendaraan: {trip.last_odometer.toLocaleString('id-ID')} KM</Text> : null}
          <Field label="Odometer awal (KM)" value={odometer} onChangeText={setOdometer} keyboardType="number-pad" />
          {error ? <ErrorText>{error}</ErrorText> : null}
          <Button label="Mulai Trip" onPress={start} />
        </Card>
      )}

      {trip.started_at && (
        <View style={styles.actions}>
          <View style={styles.action}><Button label="Scan" tone="outline" onPress={() => router.push(`/scan?tripNo=${encodeURIComponent(tripNo)}`)} /></View>
          <View style={styles.action}><Button label="BBM" tone="outline" onPress={() => router.push(`/fuel?tripNo=${encodeURIComponent(tripNo)}`)} /></View>
        </View>
      )}

      <Text style={styles.heading}>Tujuan ({trip.stops.length})</Text>
      {trip.stops.map((stop, index) => (
        <Card key={stop.id} onPress={() => router.push(`/stop/${stop.id}`)}>
          <Text style={styles.title}>{index + 1}. {stop.customer_name ?? '-'}</Text>
          <Text style={styles.meta}>{stop.reference_no} · {stop.destination_city ?? '-'}</Text>
          <StatusPill status={stop.status} />
        </Card>
      ))}

      {trip.started_at && (
        <Button label="Tutup Trip" disabled={!allDone} onPress={() => router.push(`/finish/${encodeURIComponent(tripNo)}`)} />
      )}
      {trip.started_at && !allDone && <Text style={styles.meta}>Trip bisa ditutup setelah semua tujuan selesai.</Text>}
    </Screen>
  )
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: 10 },
  action: { flex: 1 },
  heading: { fontSize: 16, fontWeight: '700', color: colors.midnight },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  meta: { fontSize: 14, color: colors.textSoft },
  label: { fontSize: 13, color: colors.textSoft },
  vehicle: { fontSize: 18, fontWeight: '700', color: colors.midnight },
})
