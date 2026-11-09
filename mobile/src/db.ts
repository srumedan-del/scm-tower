import { openDatabaseSync } from 'expo-sqlite'

/** Penyimpanan lokal agar driver tetap bisa bekerja saat tidak ada sinyal. */
export const db = openDatabaseSync('driver.db')

db.execSync(`
  CREATE TABLE IF NOT EXISTS queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL,
    label TEXT NOT NULL,
    payload TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    last_error TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trip_id TEXT NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    speed_kmh REAL NOT NULL,
    recorded_at TEXT NOT NULL
  );
`)

export function getKv<T>(key: string): T | null {
  const row = db.getFirstSync<{ value: string }>('SELECT value FROM kv WHERE key = ?', key)
  return row ? (JSON.parse(row.value) as T) : null
}

export function setKv(key: string, value: unknown) {
  db.runSync('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)', key, JSON.stringify(value))
}

export function deleteKv(key: string) {
  db.runSync('DELETE FROM kv WHERE key = ?', key)
}
