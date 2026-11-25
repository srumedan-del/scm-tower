import { Tabs } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useQueue } from '../../src/hooks'
import { OfflineBanner } from '../../src/ui'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '../../src/theme'

export default function TabsLayout() {
  const queue = useQueue()
  // Tinggi tetap 62 menimpa jarak aman bawaan: di HP dengan tombol navigasi, menu bisa tertutup bilah sistem.
  const insets = useSafeAreaInsets()
  return (
    <>
      <Tabs
        screenOptions={{
          headerStyle: { backgroundColor: colors.midnight },
          headerTintColor: '#FFFFFF',
          tabBarActiveTintColor: colors.navy,
          tabBarInactiveTintColor: colors.muted,
          tabBarStyle: { height: 62 + insets.bottom, paddingBottom: 8 + insets.bottom, borderTopColor: colors.border },
          tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        }}
      >
        <Tabs.Screen name="index" options={{ title: 'Trip', tabBarIcon: ({ color, size }) => <Ionicons name="navigate-outline" color={color as string} size={size} /> }} />
        <Tabs.Screen name="money" options={{ title: 'BBM & Biaya', tabBarIcon: ({ color, size }) => <Ionicons name="wallet-outline" color={color as string} size={size} /> }} />
        <Tabs.Screen
          name="queue"
          options={{
            title: 'Antrean',
            tabBarBadge: queue.length || undefined,
            tabBarIcon: ({ color, size }) => <Ionicons name="cloud-upload-outline" color={color as string} size={size} />,
          }}
        />
        <Tabs.Screen name="profile" options={{ title: 'Profil', tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" color={color as string} size={size} /> }} />
      </Tabs>
      <OfflineBanner pending={queue.length} />
    </>
  )
}
