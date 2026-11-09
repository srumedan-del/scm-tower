import { useState } from 'react'
import { Alert, StyleSheet, Text } from 'react-native'
import { useRouter } from 'expo-router'
import { ApiError, apiPost } from '../src/api'
import { Button, ErrorText, Field, Screen } from '../src/ui'
import { colors } from '../src/theme'

export default function ChangePinScreen() {
  const router = useRouter()
  const [currentPin, setCurrentPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    if (!/^\d{6}$/.test(newPin)) return setError('PIN baru harus 6 angka')
    if (newPin === '123456') return setError('PIN baru tidak boleh 123456')
    if (newPin !== confirmPin) return setError('Konfirmasi PIN tidak sama')
    setBusy(true)
    setError('')
    try {
      await apiPost('pin', { currentPin, newPin })
      Alert.alert('PIN berhasil diganti', 'Gunakan PIN baru saat login berikutnya.', [{ text: 'OK', onPress: () => router.back() }])
    } catch (caught) {
      setError(caught instanceof ApiError && caught.status !== 0 && caught.status < 500
        ? caught.message
        : 'Gagal mengganti PIN. Periksa koneksi internet.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen>
      <Text style={styles.meta}>Ganti PIN butuh koneksi internet.</Text>
      <Field label="PIN lama" value={currentPin} onChangeText={setCurrentPin} keyboardType="number-pad" secureTextEntry maxLength={6} />
      <Field label="PIN baru (6 angka)" value={newPin} onChangeText={setNewPin} keyboardType="number-pad" secureTextEntry maxLength={6} />
      <Field label="Ulangi PIN baru" value={confirmPin} onChangeText={setConfirmPin} keyboardType="number-pad" secureTextEntry maxLength={6} />
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Button label="Simpan PIN" onPress={submit} busy={busy} disabled={!currentPin || !newPin || !confirmPin} />
    </Screen>
  )
}

const styles = StyleSheet.create({
  meta: { fontSize: 14, color: colors.textSoft },
})
