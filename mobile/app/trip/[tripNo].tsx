import { useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useTrips } from '../../src/hooks'
import { enqueue } from '../../src/queue'
import { startTracking } from '../../src/tracker'
import { isStopDone, nextStop, vehicleLabel, type Stop } from '../../src/trips'
import { ActionTile, Button, Card, ErrorText, Field, InfoRow, Notice, ProgressBar, Screen, SectionTitle, StatusPill, notifySaved } from '../../src/ui'
import { colors, radius } from '../../src/theme'

function StopRow({ stop, index, isNext, isLast, onPress }: { stop: Stop; index: number; isNext: boolean; isLast: boolean; onPress: () => void }) {
  const done = isStopDone(stop)
  const failed = stop.status === 'Failed Delivery'
  const dotStyle = done ? (failed ? styles.dotFailed : styles.dotDone) : isNext ? styles.dotNext : styles.dotTodo
  return (
    <View style={styles.stopRow}>
      <View style={styles.rail}>
        <View style={[styles.dot, dotStyle]}>
          {done
            ? <Ionicons name={failed ? 'close' : 'checkmark'} size={14} color="#FFFFFF" />
            : <Text style={[styles.dotText, isNext && styles.dotTextNext]}>{index + 1}</Text>}
        </View>
        {!isLast ? <View style={[styles.line, done && styles.lineDone]} /> : null}
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [styles.stopCard, isNext && styles.stopCardNext, pressed && styles.stopCardPressed]}
      >
        {isNext ? <Text style={styles.nextLabel}>Tujuan berikutnya</Text> : null}
        <Text style={styles.stopName}>{stop.customer_name ?? '-'}</Text>
        <Text style={styles.meta}>{stop.reference_no} · {stop.destination_city ?? '-'}</Text>
        <View style={styles.stopFooter}>
          <StatusPill status={stop.status} />
          <Ionicons name="chevron-forward" size={18} color={colors.textSoft} />
        </View>
      </Pressable>
    </View>
  )
}

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
    if (!Number.isInteger(value) || value < 0) return setError('Isi KM awal sesuai odometer kendaraan')
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

  async function beginTrip(value: number) {
    enqueue('trip-start', `Mulai trip ${tripNo}`, { trip_id: tripNo, odometer_start: value })
    notifySaved('Trip dimulai. Hati-hati di jalan.')
    const tracking = await startTracking(tripNo)
    if (!tracking) {
      Alert.alert('Pelacakan lokasi tidak aktif', 'Izinkan lokasi "Sepanjang waktu" di pengaturan ponsel agar admin bisa memantau trip.')
    }
  }

  const started = Boolean(trip.started_at)
  const next = nextStop(trip)
  const done = trip.stops.filter(isStopDone).length
  const allDone = !next
  const vehicle = vehicleLabel(trip)
  const encodedTrip = encodeURIComponent(tripNo)

  const footer = !started ? (
    <>
      <Field label="KM awal (odometer)" value={odometer} onChangeText={setOdometer} keyboardType="number-pad" placeholder={trip.last_odometer != null ? `Minimal ${trip.last_odometer.toLocaleString('id-ID')}` : 'Contoh 125430'} />
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Button label="Mulai Trip" onPress={start} />
    </>
  ) : allDone ? (
    <Button label="Tutup Trip & Isi KM Akhir" onPress={() => router.push(`/finish/${encodedTrip}`)} />
  ) : (
    <Button label={`Ke Tujuan Berikutnya: ${next.customer_name ?? next.reference_no}`} onPress={() => router.push(`/stop/${next.id}`)} />
  )

  return (
    <Screen footer={footer}>
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <Text style={styles.heroTrip}>{tripNo}</Text>
          <Text style={styles.heroState}>{!started ? 'Belum dimulai' : allDone ? 'Semua tujuan selesai' : 'Berjalan'}</Text>
        </View>
        <ProgressBar done={done} total={trip.stops.length} light />
        <Text style={styles.heroMeta}>{done} dari {trip.stops.length} tujuan selesai</Text>
      </View>

      <Card>
        <InfoRow icon="car-outline" label="Kendaraan" value={vehicle ?? 'Belum ditentukan admin'} />
        {trip.odometer_start != null ? <InfoRow icon="speedometer-outline" label="KM awal" value={`${trip.odometer_start.toLocaleString('id-ID')} KM`} /> : null}
        {!started && trip.last_odometer != null ? <InfoRow icon="speedometer-outline" label="KM terakhir" value={`${trip.last_odometer.toLocaleString('id-ID')} KM`} /> : null}
      </Card>

      {!started && <Notice>Periksa kendaraan dan muatan, lalu isi KM awal di bawah untuk memulai trip.</Notice>}
      {started && allDone && <Notice tone="success">Semua tujuan selesai. Isi BBM bila perlu, kembali ke gudang SRU, lalu tutup trip dengan KM akhir.</Notice>}

      {started && (
        <View style={styles.actions}>
          <ActionTile icon="scan-outline" label="Scan SJ" onPress={() => router.push(`/scan?tripNo=${encodedTrip}`)} />
          <ActionTile icon="water-outline" label="Catat BBM" onPress={() => router.push(`/fuel?tripNo=${encodedTrip}`)} />
          <ActionTile icon="receipt-outline" label="Biaya Lain" onPress={() => router.push(`/expense?tripNo=${encodedTrip}`)} />
        </View>
      )}

      <SectionTitle hint={started ? 'Ketuk untuk detail' : undefined}>Urutan pengiriman</SectionTitle>
      <View>
        {trip.stops.map((stop, index) => (
          <StopRow
            key={stop.id}
            stop={stop}
            index={index}
            isNext={started && stop.id === next?.id}
            isLast={index === trip.stops.length - 1}
            onPress={() => router.push(`/stop/${stop.id}`)}
          />
        ))}
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.midnight, borderRadius: radius.lg, padding: 16, gap: 10 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroTrip: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  heroState: { fontSize: 13, fontWeight: '700', color: colors.gold },
  heroMeta: { fontSize: 13, color: colors.goldLight },
  actions: { flexDirection: 'row', gap: 10 },
  meta: { fontSize: 14, color: colors.textSoft },
  stopRow: { flexDirection: 'row', gap: 12 },
  rail: { width: 28, alignItems: 'center' },
  dot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  dotTodo: { backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.border },
  dotNext: { backgroundColor: colors.gold },
  dotDone: { backgroundColor: colors.success },
  dotFailed: { backgroundColor: colors.danger },
  dotText: { fontSize: 13, fontWeight: '700', color: colors.textSoft },
  dotTextNext: { color: colors.midnight },
  line: { flex: 1, width: 2, backgroundColor: colors.border, marginTop: 2 },
  lineDone: { backgroundColor: colors.success },
  stopCard: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 4, marginBottom: 10 },
  stopCardNext: { borderColor: colors.gold, borderWidth: 2 },
  stopCardPressed: { opacity: 0.85 },
  nextLabel: { fontSize: 11, fontWeight: '800', color: colors.goldDark, textTransform: 'uppercase' },
  stopName: { fontSize: 16, fontWeight: '700', color: colors.text },
  stopFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
})
