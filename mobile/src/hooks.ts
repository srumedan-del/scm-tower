import { useCallback, useEffect, useState } from 'react'
import { useFocusEffect, useRouter } from 'expo-router'
import * as Network from 'expo-network'
import { ApiError, clearSession } from './api'
import { flushLocations } from './tracker'
import { flushQueue, getQueue, subscribeQueue } from './queue'
import { getCachedTrips, refreshTrips, type Trip } from './trips'

export function useQueue() {
  const [items, setItems] = useState(getQueue)
  useEffect(() => {
    const unsubscribe = subscribeQueue(() => setItems(getQueue()))
    return unsubscribe
  }, [])
  return items
}

/** Kirim antrean saat sinyal kembali dan secara berkala selama aplikasi terbuka. */
export function useBackgroundSync() {
  useEffect(() => {
    const sync = () => { void flushQueue(); void flushLocations() }
    sync()
    const timer = setInterval(sync, 30_000)
    const subscription = Network.addNetworkStateListener(state => {
      if (state.isInternetReachable !== false) sync()
    })
    return () => {
      clearInterval(timer)
      subscription.remove()
    }
  }, [])
}

export function useTrips() {
  const router = useRouter()
  const [trips, setTrips] = useState<Trip[]>(getCachedTrips)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      setTrips(await refreshTrips())
      setError('')
    } catch (caught) {
      // Antrean tetap tersimpan di ponsel dan terkirim setelah login ulang.
      if (caught instanceof ApiError && caught.status === 401) {
        await clearSession()
        router.replace('/login')
        return
      }
      setTrips(getCachedTrips())
      setError('Menampilkan data terakhir. Periksa koneksi internet.')
    } finally {
      setRefreshing(false)
    }
  }, [router])

  useFocusEffect(useCallback(() => { void refresh() }, [refresh]))
  useEffect(() => subscribeQueue(() => setTrips(getCachedTrips())), [])

  return { trips, refreshing, error, refresh }
}
