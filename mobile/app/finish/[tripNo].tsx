import { useCallback, useEffect, useState } from 'react'
import { Alert, StyleSheet, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { enqueue } from '../../src/queue'
import { distanceMeters, freshPosition, stopTracking } from '../../src/tracker'
import { SRU_DEPOT, dropPoints, getCachedTrips, vehicleLabel } from '../../src/trips'
import { Button, Card, ErrorText, Field, InfoRow, Notice, Screen, notifySaved } from '../../src/ui'
import { colors, radius } from '../../src/theme'

// Jarak satu trip di atas ini kemungkinan salah ketik KM.
const SUSPICIOUS_DISTANCE_KM = 1500

export default function FinishScreen() {
  const { tripNo } = useLocalSearchParams<{ tripNo: string }>()
  const router = useRouter()
  const trip = getCachedTrips().find(row => row.trip_no === tripNo)
  const [odometer, setOdometer] = useState('')
  const [error, setError] = useState('')
  // Jarak ke gudang SRU (meter); null = GPS belum terbaca. Kendaraan pribadi tidak dicek.
  const [depotDistance, setDepotDistance] = useState<number | null>(null)
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null)
  const [checking, setChecking] = useState(true)
  const checkRadius = !trip?.personal_vehicle

  const locate = useCallback(async () => {
    setChecking(true)
    const here = await freshPosition()
    setPosition(here)
    setDepotDistance(here ? distanceMeters(here, SRU_DEPOT) : null)
    setChecking(false)
  }, [])

  useEffect(() => { if (checkRadius) void locate() }, [checkRadius, locate])

  if (!trip) return <Screen><Text>Trip tidak ditemukan.</Text></Screen>
  const delivered = trip.stops.filter(stop => stop.status === 'Delivered').length
  const failed = trip.stops.filter(stop => stop.status === 'Failed Delivery').length
  const dropPointCount = dropPoints(trip.stops).length
  const deliveredPoints = dropPoints(trip.stops.filter(stop => stop.status === 'Delivered')).length
  const startKm = trip.odometer_start
  const endKm = parseInt(odometer, 10)
  const distance = startKm != null && Number.isInteger(endKm) && endKm >= startKm ? endKm - startKm : null
  const insideDepot = !checkRadius || (depotDistance != null && depotDistance <= SRU_DEPOT.radiusMeters)
  const distanceText = depotDistance == null ? '' : depotDistance >= 1000 ? `${(depotDistance / 1000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} km` : `${depotDistance} m`

  async function close() {
    enqueue('trip-finish', `Tutup trip ${tripNo}`, {
      trip_id: tripNo,
      odometer_end: endKm,
      ...(position ? { latitude: position.lat, longitude: position.lng } : {}),
    })
    await stopTracking()
    notifySaved(`${tripNo} ditutup. Terima kasih!`)
    // Ringkasan hasil trip.
    Alert.alert(
      'Trip selesai',
      `${tripNo}\n\nPSS/SJ terkirim: ${delivered} dari ${trip!.stops.length}${failed ? ` (gagal ${failed})` : ''}\nDrop point: ${deliveredPoints} dari ${dropPointCount}\nJarak tempuh: ${distance != null ? `${distance.toLocaleString('id-ID')} km` : '-'}\n\nTerima kasih, hati-hati di jalan pulang!`,
      [{ text: 'OK', onPress: () => router.dismissAll() }],
    )
  }

  async function submit() {
    if (!Number.isInteger(endKm) || endKm < 0) return setError('Isi KM akhir sesuai odometer')
    if (checkRadius) {
      const here = await freshPosition()
      setPosition(here)
      const meters = here ? distanceMeters(here, SRU_DEPOT) : null
      setDepotDistance(meters)
      if (meters == null) return setError('Lokasi GPS belum terbaca. Aktifkan GPS lalu coba lagi.')
      if (meters > SRU_DEPOT.radiusMeters) return setError(`Tutup trip hanya bisa di sekitar gudang SRU (radius ${SRU_DEPOT.radiusMeters} m).`)
    }
    if (startKm != null && endKm < startKm) return setError(`KM akhir lebih kecil dari KM awal (${startKm.toLocaleString('id-ID')} KM)`)
    setError('')
    const warning = distance != null && distance > SUSPICIOUS_DISTANCE_KM ? `\n\nJarak ${distance.toLocaleString('id-ID')} KM terlihat sangat jauh. Periksa lagi angka KM.` : ''
    Alert.alert(
      'Tutup trip?',
      `KM akhir ${endKm.toLocaleString('id-ID')}${distance != null ? ` · jarak tempuh ${distance.toLocaleString('id-ID')} KM` : ''}.\nPelacakan lokasi akan dihentikan.${warning}`,
      [{ text: 'Periksa Lagi', style: 'cancel' }, { text: 'Tutup Trip', onPress: () => void close() }],
    )
  }

  return (
    <Screen footer={<Button label="Tutup Trip" busy={checking && checkRadius} disabled={!insideDepot} onPress={() => void submit()} />}>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>{tripNo}</Text>
        <View style={styles.stats}>
          <View style={styles.stat}><Text style={[styles.statValue, { color: '#9FE0BF' }]}>{delivered}</Text><Text style={styles.statLabel}>Terkirim</Text></View>
          <View style={styles.stat}><Text style={[styles.statValue, { color: '#F4B2AC' }]}>{failed}</Text><Text style={styles.statLabel}>Gagal</Text></View>
          <View style={styles.stat}><Text style={[styles.statValue, { color: '#FFFFFF' }]}>{dropPointCount}</Text><Text style={styles.statLabel}>Drop point</Text></View>
          <View style={styles.stat}><Text style={[styles.statValue, { color: colors.goldLight }]}>{distance != null ? distance.toLocaleString('id-ID') : '-'}</Text><Text style={styles.statLabel}>KM tempuh</Text></View>
        </View>
      </View>
      <Card>
        {vehicleLabel(trip) ? <InfoRow icon="car-outline" label="Kendaraan" value={vehicleLabel(trip)!} /> : null}
        {startKm != null ? <InfoRow icon="speedometer-outline" label="KM awal" value={`${startKm.toLocaleString('id-ID')} KM`} /> : null}
      </Card>
      <Notice>Tutup trip setelah kendaraan tiba di gudang SRU. Isi KM akhir sesuai angka di odometer.</Notice>
      {checkRadius && !checking && !insideDepot ? (
        <>
          <Notice tone="warning">
            {depotDistance == null
              ? 'Lokasi GPS belum terbaca. Aktifkan GPS untuk bisa menutup trip.'
              : `Anda ±${distanceText} dari gudang SRU. Tutup trip hanya bisa dalam radius ${SRU_DEPOT.radiusMeters} m dari gudang.`}
          </Notice>
          <Button label="Cek Lokasi Lagi" tone="outline" onPress={() => void locate()} />
        </>
      ) : null}
      {failed > 0 ? <Notice tone="warning">{failed} pengiriman gagal. Serahkan barangnya kembali ke gudang.</Notice> : null}
      <Field label="KM akhir (odometer)" value={odometer} onChangeText={setOdometer} keyboardType="number-pad" placeholder={startKm != null ? `Lebih dari ${startKm.toLocaleString('id-ID')}` : 'Angka di odometer'} />
      {error ? <ErrorText>{error}</ErrorText> : null}
    </Screen>
  )
}

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.midnight, borderRadius: radius.lg, padding: 16, gap: 12 },
  heroTitle: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: radius.sm, backgroundColor: colors.midnightSoft },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 12, fontWeight: '600', color: '#C9D2E0' },
})
