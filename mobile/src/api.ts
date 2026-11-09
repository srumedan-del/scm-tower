import * as SecureStore from 'expo-secure-store'

const BASE_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/$/, '')
const TOKEN_KEY = 'driver_token'
const DRIVER_KEY = 'driver_profile'

export type Driver = { id: number; driver_code: string; driver_name: string; role: string }

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message)
  }
}

export async function getToken() {
  return SecureStore.getItemAsync(TOKEN_KEY)
}

export async function getDriver() {
  const value = await SecureStore.getItemAsync(DRIVER_KEY)
  return value ? (JSON.parse(value) as Driver) : null
}

export async function saveSession(token: string, driver: Driver) {
  await SecureStore.setItemAsync(TOKEN_KEY, token)
  await SecureStore.setItemAsync(DRIVER_KEY, JSON.stringify(driver))
}

export async function clearSession() {
  await SecureStore.deleteItemAsync(TOKEN_KEY)
  await SecureStore.deleteItemAsync(DRIVER_KEY)
}

async function send<T>(path: string, init: RequestInit): Promise<T> {
  if (!BASE_URL) throw new ApiError('Alamat server belum dikonfigurasi', 0)
  const token = await getToken()
  const headers = new Headers(init.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const response = await fetch(`${BASE_URL}/api/driver/${path}`, { ...init, headers })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new ApiError(body.error ?? 'Terjadi kesalahan pada server', response.status)
  return body as T
}

export function apiGet<T>(path: string) {
  return send<T>(path, { method: 'GET' })
}

export function apiPost<T>(path: string, payload: unknown) {
  return send<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export async function apiUpload(uri: string) {
  const form = new FormData()
  form.append('file', { uri, name: 'foto.jpg', type: 'image/jpeg' } as unknown as Blob)
  const { path } = await send<{ path: string }>('upload', { method: 'POST', body: form })
  return path
}
