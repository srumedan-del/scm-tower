import { useEffect, useState } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { getToken } from '../src/api'
import { useBackgroundSync } from '../src/hooks'
import { colors } from '../src/theme'
import '../src/tracker'

export default function RootLayout() {
  const router = useRouter()
  const segments = useSegments()
  const [ready, setReady] = useState(false)
  useBackgroundSync()

  useEffect(() => {
    getToken().then(token => {
      setReady(true)
      const onLogin = segments[0] === 'login'
      if (!token && !onLogin) router.replace('/login')
      if (token && onLogin) router.replace('/')
    })
  }, [segments, router])

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.midnight }}>
        <ActivityIndicator color={colors.gold} />
      </View>
    )
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.midnight },
          headerTintColor: '#FFFFFF',
          contentStyle: { backgroundColor: colors.ivory },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="trip/[tripNo]" options={{ title: 'Detail Trip' }} />
        <Stack.Screen name="stop/[id]" options={{ title: 'Detail Pengiriman' }} />
        <Stack.Screen name="pod/[id]" options={{ title: 'Bukti Terima (POD)' }} />
        <Stack.Screen name="failed/[id]" options={{ title: 'Gagal Kirim' }} />
        <Stack.Screen name="fuel" options={{ title: 'Catat BBM' }} />
        <Stack.Screen name="expense" options={{ title: 'Catat Biaya' }} />
        <Stack.Screen name="scan" options={{ title: 'Scan Surat Jalan' }} />
        <Stack.Screen name="finish/[tripNo]" options={{ title: 'Tutup Trip' }} />
        <Stack.Screen name="history" options={{ title: 'Riwayat Trip' }} />
        <Stack.Screen name="change-pin" options={{ title: 'Ganti PIN' }} />
      </Stack>
    </>
  )
}
