import { ImageResponse } from 'next/og'
import sharp from 'sharp'

/**
 * Tempel tanda waktu dan nama driver di bagian bawah foto (POD, BBM, biaya).
 * Teks digambar dengan next/og (font sudah dibundel) lalu ditumpuk dengan sharp,
 * sehingga tidak bergantung pada font yang terpasang di server.
 */
export async function stampPhoto(bytes: Uint8Array, lines: string[]): Promise<Uint8Array> {
  // rotate() tanpa argumen menerapkan orientasi EXIF. Foto HP Android yang tetap mendatar
  // (sensor kamera landscape, EXIF hilang saat dikompres) diputar 90° searah jarum jam agar portrait.
  const oriented = await sharp(bytes).rotate().toBuffer({ resolveWithObject: true })
  const landscape = oriented.info.width > oriented.info.height
  const { data: upright, info } = await sharp(oriented.data).rotate(landscape ? 90 : 0).jpeg({ quality: 82 }).toBuffer({ resolveWithObject: true })
  const width = info.width
  const fontSize = Math.max(18, Math.round(width / 34))
  const bannerHeight = Math.round(fontSize * (lines.length * 1.35 + 0.9))

  const banner = new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: `0 ${Math.round(fontSize * 0.8)}px`,
          background: 'rgba(0, 0, 0, 0.55)',
          color: '#FFFFFF',
          fontSize,
          lineHeight: 1.3,
        }}
      >
        {lines.map((line) => <div key={line} style={{ display: 'flex' }}>{line}</div>)}
      </div>
    ),
    { width, height: bannerHeight },
  )
  const overlay = Buffer.from(await banner.arrayBuffer())

  const stamped = await sharp(upright)
    .composite([{ input: overlay, gravity: 'south' }])
    .jpeg({ quality: 82 })
    .toBuffer()
  return new Uint8Array(stamped)
}

/** "17 Nov 2026 09.42 WIB" */
export function formatStampTime(date: Date) {
  return `${date.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} WIB`
}
