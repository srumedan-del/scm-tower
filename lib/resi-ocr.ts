// Baca teks gambar resi di browser (tesseract.js) lalu cocokkan dengan nomor resi dan biaya yang diinput user.

export type ResiCheck = {
  resiMatch: boolean | null      // null = nomor resi di form kosong
  amountMatch: boolean | null    // null = biaya di form kosong
  amountsFound: number[]         // nilai Rp yang terbaca di gambar
  resiCandidates: string[]       // kode panjang yang terbaca, untuk ditampilkan bila tidak cocok
}

// Huruf yang sering tertukar dengan angka saat OCR.
const fold = (value: string) =>
  value.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1').replace(/S/g, '5').replace(/B/g, '8').replace(/Z/g, '2')

/** "30.000,00" / "30,000" / "Rp30.000" -> 30000 */
function parseRupiah(raw: string) {
  // Grup ribuan selalu 3 digit, jadi 2 digit di ujung adalah sen (",00") dan dibuang.
  const text = raw.replace(/[^0-9.,]/g, '').replace(/[.,]+$/, '').replace(/[.,]\d{2}$/, '')
  const digits = text.replace(/[.,]/g, '')
  const value = Number(digits)
  return Number.isFinite(value) && value > 0 ? value : null
}

export function checkResiText(text: string, noResi: string | null | undefined, amount: number | null | undefined): ResiCheck {
  const upper = text.toUpperCase()
  const compact = fold(upper)

  const resi = fold(String(noResi ?? ''))
  const resiMatch = resi ? compact.includes(resi) : null

  // Nilai uang: setelah "Rp", atau angka berformat ribuan (30.000 / 1.260.000).
  const amounts = new Set<number>()
  const rpAmounts = new Set<number>()
  for (const match of upper.matchAll(/RP\.?\s*([0-9][0-9.,\s]{2,})/g)) {
    const value = parseRupiah(match[1].replace(/\s/g, ''))
    if (value) { amounts.add(value); rpAmounts.add(value) }
  }
  for (const match of upper.matchAll(/\b\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?\b/g)) {
    const value = parseRupiah(match[0])
    if (value && value >= 1000) amounts.add(value)
  }
  const target = amount != null && Number(amount) > 0 ? Math.round(Number(amount)) : null
  const amountMatch = target == null ? null : amounts.has(target)

  const resiCandidates = [...new Set((upper.match(/[A-Z0-9][A-Z0-9-]{8,}/g) ?? []).filter((token) => /\d{5,}/.test(token.replace(/-/g, ''))))].slice(0, 4)

  // Yang ditampilkan: nilai berawalan "Rp" bila ada (angka lain bisa NPWP/telepon).
  const shown = rpAmounts.size ? rpAmounts : amounts
  return { resiMatch, amountMatch, amountsFound: [...shown].slice(0, 4), resiCandidates: resiCandidates.slice(0, 2) }
}

/** OCR jauh lebih akurat bila gambar diperbesar ke ±1800 px dan dibuat abu-abu kontras. */
async function prepareForOcr(source: string): Promise<HTMLCanvasElement> {
  const image = new Image()
  image.crossOrigin = 'anonymous'
  image.src = source
  await image.decode()
  const scale = 1800 / Math.max(image.naturalWidth, 1)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(image.naturalWidth * scale)
  canvas.height = Math.round(image.naturalHeight * scale)
  const context = canvas.getContext('2d')!
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.filter = 'grayscale(1) contrast(1.4)'
  context.imageSmoothingQuality = 'high'
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  return canvas
}

export async function readResiImage(source: string): Promise<string> {
  const { createWorker } = await import('tesseract.js')
  const canvas = await prepareForOcr(source)
  const worker = await createWorker('eng')
  try {
    const { data } = await worker.recognize(canvas)
    return data.text ?? ''
  } finally {
    await worker.terminate()
  }
}
