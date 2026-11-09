import { useEffect, useState } from 'react'
import { Alert, StyleSheet, Text } from 'react-native'
import { useRouter } from 'expo-router'
import { clearSession, getDriver, type Driver } from '../../src/api'
import { useQueue } from '../../src/hooks'
import { stopTracking } from '../../src/tracker'
import { Button, Card, Screen } from '../../src/ui'
import { colors } from '../../src/theme'

export default function ProfileScreen() {
  const router = useRouter()
  const queue = useQueue()
  const [driver, setDriver] = useState<Driver | null>(null)

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

  return (
    <Screen>
      <Card>
        <Text style={styles.name}>{driver?.driver_name ?? '-'}</Text>
        <Text style={styles.meta}>{driver?.driver_code} · {driver?.role}</Text>
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
