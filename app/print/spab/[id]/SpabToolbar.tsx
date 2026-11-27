'use client'

import { useEffect, useState } from 'react'

type SaveHandle = { createWritable: () => Promise<{ write: (data: Blob) => Promise<void>; close: () => Promise<void> }> }
type SavePicker = (options: Record<string, unknown>) => Promise<SaveHandle>

/** Ubah halaman SPAB (elemen .page) menjadi PDF A4, dipecah per halaman bila panjang. */
async function renderPdf(page: HTMLElement) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas-pro'), import('jspdf')])
  const canvas = await html2canvas(page, {
    scale: 2,
    backgroundColor: '#ffffff',
    windowWidth: 1200,
    onclone: doc => {
      const clone = doc.querySelector<HTMLElement>('.spab-print .page')
      if (clone) Object.assign(clone.style, { width: '182mm', maxWidth: 'none', boxShadow: 'none', padding: '0', margin: '0' })
    },
  })

  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
  const margin = 14
  const width = 210 - margin * 2
  const pageHeight = 297 - margin * 2
  const pxPerMm = canvas.width / width
  const slicePx = Math.floor(pageHeight * pxPerMm)

  for (let top = 0, index = 0; top < canvas.height; top += slicePx, index++) {
    const height = Math.min(slicePx, canvas.height - top)
    const slice = document.createElement('canvas')
    slice.width = canvas.width
    slice.height = height
    slice.getContext('2d')!.drawImage(canvas, 0, top, canvas.width, height, 0, 0, canvas.width, height)
    if (index > 0) pdf.addPage()
    pdf.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', margin, margin, width, height / pxPerMm)
  }
  return pdf.output('blob')
}

/**
 * Tombol cetak dan unduh PDF SPAB. Di Chrome/Edge jendela simpan mengingat folder terakhir
 * (mis. D:\srgjaya\SPAB); browser lain memakai unduhan biasa.
 */
export function SpabToolbar({ fileName, autoPrint }: { fileName: string; autoPrint: boolean }) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!autoPrint) return
    const timer = window.setTimeout(() => window.print(), 400)
    return () => window.clearTimeout(timer)
  }, [autoPrint])

  async function download() {
    const page = document.querySelector<HTMLElement>('.spab-print .page')
    if (!page) return
    setMessage(null)
    const name = `${fileName.replace(/[\\/:*?"<>|]+/g, ' ').trim()}.pdf`
    const picker = (window as unknown as { showSaveFilePicker?: SavePicker }).showSaveFilePicker

    // Jendela simpan dibuka lebih dulu: harus langsung dari klik, sebelum PDF selesai dibuat.
    let handle: SaveHandle | null = null
    if (picker) {
      try {
        handle = await picker({ suggestedName: name, id: 'spab-archive', startIn: 'documents', types: [{ description: 'PDF', accept: { 'application/pdf': ['.pdf'] } }] })
      } catch (error) {
        if ((error as Error)?.name === 'AbortError') return
        handle = null
      }
    }

    setBusy(true)
    try {
      const blob = await renderPdf(page)
      if (handle) {
        const writable = await handle.createWritable()
        await writable.write(blob)
        await writable.close()
      } else {
        const url = URL.createObjectURL(blob)
        const link = Object.assign(document.createElement('a'), { href: url, download: name })
        document.body.appendChild(link)
        link.click()
        link.remove()
        window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
      }
      setMessage(`Tersimpan: ${name}`)
    } catch (error) {
      setMessage(`Gagal membuat PDF: ${(error as Error)?.message ?? error}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="toolbar">
      <button type="button" onClick={download} disabled={busy}>{busy ? 'Membuat PDF…' : 'Unduh PDF'}</button>
      <button type="button" onClick={() => window.print()}>Cetak</button>
      <button type="button" onClick={() => window.close()}>Tutup</button>
      {message && <span className="toolbar-msg">{message}</span>}
    </div>
  )
}
