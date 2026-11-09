import { Tabs } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useQueue } from '../../src/hooks'
import { OfflineBanner } from '../../src/ui'
import { colors } from '../../src/theme'

export default function TabsLayout() {
  const queue = useQueue()
  return (
    <>
      <Tabs
        screenOptions={{
          headerStyle: { backgroundColor: colors.midnight },
          headerTintColor: '#FFFFFF',
          tabBarActiveTintColor: colors.navy,
          tabBarInactiveTintColor: '#6A6E76',
          tabBarStyle: { height: 62, paddingBottom: 8 },
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
