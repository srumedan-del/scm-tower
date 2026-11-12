import { useEffect, useState } from 'react'
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'
import { getDriver } from '../../src/api'
import { useTrips } from '../../src/hooks'
import { consumeGreeting, getCachedTrips, greeting, isStopDone, nextStop, refreshTrips, taskSummary, vehicleLabel, type Trip } from '../../src/trips'
import { ErrorText, ProgressBar } from '../../src/ui'
import { colors, radius } from '../../src/theme'

function countStops(trips: Trip[]) {
  const stops = trips.flatMap(trip => trip.stops)
  return {
    pending: stops.filter(stop => !isStopDone(stop)).length,
    delivered: stops.filter(stop => stop.status === 'Delivered').length,
    failed: stops.filter(stop => stop.status === 'Failed Delivery').length,
  }
}

function Summary({ trips, driverName, onHistory }: { trips: Trip[]; driverName: string; onHistory: () => void }) {
  const counts = countStops(trips)
  const tiles = [
    { label: 'Menunggu', value: counts.pending, color: colors.goldLight },
    { label: 'Terkirim', value: counts.delivered, color: '#9FE0BF' },
    { label: 'Gagal', value: counts.failed, color: '#F4B2AC' },
  ]
  return (
    <View style={styles.summary}>
      <Text style={styles.greeting}>{greeting()}{driverName ? `, ${driverName}` : ''}</Text>
      <Text style={styles.greetingMeta}>Utamakan keselamatan. Semoga pengiriman hari ini lancar.</Text>
      <View style={styles.tiles}>
        {tiles.map(tile => (
          <View key={tile.label} style={styles.tile}>
            <Text style={[styles.tileValue, { color: tile.color }]}>{tile.value}</Text>
            <Text style={styles.tileLabel}>{tile.label}</Text>
          </View>
        ))}
      </View>
      <Pressable accessibilityRole="button" onPress={onHistory} style={styles.historyLink}>
        <Ionicons name="time-outline" size={16} color={colors.gold} />
        <Text style={styles.historyText}>Riwayat trip</Text>
      </Pressable>
    </View>
  )
}

function TripCard({ trip, onOpen }: { trip: Trip; onOpen: () => void }) {
  const done = trip.stops.filter(isStopDone).length
  const next = nextStop(trip)
  const started = Boolean(trip.started_at)
  const finished = started && !next
  const state = finished
    ? { label: 'Siap ditutup', color: colors.success, bg: colors.successSoft }
    : started
      ? { label: 'Berjalan', color: colors.navy, bg: '#E8EEF7' }
      : { label: 'Belum dimulai', color: colors.warning, bg: colors.warningSoft }
  const cta = finished ? 'Tutup Trip' : started ? 'Lanjutkan Pengiriman' : 'Mulai Trip'

  return (
    <Pressable accessibilityRole="button" onPress={onOpen} style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
      <View style={styles.row}>
        <Text style={styles.tripNo}>{trip.trip_no}</Text>
        <View style={[styles.badge, { backgroundColor: state.bg }]}>
          <Text style={[styles.badgeText, { color: state.color }]}>{state.label}</Text>
        </View>
      </View>
      {vehicleLabel(trip) ? (
        <View style={styles.metaRow}>
          <Ionicons name="car-outline" size={16} color={colors.textSoft} />
          <Text style={styles.meta}>{vehicleLabel(trip)}</Text>
        </View>
      ) : null}
      <View style={styles.progressRow}>
        <View style={styles.progress}><ProgressBar done={done} total={trip.stops.length} /></View>
        <Text style={styles.progressText}>{done}/{trip.stops.length} tujuan</Text>
      </View>
      {next ? (
        <View style={styles.next}>
          <Text style={styles.nextLabel}>{started ? 'Tujuan berikutnya' : 'Tujuan pertama'}</Text>
          <Text style={styles.nextName} numberOfLines={1}>{next.customer_name ?? next.reference_no}</Text>
          <Text style={styles.meta} numberOfLines={1}>{next.destination_city ?? '-'}</Text>
        </View>
      ) : null}
      <View style={[styles.cta, finished && styles.ctaSuccess]}>
        <Text style={styles.ctaText}>{cta}</Text>
        <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
      </View>
    </Pressable>
  )
}

export default function TripsScreen() {
  const router = useRouter()
  const { trips, refreshing, error, refresh } = useTrips()
  const [driverName, setDriverName] = useState('')
  useEffect(() => { void getDriver().then(driver => setDriverName(driver?.driver_name ?? '')) }, [])

  // Pop-up salam sekali setiap login atau aplikasi dibuka, berisi ringkasan tugas.
  useEffect(() => {
    if (!consumeGreeting()) return
    void (async () => {
      const [driver, list] = await Promise.all([getDriver(), refreshTrips().catch(() => getCachedTrips())])
      if (!driver) return
      Alert.alert(`${greeting()}, ${driver.driver_name}`, taskSummary(list))
    })()
  }, [])

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.content}
      data={trips}
      keyExtractor={trip => trip.trip_no}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      ListHeaderComponent={
        <View style={styles.header}>
          <Summary trips={trips} driverName={driverName} onHistory={() => router.push('/history')} />
          {error ? <ErrorText>{error}</ErrorText> : null}
          {trips.length ? <Text style={styles.heading}>Trip saya ({trips.length})</Text> : null}
        </View>
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Ionicons name="cube-outline" size={40} color={colors.border} />
          <Text style={styles.emptyTitle}>Belum ada trip</Text>
          <Text style={styles.emptyText}>Tarik layar ke bawah untuk memuat ulang setelah admin menugaskan pengiriman.</Text>
        </View>
      }
      renderItem={({ item: trip }) => <TripCard trip={trip} onOpen={() => router.push(`/trip/${encodeURIComponent(trip.trip_no)}`)} />}
    />
  )
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.ivory },
  content: { padding: 16, gap: 12 },
  header: { gap: 12 },
  heading: { fontSize: 16, fontWeight: '700', color: colors.midnight, marginTop: 4 },
  summary: { backgroundColor: colors.midnight, borderRadius: radius.lg, padding: 16, gap: 10 },
  greeting: { fontSize: 20, fontWeight: '700', color: '#FFFFFF' },
  greetingMeta: { fontSize: 13, color: colors.goldLight },
  tiles: { flexDirection: 'row', gap: 8, marginTop: 4 },
  tile: { flex: 1, borderRadius: radius.sm, paddingVertical: 10, alignItems: 'center', backgroundColor: colors.midnightSoft },
  tileValue: { fontSize: 24, fontWeight: '800' },
  tileLabel: { fontSize: 12, fontWeight: '600', color: '#C9D2E0' },
  historyLink: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', minHeight: 44 },
  historyText: { fontSize: 14, fontWeight: '700', color: colors.gold },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 10 },
  cardPressed: { borderColor: colors.gold, transform: [{ scale: 0.99 }] },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tripNo: { fontSize: 17, fontWeight: '800', color: colors.midnight },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  meta: { fontSize: 14, color: colors.textSoft },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  progress: { flex: 1 },
  progressText: { fontSize: 13, fontWeight: '700', color: colors.midnight },
  next: { backgroundColor: colors.ivory, borderRadius: radius.sm, padding: 12, gap: 2 },
  nextLabel: { fontSize: 12, fontWeight: '700', color: colors.goldDark, textTransform: 'uppercase' },
  nextName: { fontSize: 16, fontWeight: '700', color: colors.text },
  cta: { minHeight: 48, borderRadius: radius.md, backgroundColor: colors.navy, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  ctaSuccess: { backgroundColor: colors.success },
  ctaText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  empty: { paddingTop: 48, alignItems: 'center', gap: 6 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  emptyText: { fontSize: 14, color: colors.textSoft, textAlign: 'center' },
})
