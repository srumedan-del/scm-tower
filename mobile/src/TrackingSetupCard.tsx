import { useCallback, useEffect, useState } from 'react'
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { brandTip, getTrackingIssues, type TrackingIssue } from './device-check'
import { colors, radius } from './theme'

/**
 * Daftar pengaturan HP yang menghentikan pelacakan di background, masing-masing dengan tombol "Atur".
 * Dicek ulang setiap driver kembali ke aplikasi dari halaman pengaturan.
 * `always`: tetap tampil (status "lengkap") walau tidak ada masalah, untuk tab Profil.
 */
export function TrackingSetupCard({ always = false }: { always?: boolean }) {
  const [issues, setIssues] = useState<TrackingIssue[] | null>(null)

  const check = useCallback(() => { void getTrackingIssues().then(setIssues).catch(() => setIssues([])) }, [])

  useEffect(() => {
    check()
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') check() })
    return () => subscription.remove()
  }, [check])

  if (!issues) return null
  const tip = brandTip()
  if (!issues.length) {
    if (!always) return null
    return (
      <View style={[styles.card, styles.ok]}>
        <View style={styles.row}>
          <Ionicons name="checkmark-circle" size={20} color={colors.success} />
          <Text style={[styles.title, { color: colors.success }]}>Pengaturan pelacakan lengkap</Text>
        </View>
        {tip ? <Text style={styles.tip}>{tip}</Text> : null}
      </View>
    )
  }

  return (
    <View style={[styles.card, styles.warn]}>
      <View style={styles.row}>
        <Ionicons name="warning" size={20} color={colors.warning} />
        <Text style={[styles.title, { color: colors.warning }]}>Pelacakan bisa berhenti saat aplikasi di background</Text>
      </View>
      {issues.map(issue => (
        <View key={issue.key} style={styles.issue}>
          <View style={styles.issueText}>
            <Text style={styles.issueTitle}>{issue.title}</Text>
            <Text style={styles.issueDetail}>{issue.detail}</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={() => { void issue.fix().finally(check) }} style={({ pressed }) => [styles.fix, pressed && { opacity: 0.8 }]}>
            <Text style={styles.fixText}>Atur</Text>
          </Pressable>
        </View>
      ))}
      {tip ? <Text style={styles.tip}>{tip}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: 1, padding: 14, gap: 10 },
  warn: { backgroundColor: colors.warningSoft, borderColor: '#E9CF9F' },
  ok: { backgroundColor: colors.successSoft, borderColor: '#BFE3CF' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, fontSize: 15, fontWeight: '700' },
  issue: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFFFF', borderRadius: radius.sm, padding: 10 },
  issueText: { flex: 1, gap: 2 },
  issueTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  issueDetail: { fontSize: 13, color: colors.textSoft },
  fix: { minHeight: 40, minWidth: 64, paddingHorizontal: 14, borderRadius: radius.md, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  fixText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  tip: { fontSize: 13, color: colors.textSoft },
})
