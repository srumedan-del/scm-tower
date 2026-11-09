import { useRef, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { getCachedTrips } from '../src/trips'
import { Button, Screen } from '../src/ui'
import { colors } from '../src/theme'

export default function ScanScreen() {
  const { tripNo } = useLocalSearchParams<{ tripNo: string }>()
  const router = useRouter()
  const [permission, requestPermission] = useCameraPermissions()
  const [message, setMessage] = useState('Arahkan kamera ke barcode Surat Jalan')
  const handled = useRef(false)

  function onScanned(value: string) {
    if (handled.current) return
    const code = value.trim().toUpperCase()
    const trip = getCachedTrips().find(row => row.trip_no === tripNo)
    const stop = trip?.stops.find(row => code.includes(row.reference_no.toUpperCase()))
    if (stop) {
      handled.current = true
      router.replace(`/stop/${stop.id}`)
    } else {
      setMessage(`${code} tidak ada di trip ini`)
    }
  }

  if (!permission?.granted) {
    return (
      <Screen>
        <Text style={styles.text}>Izin kamera dibutuhkan untuk scan Surat Jalan.</Text>
        <Button label="Izinkan kamera" onPress={() => void requestPermission()} />
      </Screen>
    )
  }

  return (
    <View style={styles.page}>
      <CameraView
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr', 'code128', 'code39', 'ean13'] }}
        onBarcodeScanned={result => onScanned(result.data)}
      />
      <Text accessibilityLiveRegion="polite" style={styles.message}>{message}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.midnight },
  camera: { flex: 1 },
  message: { padding: 16, color: '#FFFFFF', fontSize: 15, textAlign: 'center' },
  text: { fontSize: 15, color: colors.text },
})
