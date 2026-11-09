import { StyleSheet, Text } from 'react-native'
import { useQueue } from '../../src/hooks'
import { flushQueue, retryFailed } from '../../src/queue'
import { Button, Card, ErrorText, Screen } from '../../src/ui'
import { colors } from '../../src/theme'

export default function QueueScreen() {
  const items = useQueue()
  const failed = items.filter(item => item.status === 'failed').length

  return (
    <Screen>
      {items.length === 0 ? <Text style={styles.empty}>Semua data sudah terkirim.</Text> : null}
      {items.map(item => (
        <Card key={item.id}>
          <Text style={styles.title}>{item.label}</Text>
          <Text style={styles.meta}>{new Date(item.created_at).toLocaleString('id-ID')}</Text>
          {item.status === 'failed'
            ? <ErrorText>Ditolak server: {item.last_error}</ErrorText>
            : <Text style={styles.meta}>Menunggu dikirim</Text>}
        </Card>
      ))}
      {items.length > 0 && <Button label="Kirim sekarang" onPress={() => void flushQueue()} />}
      {failed > 0 && <Button label="Coba ulang yang ditolak" tone="outline" onPress={retryFailed} />}
    </Screen>
  )
}

const styles = StyleSheet.create({
  empty: { fontSize: 15, color: colors.textSoft, textAlign: 'center', paddingTop: 60 },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  meta: { fontSize: 13, color: colors.textSoft },
})
