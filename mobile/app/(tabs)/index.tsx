import { useEffect, useState } from 'react'
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { getDriver } from '../../src/api'
import { useTrips } from '../../src/hooks'
import { greeting, isStopDone, vehicleLabel, type Trip } from '../../src/trips'
import { Card, ErrorText } from '../../src/ui'
import { colors, radius } from '../../src/theme'

function countStops(trips: Trip[]) {
  const stops = trips.flatMap(trip => trip.stops)
  return {
    pending: stops.filter(stop => !isStopDone(stop)).length,
    delivered: stops.filter(stop => stop.status === 'Delivered').length,
    failed: stops.filter(stop => stop.status === 'Failed Delivery').length,
  }
}

function Summary({ trips, onHistory }: { trips: Trip[]; onHistory: () => void }) {
  const counts = countStops(trips)
  const tiles = [
    { label: 'Menunggu', value: counts.pending, color: colors.warning, background: colors.warningSoft },
    { label: 'Terkirim', value: counts.delivered, color: colors.success, background: colors.successSoft },
    { label: 'Gagal', value: counts.failed, color: colors.danger, background: colors.dangerSoft },
  ]
  return (
    <View style={styles.summary}>
      <Text style={styles.summaryTitle}>Tujuan di trip aktif</Text>
      <View style={styles.tiles}>
        {tiles.map(tile => (
          <View key={tile.label} style={[styles.tile, { backgroundColor: tile.background }]}>
            <Text style={[styles.tileValue, { color: tile.color }]}>{tile.value}</Text>
            <Text style={[styles.tileLabel, { color: tile.color }]}>{tile.label}</Text>
          </View>
        ))}
      </View>
      <Pressable accessibilityRole="button" onPress={onHistory} style={styles.historyLink}>
        <Text style={styles.historyText}>Lihat riwayat trip</Text>
      </Pressable>
    </View>
  )
}

export default function TripsScreen() {
  const router = useRouter()
  const { trips, refreshing, error, refresh } = useTrips()
  const [driverName, setDriverName] = useState('')
  useEffect(() => { void getDriver().then(driver => setDriverName(driver?.driver_name ?? '')) }, [])

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.content}
      data={trips}
      keyExtractor={trip => trip.trip_no}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      ListHeaderComponent={
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greeting()}{driverName ? `, ${driverName}` : ''}</Text>
            <Text style={styles.meta}>Utamakan keselamatan. Semoga pengiriman hari ini lancar.</Text>
          </View>
          {error ? <ErrorText>{error}</ErrorText> : null}
          <Summary trips={trips} onHistory={() => router.push('/history')} />
        </View>
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Belum ada trip</Text>
          <Text style={styles.emptyText}>Tarik layar ke bawah untuk memuat ulang setelah admin menugaskan pengiriman.</Text>
        </View>
      }
      renderItem={({ item: trip }) => {
        const done = trip.stops.filter(isStopDone).length
        return (
          <Card onPress={() => router.push(`/trip/${encodeURIComponent(trip.trip_no)}`)}>
            <View style={styles.row}>
              <Text style={styles.tripNo}>{trip.trip_no}</Text>
              <Text style={[styles.badge, trip.started_at && styles.badgeActive]}>{trip.started_at ? 'Berjalan' : 'Siap jalan'}</Text>
            </View>
            {vehicleLabel(trip) ? <Text style={styles.meta}>Kendaraan: {vehicleLabel(trip)}</Text> : null}
            <Text style={styles.meta}>{done} dari {trip.stops.length} tujuan selesai</Text>
            <Text style={styles.meta} numberOfLines={2}>
              {[...new Set(trip.stops.map(stop => stop.destination_city).filter(Boolean))].join(', ') || '-'}
            </Text>
          </Card>
        )
      }}
    />
  )
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.ivory },
  content: { padding: 16, gap: 12 },
  header: { gap: 12 },
  greeting: { fontSize: 20, fontWeight: '700', color: colors.midnight },
  summary: { backgroundColor: colors.midnight, borderRadius: radius.lg, padding: 16, gap: 12 },
  summaryTitle: { fontSize: 13, fontWeight: '600', color: colors.goldLight },
  tiles: { flexDirection: 'row', gap: 8 },
  tile: { flex: 1, borderRadius: radius.sm, paddingVertical: 10, alignItems: 'center' },
  tileValue: { fontSize: 22, fontWeight: '800' },
  tileLabel: { fontSize: 12, fontWeight: '600' },
  historyLink: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  historyText: { fontSize: 14, fontWeight: '700', color: colors.gold },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tripNo: { fontSize: 17, fontWeight: '700', color: colors.midnight },
  badge: { fontSize: 12, fontWeight: '700', color: colors.warning },
  badgeActive: { color: colors.success },
  meta: { fontSize: 14, color: colors.textSoft },
  empty: { paddingTop: 48, alignItems: 'center', gap: 6 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  emptyText: { fontSize: 14, color: colors.textSoft, textAlign: 'center' },
})
