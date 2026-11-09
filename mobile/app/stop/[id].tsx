import { useEffect, useState } from 'react'
import { Alert, Linking, StyleSheet, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useTrips } from '../../src/hooks'
import { currentPosition, distanceMeters } from '../../src/tracker'
import { isStopDone, type Stop } from '../../src/trips'
import { Button, Card, Screen, StatusPill } from '../../src/ui'
import { colors } from '../../src/theme'

const NEAR_DESTINATION_METERS = 500

function formatDistance(meters: number) {
  return meters < 1000 ? `${meters.toLocaleString('id-ID')} m` : `${(meters / 1000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} km`
}

/** Koordinat customer bila ada; jika tidak, cari dengan alamat. */
function mapsUrl(stop: Stop) {
  const destination = stop.target_lat != null && stop.target_lng != null
    ? `${stop.target_lat},${stop.target_lng}`
    : [stop.customer_name, stop.destination_address, stop.destination_city].filter(Boolean).join(', ')
  return `https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=${encodeURIComponent(destination)}`
}

export default function StopScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { trips } = useTrips()
  const trip = trips.find(row => row.stops.some(stop => stop.id === Number(id)))
  const stop = trip?.stops.find(row => row.id === Number(id))
  const [distance, setDistance] = useState<number | null>(null)

  const targetLat = stop?.target_lat ?? null
  const targetLng = stop?.target_lng ?? null
  const hasTarget = targetLat != null && targetLng != null
  const open = stop ? !isStopDone(stop) : false
  // Primitif sebagai dependensi: daftar trip dibuat ulang setiap refresh, GPS cukup dibaca sekali.
  useEffect(() => {
    if (!open || targetLat == null || targetLng == null) return
    void currentPosition().then(position => {
      if (position) setDistance(distanceMeters(position, { lat: targetLat, lng: targetLng }))
    })
  }, [open, targetLat, targetLng])

  if (!trip || !stop) return <Screen><Text style={styles.meta}>Pengiriman tidak ditemukan.</Text></Screen>
  const done = isStopDone(stop)
  const address = [stop.destination_address, stop.destination_city].filter(Boolean).join(', ')

  function openMaps() {
    Linking.openURL(mapsUrl(stop!)).catch(() => Alert.alert('Tidak bisa membuka peta', 'Pastikan Google Maps atau browser terpasang.'))
  }

  function confirmArrival() {
    const far = distance != null && distance > NEAR_DESTINATION_METERS
    Alert.alert(
      'Apakah anda sudah sampai di tujuan?',
      far
        ? `Posisi Anda sekitar ${formatDistance(distance!)} dari lokasi ${stop!.customer_name ?? 'customer'}.`
        : `Lanjutkan isi bukti terima untuk ${stop!.customer_name ?? 'customer'}.`,
      [
        { text: 'Belum', style: 'cancel' },
        { text: 'Sudah sampai', onPress: () => router.push(`/pod/${stop!.id}`) },
      ],
    )
  }

  return (
    <Screen>
      <Card>
        <Text style={styles.title}>{stop.customer_name ?? '-'}</Text>
        <Text style={styles.meta}>{stop.reference_no}{stop.dk_lk ? ` · ${stop.dk_lk}` : ''}</Text>
        <Text style={styles.meta}>{address || '-'}</Text>
        <StatusPill status={stop.status} />
        {stop.failure_reason ? <Text style={styles.meta}>Alasan: {stop.failure_reason}</Text> : null}
      </Card>

      {!done && (
        <Card>
          <Text style={styles.label}>Jarak ke lokasi tujuan</Text>
          <Text style={styles.distance}>
            {distance != null ? formatDistance(distance) : hasTarget ? 'Menghitung...' : 'Koordinat customer belum tersedia'}
          </Text>
          <Button label="Navigasi ke Tujuan" tone="outline" onPress={openMaps} disabled={!hasTarget && !address} />
        </Card>
      )}

      <Text style={styles.heading}>Barang ({stop.items.length})</Text>
      <Card>
        {stop.items.length === 0 ? <Text style={styles.meta}>Detail barang belum tersedia.</Text> : null}
        {stop.items.map((item, index) => (
          <View key={`${item.item_no}-${item.lot_no}-${index}`} style={styles.item}>
            <View style={styles.itemText}>
              <Text style={styles.itemName}>{item.description}</Text>
              <Text style={styles.meta}>{item.item_no}{item.lot_no ? ` · Lot ${item.lot_no}` : ''}</Text>
            </View>
            <Text style={styles.qty}>{item.quantity.toLocaleString('id-ID')}</Text>
          </View>
        ))}
      </Card>

      {!trip.started_at && <Text style={styles.meta}>Mulai trip terlebih dahulu untuk menyelesaikan pengiriman.</Text>}
      {trip.started_at && !done && (
        <>
          <Button label="Terkirim, isi POD" onPress={confirmArrival} />
          <Button label="Gagal kirim" tone="danger" onPress={() => router.push(`/failed/${stop.id}`)} />
        </>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  heading: { fontSize: 16, fontWeight: '700', color: colors.midnight },
  title: { fontSize: 17, fontWeight: '700', color: colors.text },
  meta: { fontSize: 14, color: colors.textSoft },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSoft },
  distance: { fontSize: 22, fontWeight: '700', color: colors.midnight },
  item: { flexDirection: 'row', gap: 12, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  itemText: { flex: 1 },
  itemName: { fontSize: 14, color: colors.text },
  qty: { fontSize: 15, fontWeight: '700', color: colors.midnight },
})
