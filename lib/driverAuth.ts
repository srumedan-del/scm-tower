import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

/** Hanya untuk kode server: memakai service role key sebagai bahan kunci sesi. */

export const DEFAULT_DRIVER_PIN = '123456'
export const DRIVER_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30

const HASH_PREFIX = 'scrypt$'

export type DriverSession = {
  id: number
  driver_code: string
  driver_name: string
  role: string
}

function safeEqual(first: string, second: string) {
  const a = Buffer.from(first)
  const b = Buffer.from(second)
  return a.length === b.length && timingSafeEqual(a, b)
}

export function isValidNewPin(pin: string) {
  return /^\d{6}$/.test(pin) && pin !== DEFAULT_DRIVER_PIN
}

export function hashPin(pin: string) {
  const salt = randomBytes(16).toString('hex')
  return `${HASH_PREFIX}${salt}$${scryptSync(pin, salt, 32).toString('hex')}`
}

export function isHashedPin(stored: string | null | undefined) {
  return Boolean(stored?.startsWith(HASH_PREFIX))
}

/** PIN kosong diperlakukan sebagai PIN default, sama seperti perilaku lama. */
export function isDefaultPin(stored: string | null | undefined) {
  const value = stored?.trim()
  return !value || value === DEFAULT_DRIVER_PIN
}

/** Mendukung PIN lama yang belum di-hash agar bisa di-upgrade saat login. */
export function verifyPin(pin: string, stored: string | null | undefined) {
  const value = stored?.trim() ?? ''
  if (!isHashedPin(value)) return value !== '' && safeEqual(pin, value)
  const [salt, hash] = value.slice(HASH_PREFIX.length).split('$')
  if (!salt || !hash) return false
  return safeEqual(scryptSync(pin, salt, 32).toString('hex'), hash)
}

function sessionKey() {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) throw new Error('SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi')
  return createHmac('sha256', secret).update('scm-driver-session-v1').digest()
}

function sign(body: string) {
  return createHmac('sha256', sessionKey()).update(body).digest('base64url')
}

export function encodeDriverSession(session: DriverSession) {
  const expiresAt = Date.now() + DRIVER_SESSION_MAX_AGE_SECONDS * 1000
  const body = Buffer.from(JSON.stringify({ ...session, exp: expiresAt })).toString('base64url')
  return `${body}.${sign(body)}`
}

export function decodeDriverSession(token: string | undefined): DriverSession | null {
  if (!token) return null
  const [body, signature, extra] = token.split('.')
  if (!body || !signature || extra !== undefined || !safeEqual(signature, sign(body))) return null
  try {
    const { exp, ...session } = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
    if (typeof exp !== 'number' || exp < Date.now() || !Number.isInteger(session.id)) return null
    return session as DriverSession
  } catch {
    return null
  }
}
