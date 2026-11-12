import { useEffect, useState } from 'react'
import { Alert, Linking, StyleSheet, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useTrips } from '../../src/hooks'
import { currentPosition, distanceMeters } from '../../src/tracker'
import { isStopDone, mapsUrl } from '../../src/trips'
import { Button, Card, Notice, Screen, SectionTitle, StatusPill } from '../../src/ui'
import { colors } from '../../src/theme'

const NEAR_DESTINATION_METERS = 500

function formatDistance(meters: number) {
  return meters < 1000 ? `${meters.toLocaleString('id-ID')} m` : `${(meters / 1000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} km`
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

  const order = trip.stops.findIndex(row => row.id === stop.id) + 1
  const totalQty = stop.items.reduce((sum, item) => sum + item.quantity, 0)
  const footer = trip.started_at && !done ? (
    <View style={styles.footerRow}>
      <View style={styles.footerSecondary}><Button label="Gagal Kirim" tone="outline" onPress={() => router.push(`/failed/${stop.id}`)} /></View>
      <View style={styles.footerPrimary}><Button label="Sudah Sampai, Isi POD" onPress={confirmArrival} /></View>
    </View>
  ) : undefined

  return (
    <Screen footer={footer}>
      <Card>
        <Text style={styles.order}>Tujuan {order} dari {trip.stops.length}</Text>
        <Text style={styles.title}>{stop.customer_name ?? '-'}</Text>
        <Text style={styles.meta}>{stop.reference_no}{stop.dk_lk ? ` · ${stop.dk_lk}` : ''}</Text>
        <Text style={styles.meta}>{address || '-'}</Text>
        <StatusPill status={stop.status} />
        {stop.failure_reason ? <Text style={styles.meta}>Alasan: {stop.failure_reason}</Text> : null}
      </Card>

      {!done && (
        <Card>
          <View style={styles.distanceRow}>
            <View style={styles.flex}>
              <Text style={styles.label}>Jarak ke lokasi tujuan</Text>
              <Text style={styles.distance}>
                {distance != null ? formatDistance(distance) : hasTarget ? 'Menghitung...' : 'Koordinat belum tersedia'}
              </Text>
            </View>
            {distance != null && distance <= NEAR_DESTINATION_METERS ? <Text style={styles.near}>Sudah dekat</Text> : null}
          </View>
          <Button label="Buka Navigasi Google Maps" onPress={openMaps} disabled={!hasTarget && !address} />
        </Card>
      )}

      {!trip.started_at && <Notice tone="warning">Mulai trip terlebih dahulu untuk menyelesaikan pengiriman ini.</Notice>}

      <SectionTitle hint={`${stop.items.length} baris · ${totalQty.toLocaleString('id-ID')} unit`}>Barang</SectionTitle>
      <Card>
        {stop.items.length === 0 ? <Text style={styles.meta}>Detail barang belum tersedia.</Text> : null}
        {stop.items.map((item, index) => (
          <View key={`${item.item_no}-${item.lot_no}-${index}`} style={[styles.item, index === stop.items.length - 1 && styles.itemLast]}>
            <View style={styles.itemText}>
              <Text style={styles.itemName}>{item.description}</Text>
              <Text style={styles.meta}>{item.item_no}{item.lot_no ? ` · Lot ${item.lot_no}` : ''}</Text>
            </View>
            <Text style={styles.qty}>{item.quantity.toLocaleString('id-ID')}</Text>
          </View>
        ))}
      </Card>
    </Screen>
  )
}

const styles = StyleSheet.create({
  order: { fontSize: 12, fontWeight: '800', color: colors.goldDark, textTransform: 'uppercase' },
  flex: { flex: 1 },
  distanceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  near: { fontSize: 12, fontWeight: '700', color: colors.success, backgroundColor: colors.successSoft, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  itemLast: { borderBottomWidth: 0 },
  footerRow: { flexDirection: 'row', gap: 10 },
  footerSecondary: { flex: 2 },
  footerPrimary: { flex: 3 },
  title: { fontSize: 17, fontWeight: '700', color: colors.text },
  meta: { fontSize: 14, color: colors.textSoft },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSoft },
  distance: { fontSize: 22, fontWeight: '700', color: colors.midnight },
  item: { flexDirection: 'row', gap: 12, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  itemText: { flex: 1 },
  itemName: { fontSize: 14, color: colors.text },
  qty: { fontSize: 15, fontWeight: '700', color: colors.midnight },
})
