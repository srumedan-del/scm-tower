import { randomUUID } from 'expo-crypto'
import { File } from 'expo-file-system'
import { ApiError, apiPost, apiUpload } from './api'
import { db } from './db'

export type QueueKind = 'trip-start' | 'trip-finish' | 'fuel' | 'expense' | 'pod' | 'failed'

export type QueueItem = {
  id: number
  kind: QueueKind
  label: string
  payload: string
  status: 'pending' | 'failed'
  last_error: string | null
  created_at: string
}

const listeners = new Set<() => void>()
let flushing = false

function changed() {
  listeners.forEach(listener => listener())
}

export function subscribeQueue(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function getQueue() {
  return db.getAllSync<QueueItem>('SELECT * FROM queue ORDER BY id')
}

/** Data selalu masuk antrean dulu, jadi tidak hilang walau sinyal putus. */
export function enqueue(kind: QueueKind, label: string, payload: Record<string, unknown>) {
  const body = { ...payload, client_ref: randomUUID() }
  db.runSync(
    'INSERT INTO queue (kind, label, payload, created_at) VALUES (?, ?, ?, ?)',
    kind, label, JSON.stringify(body), new Date().toISOString(),
  )
  changed()
  void flushQueue()
}

export function retryFailed() {
  db.runSync("UPDATE queue SET status = 'pending', last_error = NULL WHERE status = 'failed'")
  changed()
  void flushQueue()
}

function deleteLocalFile(uri: string) {
  try {
    new File(uri).delete()
  } catch {
    // File yang sudah terhapus tidak perlu ditangani.
  }
}

async function sendItem(item: QueueItem) {
  const payload = JSON.parse(item.payload) as Record<string, unknown>
  const localFiles: string[] = []

  for (const [key, value] of Object.entries(payload)) {
    if (typeof value === 'string' && value.startsWith('file://')) {
      payload[key] = await apiUpload(value)
      localFiles.push(value)
      // Path disimpan agar percobaan ulang tidak mengunggah foto yang sama.
      db.runSync('UPDATE queue SET payload = ? WHERE id = ?', JSON.stringify(payload), item.id)
    }
  }

  await apiPost(item.kind, payload)
  db.runSync('DELETE FROM queue WHERE id = ?', item.id)
  localFiles.forEach(deleteLocalFile)
}

export async function flushQueue() {
  if (flushing) return
  flushing = true
  try {
    const items = db.getAllSync<QueueItem>("SELECT * FROM queue WHERE status = 'pending' ORDER BY id")
    for (const item of items) {
      try {
        await sendItem(item)
        changed()
      } catch (error) {
        // Ditolak server: tandai dan lanjut. Gangguan jaringan: berhenti, coba lagi nanti.
        if (error instanceof ApiError && error.status >= 400 && error.status < 500 && error.status !== 401) {
          db.runSync("UPDATE queue SET status = 'failed', last_error = ? WHERE id = ?", error.message, item.id)
          changed()
          continue
        }
        break
      }
    }
  } finally {
    flushing = false
  }
}
