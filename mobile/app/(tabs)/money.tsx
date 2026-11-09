import { useCallback, useState } from 'react'
import { StyleSheet, Text } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { apiGet } from '../../src/api'
import { activeTrip } from '../../src/trips'
import { Button, Card, Screen, formatRupiah } from '../../src/ui'
import { colors } from '../../src/theme'

type Summary = { totalBbmLiters: number; totalBbmRp: number; totalAdhocRp: number }

export default function MoneyScreen() {
  const router = useRouter()
  const [tripNo, setTripNo] = useState<string | null>(null)
  const [summary, setSummary] = useState<Summary | null>(null)

  useFocusEffect(useCallback(() => {
    const trip = activeTrip()
    setTripNo(trip?.trip_no ?? null)
    setSummary(null)
    if (trip) {
      apiGet<{ summary: Summary }>(`summary?trip_id=${encodeURIComponent(trip.trip_no)}`)
        .then(response => setSummary(response.summary))
        .catch(() => setSummary(null))
    }
  }, []))

  if (!tripNo) {
    return (
      <Screen>
        <Text style={styles.text}>BBM dan biaya bisa dicatat setelah ada trip.</Text>
      </Screen>
    )
  }

  return (
    <Screen>
      <Card>
        <Text style={styles.label}>Trip aktif</Text>
        <Text style={styles.value}>{tripNo}</Text>
        {summary ? (
          <>
            <Text style={styles.text}>BBM: {summary.totalBbmLiters.toLocaleString('id-ID')} liter · {formatRupiah(summary.totalBbmRp)}</Text>
            <Text style={styles.text}>Biaya lain: {formatRupiah(summary.totalAdhocRp)}</Text>
          </>
        ) : <Text style={styles.text}>Ringkasan tampil saat ada koneksi.</Text>}
      </Card>
      <Button label="Catat BBM" onPress={() => router.push(`/fuel?tripNo=${encodeURIComponent(tripNo)}`)} />
      <Button label="Catat biaya tol, parkir, dll" tone="outline" onPress={() => router.push(`/expense?tripNo=${encodeURIComponent(tripNo)}`)} />
    </Screen>
  )
}

const styles = StyleSheet.create({
  label: { fontSize: 13, color: colors.textSoft },
  value: { fontSize: 17, fontWeight: '700', color: colors.midnight },
  text: { fontSize: 14, color: colors.textSoft },
})
