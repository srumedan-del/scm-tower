import { useState } from 'react'
import { StyleSheet, Text } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { enqueue } from '../../src/queue'
import { stopTracking } from '../../src/tracker'
import { getCachedTrips } from '../../src/trips'
import { Button, Card, ErrorText, Field, Screen } from '../../src/ui'
import { colors } from '../../src/theme'

export default function FinishScreen() {
  const { tripNo } = useLocalSearchParams<{ tripNo: string }>()
  const router = useRouter()
  const trip = getCachedTrips().find(row => row.trip_no === tripNo)
  const [odometer, setOdometer] = useState('')
  const [error, setError] = useState('')

  if (!trip) return <Screen><Text>Trip tidak ditemukan.</Text></Screen>
  const delivered = trip.stops.filter(stop => stop.status === 'Delivered').length
  const failed = trip.stops.filter(stop => stop.status === 'Failed Delivery').length
  const startKm = trip.odometer_start
  const endKm = parseInt(odometer, 10)

  async function submit() {
    if (!Number.isInteger(endKm) || endKm < 0) return setError('Isi odometer akhir')
    if (startKm != null && endKm < startKm) return setError(`Odometer akhir lebih kecil dari odometer awal (${startKm} KM)`)
    enqueue('trip-finish', `Tutup trip ${tripNo}`, { trip_id: tripNo, odometer_end: endKm })
    await stopTracking()
    router.dismissAll()
  }

  return (
    <Screen>
      <Card>
        <Text style={styles.title}>{tripNo}</Text>
        <Text style={styles.meta}>Terkirim: {delivered} · Gagal: {failed}</Text>
        {startKm != null ? <Text style={styles.meta}>Odometer awal: {startKm.toLocaleString('id-ID')} KM</Text> : null}
        {startKm != null && endKm >= startKm ? <Text style={styles.meta}>Jarak tempuh: {(endKm - startKm).toLocaleString('id-ID')} KM</Text> : null}
      </Card>
      <Field label="Odometer akhir (KM)" value={odometer} onChangeText={setOdometer} keyboardType="number-pad" />
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Button label="Tutup Trip" onPress={submit} />
    </Screen>
  )
}

const styles = StyleSheet.create({
  title: { fontSize: 17, fontWeight: '700', color: colors.midnight },
  meta: { fontSize: 14, color: colors.textSoft },
})
