import { useEffect, useState } from 'react'
import { Alert, StyleSheet, Text } from 'react-native'
import { useRouter } from 'expo-router'
import { clearSession, getDriver, type Driver } from '../../src/api'
import { getPrintServer, normalizePrintServer, setPrintServer } from '../../src/costs'
import { useQueue } from '../../src/hooks'
import { stopTracking } from '../../src/tracker'
import { Button, Card, Field, Screen, SectionTitle, notifySaved } from '../../src/ui'
import { colors } from '../../src/theme'

export default function ProfileScreen() {
  const router = useRouter()
  const queue = useQueue()
  const [driver, setDriver] = useState<Driver | null>(null)
  const [printServer, setPrintServerInput] = useState(getPrintServer)
  const [testing, setTesting] = useState(false)

  useEffect(() => { void getDriver().then(setDriver) }, [])

  async function logout() {
    await stopTracking()
    await clearSession()
    router.replace('/login')
  }

  function confirmLogout() {
    const warning = queue.length ? `Masih ada ${queue.length} data di antrean. Data tetap tersimpan di ponsel ini. ` : ''
    Alert.alert('Keluar dari aplikasi?', `${warning}Pelacakan lokasi akan dihentikan.`, [
      { text: 'Batal', style: 'cancel' },
      { text: 'Keluar', style: 'destructive', onPress: () => void logout() },
    ])
  }

  async function savePrinter() {
    const url = normalizePrintServer(printServer)
    setPrintServer(url)
    setPrintServerInput(url)
    if (!url) { notifySaved('Alamat printer dihapus'); return }
    setTesting(true)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8_000)
    try {
      const response = await fetch(`${url}/api/health`, { signal: controller.signal })
      Alert.alert(response.ok ? 'Printer kantor terhubung' : 'Server menjawab dengan galat', url)
    } catch {
      Alert.alert('Printer kantor belum terjangkau', `Alamat disimpan: ${url}\n\nPastikan HP terhubung ke Wi-Fi kantor dan aplikasi Cetak Foto BBM berjalan di PC.`)
    } finally {
      clearTimeout(timer)
      setTesting(false)
    }
  }

  return (
    <Screen>
      <Card>
        <Text style={styles.name}>{driver?.driver_name ?? '-'}</Text>
        <Text style={styles.meta}>{driver?.driver_code} · {driver?.role}</Text>
      </Card>

      <SectionTitle>Printer kantor</SectionTitle>
      <Card>
        <Field
          label="Alamat server Cetak Foto BBM"
          value={printServer}
          onChangeText={setPrintServerInput}
          autoCapitalize="none"
          keyboardType="url"
          placeholder="192.168.1.10:3101"
        />
        <Text style={styles.meta}>Dipakai untuk mencetak realisasi biaya ke printer sharing di kantor.</Text>
        <Button label="Simpan dan Tes Koneksi" tone="outline" busy={testing} onPress={savePrinter} />
      </Card>

      <Button label="Riwayat Trip" tone="outline" onPress={() => router.push('/history')} />
      <Button label="Ganti PIN" tone="outline" onPress={() => router.push('/change-pin')} />
      <Button label="Keluar" tone="danger" onPress={confirmLogout} />
    </Screen>
  )
}

const styles = StyleSheet.create({
  name: { fontSize: 18, fontWeight: '700', color: colors.midnight },
  meta: { fontSize: 14, color: colors.textSoft },
})
