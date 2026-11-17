import { Alert, Linking, Platform } from 'react-native'
import * as Battery from 'expo-battery'
import * as IntentLauncher from 'expo-intent-launcher'
import * as Location from 'expo-location'
import Constants from 'expo-constants'

const PACKAGE = Constants.expoConfig?.android?.package ?? 'com.scmtower.driver'

/** Pengaturan HP yang membuat pelacakan berhenti saat aplikasi di background. */
export type TrackingIssue = {
  key: 'gps' | 'location' | 'precise' | 'battery'
  title: string
  detail: string
  fix: () => Promise<void>
}

async function openAppSettings() {
  await Linking.openSettings()
}

async function openBatterySettings() {
  try {
    // Dialog sistem "Izinkan aplikasi selalu berjalan di latar belakang?" (perlu izin REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).
    await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, { data: `package:${PACKAGE}` })
  } catch {
    try {
      await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
    } catch {
      await openAppSettings()
    }
  }
}

export async function getTrackingIssues(): Promise<TrackingIssue[]> {
  if (Platform.OS !== 'android') return []
  const issues: TrackingIssue[] = []

  const gpsOn = await Location.hasServicesEnabledAsync().catch(() => true)
  if (!gpsOn) {
    issues.push({
      key: 'gps',
      title: 'GPS (Lokasi) HP mati',
      detail: 'Nyalakan Lokasi di HP.',
      fix: async () => {
        try { await Location.enableNetworkProviderAsync() } catch {
          await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.LOCATION_SOURCE_SETTINGS).catch(openAppSettings)
        }
      },
    })
  }

  const foreground = await Location.getForegroundPermissionsAsync()
  const background = await Location.getBackgroundPermissionsAsync()
  if (!foreground.granted || !background.granted) {
    issues.push({
      key: 'location',
      title: 'Izin lokasi belum "Izinkan sepanjang waktu"',
      detail: 'Tanpa izin ini lokasi berhenti dicatat saat layar mati atau aplikasi lain dibuka.',
      fix: async () => {
        const fg = foreground.granted ? foreground : await Location.requestForegroundPermissionsAsync()
        if (!fg.granted) { await openAppSettings(); return }
        const bg = await Location.requestBackgroundPermissionsAsync()
        // Android 11+ tidak menampilkan dialog "sepanjang waktu"; pilihan itu hanya ada di pengaturan.
        if (!bg.granted) await openAppSettings()
      },
    })
  } else if (foreground.android?.accuracy === 'coarse') {
    issues.push({
      key: 'precise',
      title: 'Lokasi akurat belum aktif',
      detail: 'Aktifkan "Gunakan lokasi akurat" agar posisi di peta tidak meleset.',
      fix: openAppSettings,
    })
  }

  const optimized = await Battery.isBatteryOptimizationEnabledAsync().catch(() => false)
  if (optimized) {
    issues.push({
      key: 'battery',
      title: 'Baterai masih dibatasi',
      detail: 'Android menghentikan pelacakan untuk hemat baterai. Pilih "Izinkan" / "Tidak dibatasi".',
      fix: openBatterySettings,
    })
  }
  return issues
}

/** Pengaturan tambahan yang tidak bisa dicek aplikasi, sesuai merek HP. */
export function brandTip(): string | null {
  const brand = String((Platform.constants as { Brand?: string; Manufacturer?: string }).Manufacturer ?? (Platform.constants as { Brand?: string }).Brand ?? '').toLowerCase()
  if (/xiaomi|redmi|poco/.test(brand)) return 'HP Xiaomi: aktifkan "Mulai otomatis", set Penghemat baterai ke "Tanpa batasan", dan kunci aplikasi di daftar aplikasi terbaru (ikon gembok).'
  if (/oppo|realme|oneplus/.test(brand)) return 'HP Oppo/Realme: di info aplikasi, aktifkan "Izinkan aktivitas latar belakang" dan "Mulai otomatis".'
  if (/vivo|iqoo/.test(brand)) return 'HP Vivo: aktifkan "Mulai otomatis" dan izinkan "Konsumsi daya tinggi di latar belakang".'
  if (/samsung/.test(brand)) return 'HP Samsung: Baterai → Batas penggunaan latar belakang → masukkan aplikasi ke "Aplikasi yang tidak pernah tidur".'
  if (/huawei|honor/.test(brand)) return 'HP Huawei/Honor: Peluncuran aplikasi → matikan "Kelola otomatis" lalu izinkan semua.'
  return null
}

/**
 * Tampilkan masalah pengaturan satu per satu dengan tombol "Atur Sekarang".
 * Mengembalikan setelah driver memilih (tidak menunggu pengaturan selesai diubah).
 */
export async function promptTrackingSetup(intro = 'Agar admin bisa memantau trip saat aplikasi di background:') {
  const issues = await getTrackingIssues()
  if (!issues.length) return true
  const first = issues[0]
  const list = issues.map((issue, index) => `${index + 1}. ${issue.title}`).join('\n')
  const tip = brandTip()
  await new Promise<void>(resolve => {
    Alert.alert(
      'Pengaturan HP belum lengkap',
      `${intro}\n\n${list}\n\n${first.detail}${tip ? `\n\n${tip}` : ''}`,
      [
        { text: 'Nanti', style: 'cancel', onPress: () => resolve() },
        { text: 'Atur Sekarang', onPress: () => { void first.fix().finally(resolve) } },
      ],
      { cancelable: true, onDismiss: () => resolve() },
    )
  })
  return false
}
