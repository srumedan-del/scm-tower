import { useEffect, useState, type ReactNode } from 'react'
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, ToastAndroid, View, type KeyboardTypeOptions } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as ImagePicker from 'expo-image-picker'
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import { randomUUID } from 'expo-crypto'
import { Directory, File, Paths } from 'expo-file-system'
import * as Network from 'expo-network'
import { colors, radius } from './theme'

/** footer: tombol aksi utama yang selalu terlihat di bawah layar. */
export function Screen({ children, scroll = true, footer }: { children: ReactNode; scroll?: boolean; footer?: ReactNode }) {
  return (
    <SafeAreaView style={styles.screen} edges={['bottom', 'left', 'right']}>
      {scroll
        ? <ScrollView style={styles.fill} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">{children}</ScrollView>
        : <View style={[styles.content, styles.fill]}>{children}</View>}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </SafeAreaView>
  )
}

export function ProgressBar({ done, total, light }: { done: number; total: number; light?: boolean }) {
  const ratio = total > 0 ? Math.min(1, done / total) : 0
  return (
    <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: total, now: done }} style={[styles.progressTrack, light && styles.progressTrackLight]}>
      <View style={[styles.progressFill, { width: `${Math.round(ratio * 100)}%` }]} />
    </View>
  )
}

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <View style={styles.sectionTitle}>
      <Text style={styles.sectionText}>{children}</Text>
      {hint ? <Text style={styles.sectionHint}>{hint}</Text> : null}
    </View>
  )
}

export type IconName = keyof typeof Ionicons.glyphMap

export function ActionTile({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.tile, pressed && styles.cardPressed]}>
      <Ionicons name={icon} size={24} color={colors.navy} />
      <Text style={styles.tileText}>{label}</Text>
    </Pressable>
  )
}

export function InfoRow({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={18} color={colors.goldDark} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={2}>{value}</Text>
    </View>
  )
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'warning' | 'success'; children: ReactNode }) {
  const palette = tone === 'warning'
    ? { bg: colors.warningSoft, fg: colors.warning, icon: 'alert-circle-outline' as const }
    : tone === 'success'
      ? { bg: colors.successSoft, fg: colors.success, icon: 'checkmark-circle-outline' as const }
      : { bg: '#E8EEF7', fg: colors.navy, icon: 'information-circle-outline' as const }
  return (
    <View style={[styles.notice, { backgroundColor: palette.bg }]}>
      <Ionicons name={palette.icon} size={18} color={palette.fg} />
      <Text style={[styles.noticeText, { color: palette.fg }]}>{children}</Text>
    </View>
  )
}

/** Konfirmasi singkat setelah data disimpan ke antrean. */
export function notifySaved(message: string) {
  if (Platform.OS === 'android') ToastAndroid.show(message, ToastAndroid.SHORT)
}

export function Card({ children, onPress }: { children: ReactNode; onPress?: () => void }) {
  if (!onPress) return <View style={styles.card}>{children}</View>
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
      {children}
    </Pressable>
  )
}

type ButtonTone = 'primary' | 'outline' | 'danger'

export function Button({ label, onPress, tone = 'primary', disabled, busy }: {
  label: string
  onPress: () => void
  tone?: ButtonTone
  disabled?: boolean
  busy?: boolean
}) {
  const blocked = disabled || busy
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(blocked) }}
      disabled={blocked}
      onPress={onPress}
      style={({ pressed }) => [styles.button, buttonTone[tone], pressed && styles.buttonPressed, blocked && styles.disabled]}
    >
      {busy
        ? <ActivityIndicator color={tone === 'outline' ? colors.navy : '#FFFFFF'} />
        : <Text style={[styles.buttonText, tone === 'outline' && styles.buttonTextOutline]}>{label}</Text>}
    </Pressable>
  )
}

export function Field({ label, value, onChangeText, placeholder, keyboardType, secureTextEntry, maxLength, autoCapitalize, multiline, editable = true }: {
  label: string
  value: string
  onChangeText: (value: string) => void
  placeholder?: string
  keyboardType?: KeyboardTypeOptions
  secureTextEntry?: boolean
  maxLength?: number
  autoCapitalize?: 'none' | 'sentences' | 'words'
  multiline?: boolean
  editable?: boolean
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#6A6E76"
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        maxLength={maxLength}
        autoCapitalize={autoCapitalize}
        multiline={multiline}
        editable={editable}
        style={[styles.input, multiline && styles.inputMultiline, !editable && styles.inputReadonly]}
      />
    </View>
  )
}

export function ChoiceRow({ label, options, value, onChange }: {
  label: string
  options: string[]
  value: string
  onChange: (value: string) => void
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.choices}>
        {options.map(option => (
          <Pressable
            key={option}
            accessibilityRole="radio"
            accessibilityState={{ selected: option === value }}
            onPress={() => onChange(option)}
            style={[styles.choice, option === value && styles.choiceActive]}
          >
            <Text style={[styles.choiceText, option === value && styles.choiceTextActive]}>{option}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  )
}

async function captureCompressedPhoto() {
  const permission = await ImagePicker.requestCameraPermissionsAsync()
  if (!permission.granted) throw new Error('Izin kamera ditolak. Aktifkan di pengaturan ponsel.')

  const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 })
  if (result.canceled) return null

  const rendered = await ImageManipulator.manipulate(result.assets[0].uri).resize({ width: 1280 }).renderAsync()
  const saved = await rendered.saveAsync({ compress: 0.7, format: SaveFormat.JPEG })

  // Foto disimpan di folder aplikasi supaya tetap ada selama menunggu sinyal.
  const directory = new Directory(Paths.document, 'photos')
  if (!directory.exists) directory.create({ intermediates: true })
  const target = new File(directory, `${randomUUID()}.jpg`)
  new File(saved.uri).copy(target)
  return target.uri
}

export function PhotoField({ label, value, onChange }: { label: string; value: string; onChange: (uri: string) => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function take() {
    setBusy(true)
    setError('')
    try {
      const uri = await captureCompressedPhoto()
      if (uri) onChange(uri)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Foto gagal diambil')
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {value ? <Image source={{ uri: value }} style={styles.photo} accessibilityLabel={label} /> : null}
      <Button label={value ? 'Ambil ulang foto' : 'Ambil foto'} tone="outline" busy={busy} onPress={take} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  )
}

const pillStyle: Record<string, { background: string; color: string; label: string }> = {
  Delivered: { background: colors.successSoft, color: colors.success, label: 'Terkirim' },
  'Failed Delivery': { background: colors.dangerSoft, color: colors.danger, label: 'Gagal kirim' },
  Closed: { background: colors.border, color: colors.textSoft, label: 'Ditutup' },
}

export function StatusPill({ status }: { status: string }) {
  const style = pillStyle[status] ?? { background: colors.warningSoft, color: colors.warning, label: 'Belum dikirim' }
  return (
    <View style={[styles.pill, { backgroundColor: style.background }]}>
      <Text style={[styles.pillText, { color: style.color }]}>{style.label}</Text>
    </View>
  )
}

export function OfflineBanner({ pending }: { pending: number }) {
  const [online, setOnline] = useState(true)

  useEffect(() => {
    Network.getNetworkStateAsync().then(state => setOnline(state.isInternetReachable !== false)).catch(() => {})
    const subscription = Network.addNetworkStateListener(state => setOnline(state.isInternetReachable !== false))
    return () => subscription.remove()
  }, [])

  if (online && pending === 0) return null
  return (
    <View accessibilityRole="alert" style={[styles.banner, !online && styles.bannerOffline]}>
      <Text style={styles.bannerText}>
        {online ? `Mengirim ${pending} data...` : `Offline. ${pending} data menunggu sinyal.`}
      </Text>
    </View>
  )
}

export function ErrorText({ children }: { children: ReactNode }) {
  return <Text accessibilityRole="alert" style={styles.error}>{children}</Text>
}

export function formatRupiah(value: number) {
  return `Rp ${Math.round(value).toLocaleString('id-ID')}`
}

const buttonTone = StyleSheet.create({
  primary: { backgroundColor: colors.navy },
  outline: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.navy },
  danger: { backgroundColor: colors.danger },
})

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ivory },
  content: { padding: 16, gap: 12, paddingBottom: 24 },
  footer: { paddingVertical: 12, paddingHorizontal: 16, gap: 8, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  progressTrack: { height: 8, borderRadius: 999, backgroundColor: '#ECE7DB', overflow: 'hidden' },
  progressTrackLight: { backgroundColor: 'rgba(255,255,255,0.18)' },
  progressFill: { height: '100%', borderRadius: 999, backgroundColor: colors.gold },
  sectionTitle: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 4 },
  sectionText: { fontSize: 16, fontWeight: '700', color: colors.midnight },
  sectionHint: { fontSize: 13, color: colors.textSoft },
  tile: { flex: 1, minHeight: 76, alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  tileText: { fontSize: 13, fontWeight: '700', color: colors.navy },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 28 },
  infoLabel: { fontSize: 13, color: colors.textSoft, width: 92 },
  infoValue: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
  notice: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', padding: 12, borderRadius: radius.sm },
  noticeText: { flex: 1, fontSize: 14, lineHeight: 20 },
  fill: { flex: 1 },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 6 },
  cardPressed: { borderColor: colors.gold, transform: [{ scale: 0.99 }] },
  button: { minHeight: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  buttonPressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  buttonTextOutline: { color: colors.navy },
  field: { gap: 6 },
  label: { fontSize: 14, fontWeight: '600', color: colors.text },
  input: { minHeight: 52, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: 14, fontSize: 16, color: colors.text },
  inputMultiline: { minHeight: 90, paddingTop: 12, textAlignVertical: 'top' },
  inputReadonly: { backgroundColor: '#EFEBE2' },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  choiceActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  choiceText: { fontSize: 14, color: colors.text },
  choiceTextActive: { color: '#FFFFFF', fontWeight: '600' },
  photo: { width: '100%', height: 200, borderRadius: radius.sm, backgroundColor: '#EFEBE2' },
  pill: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  pillText: { fontSize: 12, fontWeight: '700' },
  banner: { backgroundColor: colors.navy, paddingVertical: 8, paddingHorizontal: 16 },
  bannerOffline: { backgroundColor: colors.warning },
  bannerText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600', textAlign: 'center' },
  error: { color: colors.danger, fontSize: 14 },
})
