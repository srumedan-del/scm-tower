import { useCallback, useState } from 'react'
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'
import { getDriver } from '../../src/api'
import { buildRealizationHtml, costTotals, fetchTripCosts, getPrintServer, printRealization, type TripCosts } from '../../src/costs'
import { useQueue } from '../../src/hooks'
import { activeTrip, type Trip } from '../../src/trips'
import { ActionTile, Button, Card, Notice, SectionTitle, formatRupiah, notifySaved } from '../../src/ui'
import { colors, radius } from '../../src/theme'

function formatTime(value: string) {
  return new Date(value).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function MoneyScreen() {
  const router = useRouter()
  const queue = useQueue()
  const [trip, setTrip] = useState<Trip | null>(null)
  const [costs, setCosts] = useState<TripCosts | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [printing, setPrinting] = useState(false)

  const load = useCallback(async () => {
    const current = activeTrip()
    setTrip(current)
    if (!current) return
    setLoading(true)
    try {
      setCosts(await fetchTripCosts(current.trip_no))
      setError('')
    } catch {
      setError('Rincian biaya butuh koneksi internet. Tarik ke bawah untuk mencoba lagi.')
    } finally {
      setLoading(false)
    }
  }, [])

  useFocusEffect(useCallback(() => { void load() }, [load]))

  if (!trip) {
    return (
      <View style={styles.empty}>
        <Ionicons name="wallet-outline" size={40} color={colors.border} />
        <Text style={styles.emptyText}>BBM dan biaya bisa dicatat setelah ada trip.</Text>
      </View>
    )
  }

  const encodedTrip = encodeURIComponent(trip.trip_no)
  const pendingCosts = queue.filter(item => item.kind === 'fuel' || item.kind === 'expense').length
  const totals = costs ? costTotals(costs) : null

  async function print() {
    if (!costs || !trip) return
    if (pendingCosts) {
      Alert.alert('Masih ada data di antrean', `${pendingCosts} catatan BBM/biaya belum terkirim dan belum ikut tercetak. Kirim antrean dulu, lalu cetak lagi.`)
      return
    }
    setPrinting(true)
    try {
      const result = await printRealization(buildRealizationHtml(costs, trip, await getDriver()))
      if (result.via === 'server') notifySaved(result.message)
      else Alert.alert('Cetak lewat HP', result.message)
    } catch (caught) {
      Alert.alert('Gagal mencetak', caught instanceof Error ? caught.message : 'Coba lagi')
    } finally {
      setPrinting(false)
    }
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
      <View style={styles.hero}>
        <Text style={styles.heroLabel}>Trip aktif</Text>
        <Text style={styles.heroTrip}>{trip.trip_no}</Text>
        <View style={styles.heroStats}>
          <View style={styles.heroStat}><Text style={styles.heroValue}>{totals ? formatRupiah(totals.fuel) : '-'}</Text><Text style={styles.heroStatLabel}>BBM {totals ? `· ${totals.liters.toLocaleString('id-ID', { maximumFractionDigits: 1 })} L` : ''}</Text></View>
          <View style={styles.heroStat}><Text style={styles.heroValue}>{totals ? formatRupiah(totals.expenses) : '-'}</Text><Text style={styles.heroStatLabel}>Biaya lain</Text></View>
        </View>
        {totals ? <Text style={styles.heroTotal}>Total realisasi {formatRupiah(totals.total)}</Text> : null}
      </View>

      <View style={styles.actions}>
        <ActionTile icon="water-outline" label="Catat BBM" onPress={() => router.push(`/fuel?tripNo=${encodedTrip}`)} />
        <ActionTile icon="receipt-outline" label="Catat Biaya" onPress={() => router.push(`/expense?tripNo=${encodedTrip}`)} />
      </View>

      {pendingCosts ? <Notice tone="warning">{pendingCosts} catatan BBM/biaya masih di antrean dan akan muncul setelah terkirim.</Notice> : null}
      {error ? <Notice tone="warning">{error}</Notice> : null}

      <SectionTitle hint={costs ? `${costs.fuel.length}x pengisian` : undefined}>Pengisian BBM</SectionTitle>
      <Card>
        {!costs?.fuel.length ? <Text style={styles.muted}>Belum ada pengisian BBM. BBM bisa dicatat berkali-kali selama trip.</Text> : null}
        {costs?.fuel.map((row, index) => (
          <View key={row.id} style={[styles.row, index > 0 && styles.rowBorder]}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{row.spbu_name_location ?? 'SPBU'}</Text>
              <Text style={styles.muted}>{formatTime(row.logged_at)} · {row.liters.toLocaleString('id-ID', { maximumFractionDigits: 2 })} L{row.odometer_after ? ` · KM ${row.odometer_after.toLocaleString('id-ID')}` : ''}</Text>
            </View>
            <Text style={styles.amount}>{formatRupiah(row.amount_rupiah)}</Text>
          </View>
        ))}
      </Card>

      <SectionTitle hint={costs ? `${costs.expenses.length} catatan` : undefined}>Biaya perjalanan</SectionTitle>
      <Card>
        {!costs?.expenses.length ? <Text style={styles.muted}>Belum ada biaya: TKBM, hotel, tol, makan, parkir, atau lainnya.</Text> : null}
        {costs?.expenses.map((row, index) => (
          <View key={row.id} style={[styles.row, index > 0 && styles.rowBorder]}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{row.expense_type}{row.pss_no ? ` · ${row.pss_no}` : ''}</Text>
              <Text style={styles.muted}>{formatTime(row.recorded_at)}{row.notes ? ` · ${row.notes}` : ''}</Text>
            </View>
            <Text style={styles.amount}>{formatRupiah(row.amount_rupiah)}</Text>
          </View>
        ))}
      </Card>

      <Button label="Cetak Realisasi Biaya" busy={printing} disabled={!costs} onPress={print} />
      <Text style={styles.printHint}>
        {getPrintServer() ? `Dikirim ke printer kantor (${getPrintServer()}). HP harus terhubung ke Wi-Fi kantor.` : 'Alamat printer kantor belum diatur di Profil. Dokumen dicetak lewat dialog cetak HP.'}
      </Text>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.ivory },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24, backgroundColor: colors.ivory },
  emptyText: { fontSize: 15, color: colors.textSoft, textAlign: 'center' },
  hero: { backgroundColor: colors.midnight, borderRadius: radius.lg, padding: 16, gap: 6 },
  heroLabel: { fontSize: 12, fontWeight: '700', color: colors.goldLight, textTransform: 'uppercase' },
  heroTrip: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  heroStats: { flexDirection: 'row', gap: 8, marginTop: 6 },
  heroStat: { flex: 1, borderRadius: radius.sm, padding: 10, backgroundColor: colors.midnightSoft },
  heroValue: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  heroStatLabel: { fontSize: 12, color: '#C9D2E0', marginTop: 2 },
  heroTotal: { fontSize: 14, fontWeight: '700', color: colors.gold, marginTop: 4 },
  actions: { flexDirection: 'row', gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  amount: { fontSize: 15, fontWeight: '700', color: colors.midnight },
  muted: { fontSize: 13, color: colors.textSoft },
  printHint: { fontSize: 12, color: colors.textSoft, textAlign: 'center' },
})
