/**
 * SCM Tower - Background Windows Desktop Notifier
 * Memeriksa jadwal task dari Supabase dan memunculkan Windows Toast Notification
 * bahkan ketika browser ditutup total.
 */

const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')
const { createClient } = require('@supabase/supabase-js')

// 1. Muat Environment Variables dari .env.local
const envPath = path.resolve(__dirname, '..', '.env.local')
const envConfig = {}
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8')
  envContent.split('\n').forEach((line) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim()
      let val = trimmed.slice(eqIdx + 1).trim()
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1)
      if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1)
      envConfig[key] = val
    }
  })
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || envConfig.NEXT_PUBLIC_SUPABASE_URL || envConfig.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || envConfig.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || envConfig.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('[Notifier] Supabase URL atau API Key tidak ditemukan.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// File riwayat notifikasi harian
const NOTIFIED_CACHE_FILE = path.resolve(__dirname, '.notified_tasks.json')

function getNotifiedCache() {
  try {
    if (fs.existsSync(NOTIFIED_CACHE_FILE)) {
      return JSON.parse(fs.readFileSync(NOTIFIED_CACHE_FILE, 'utf8'))
    }
  } catch {}
  return {}
}

function saveNotifiedCache(cache) {
  try {
    fs.writeFileSync(NOTIFIED_CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8')
  } catch {}
}

// Panggil PowerShell untuk menampilkan Toast Notification Windows
function sendWindowsToast(title, message) {
  const psScript = path.resolve(__dirname, 'notify.ps1')
  const ps = spawn('powershell.exe', [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    psScript,
    '-Title',
    title,
    '-Message',
    message,
  ], {
    windowsHide: true,
    stdio: 'ignore',
  })

  ps.unref()
}

async function checkScheduledTasks() {
  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]

  console.log(`[${now.toLocaleTimeString()}] Memeriksa scheduled tasks di Supabase...`)

  try {
    const { data: tasks, error } = await supabase
      .from('scm_tasks')
      .select('*')
      .eq('status', 'SCHEDULED')

    if (error) {
      console.error('[Notifier Error]', error.message)
      return
    }

    if (!tasks || tasks.length === 0) {
      console.log('Tidak ada task dengan status SCHEDULED.')
      return
    }

    const cache = getNotifiedCache()
    // Reset cache jika hari berganti
    if (cache.date !== todayStr) {
      cache.date = todayStr
      cache.notifiedIds = []
    }

    const notifiedSet = new Set(cache.notifiedIds || [])

    for (const t of tasks) {
      const taskDeadline = t.deadline ? String(t.deadline).slice(0, 10) : todayStr

      // Jika jadwal task adalah hari ini atau sebelumnya (due / overdue)
      if (taskDeadline <= todayStr && !notifiedSet.has(t.id)) {
        const title = `⏰ Jadwal Task: ${t.name}`
        const body = `PIC: ${t.pic || 'Erwin'} | Deadline: ${taskDeadline}\n${t.description ? t.description.slice(0, 90) : 'Task sudah terjadwal untuk dikerjakan.'}`
        
        console.log(`[Notifikasi Dikirim] ${t.name}`)
        sendWindowsToast(title, body)
        notifiedSet.add(t.id)
      }
    }

    cache.notifiedIds = Array.from(notifiedSet)
    saveNotifiedCache(cache)
  } catch (err) {
    console.error('[Notifier Error]', err.message)
  }
}

// Mode Eksekusi
const isDaemon = process.argv.includes('--daemon') || process.argv.includes('-d')

checkScheduledTasks()

if (isDaemon) {
  console.log('[Notifier] Background service aktif (Memeriksa setiap 60 detik).')
  // Cek setiap 60 detik
  setInterval(checkScheduledTasks, 60000)
}
