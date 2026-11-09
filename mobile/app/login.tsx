import { useState } from 'react'
import { KeyboardAvoidingView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { apiPost, saveSession, type Driver } from '../src/api'
import { Button, ErrorText, Field, Screen } from '../src/ui'
import { colors } from '../src/theme'

type LoginResponse = { token?: string; driver?: Driver; mustChangePin?: boolean }

export default function LoginScreen() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [pin, setPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [mustChangePin, setMustChangePin] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    setError('')
    if (!username.trim() || !pin.trim()) return setError('Username dan PIN wajib diisi')
    if (mustChangePin && newPin !== confirmPin) return setError('Konfirmasi PIN tidak sama')

    setBusy(true)
    try {
      const response = mustChangePin
        ? await apiPost<LoginResponse>('change-pin', { username, pin, newPin })
        : await apiPost<LoginResponse>('login', { username, pin })
      if (response.mustChangePin) {
        setMustChangePin(true)
      } else if (response.token && response.driver) {
        await saveSession(response.token, response.driver)
        router.replace('/')
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Login gagal')
    } finally {
      setBusy(false)
    }
  }

  return (
    <KeyboardAvoidingView behavior="height" style={styles.page}>
      <View style={styles.hero}>
        <View style={styles.mark}><Text style={styles.markText}>SC</Text></View>
        <Text style={styles.title}>SCM Tower Driver</Text>
        <Text style={styles.subtitle}>Pengiriman, BBM, dan bukti terima</Text>
      </View>
      <View style={styles.sheet}>
        <Screen>
          <Field label="Username" value={username} onChangeText={setUsername} autoCapitalize="none" editable={!mustChangePin} />
          <Field label="PIN" value={pin} onChangeText={setPin} keyboardType="number-pad" secureTextEntry maxLength={6} editable={!mustChangePin} />
          {mustChangePin && (
            <>
              <Text style={styles.notice}>PIN Anda masih bawaan. Buat PIN baru 6 angka untuk melanjutkan.</Text>
              <Field label="PIN baru" value={newPin} onChangeText={setNewPin} keyboardType="number-pad" secureTextEntry maxLength={6} />
              <Field label="Ulangi PIN baru" value={confirmPin} onChangeText={setConfirmPin} keyboardType="number-pad" secureTextEntry maxLength={6} />
            </>
          )}
          {error ? <ErrorText>{error}</ErrorText> : null}
          <Button label={mustChangePin ? 'Simpan PIN & Masuk' : 'Masuk'} busy={busy} onPress={submit} />
        </Screen>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.midnight },
  hero: { paddingTop: 72, paddingBottom: 28, paddingHorizontal: 24, gap: 6 },
  mark: { width: 52, height: 52, borderRadius: 14, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  markText: { fontWeight: '800', color: colors.midnight, fontSize: 16 },
  title: { color: '#FFFFFF', fontSize: 26, fontWeight: '700' },
  subtitle: { color: colors.goldLight, fontSize: 14 },
  sheet: { flex: 1, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden', backgroundColor: colors.ivory },
  notice: { fontSize: 14, color: colors.text },
})
