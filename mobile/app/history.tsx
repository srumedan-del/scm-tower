import { useCallback, useEffect, useState } from 'react'
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { apiGet } from '../src/api'
import { Card, ErrorText, StatusPill } from '../src/ui'
import { colors } from '../src/theme'

type HistoryStop = {
  id: number
  reference_no: string
  customer_name: string | null
  destination_city: string | null
  status: string
  delivery_time: string | null
  failure_reason: string | null
}

type HistoryTrip = {
  trip_no: string
  document_date: string | null
  started_at: string | null
  completed_at: string | null
  distance_km: number | null
  stops: HistoryStop[]
}

function formatDate(value: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function HistoryScreen() {
  const [trips, setTrips] = useState<HistoryTrip[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [openTrip, setOpenTrip] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const body = await apiGet<{ trips: HistoryTrip[] }>('history')
      setTrips(body.trips)
      setError('')
    } catch {
      setError('Riwayat butuh koneksi internet. Tarik ke bawah untuk mencoba lagi.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.content}
      data={trips}
      keyExtractor={trip => trip.trip_no}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
      ListHeaderComponent={error ? <ErrorText>{error}</ErrorText> : <Text style={styles.meta}>Trip selesai dalam 30 hari terakhir.</Text>}
      ListEmptyComponent={loading || error ? undefined : <Text style={styles.empty}>Belum ada trip yang selesai.</Text>}
      renderItem={({ item: trip }) => {
        const delivered = trip.stops.filter(stop => stop.status === 'Delivered').length
        const failed = trip.stops.filter(stop => stop.status === 'Failed Delivery').length
        const expanded = openTrip === trip.trip_no
        return (
          <Card onPress={() => setOpenTrip(expanded ? null : trip.trip_no)}>
            <View style={styles.row}>
              <Text style={styles.tripNo}>{trip.trip_no}</Text>
              <Text style={styles.meta}>{formatDate(trip.completed_at ?? trip.document_date)}</Text>
            </View>
            <Text style={styles.meta}>
              Terkirim {delivered} · Gagal {failed} dari {trip.stops.length} tujuan
              {trip.distance_km != null ? ` · ${trip.distance_km.toLocaleString('id-ID')} KM` : ''}
            </Text>
            {expanded && trip.stops.map(stop => (
              <View key={stop.id} style={styles.stop}>
                <View style={styles.stopText}>
                  <Text style={styles.stopName}>{stop.customer_name ?? '-'}</Text>
                  <Text style={styles.meta}>{stop.reference_no}{stop.destination_city ? ` · ${stop.destination_city}` : ''}</Text>
                  {stop.failure_reason ? <Text style={styles.meta}>Alasan: {stop.failure_reason}</Text> : null}
                </View>
                <StatusPill status={stop.status} />
              </View>
            ))}
            {!expanded && <Text style={styles.hint}>Ketuk untuk melihat tujuan</Text>}
          </Card>
        )
      }}
    />
  )
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.ivory },
  content: { padding: 16, gap: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tripNo: { fontSize: 16, fontWeight: '700', color: colors.midnight },
  meta: { fontSize: 14, color: colors.textSoft },
  hint: { fontSize: 13, color: colors.goldDark, fontWeight: '600' },
  stop: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  stopText: { flex: 1 },
  stopName: { fontSize: 14, fontWeight: '600', color: colors.text },
  empty: { paddingTop: 48, textAlign: 'center', fontSize: 15, color: colors.textSoft },
})
