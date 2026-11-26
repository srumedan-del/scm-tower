import { getResiRecap } from '@/app/(app)/shipment/resi-actions'
import { wibToday } from '@/lib/wib-time'
import { PrintToolbar } from './PrintToolbar'

export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ month?: string; vendor?: string }> }

const IMAGES_PER_PAGE = 4

const jakarta = (iso: string | null, options: Intl.DateTimeFormatOptions) =>
  iso ? new Date(iso).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', ...options }) : '-'
const dmy = (date: string | null) => (date ? date.split('-').reverse().join('/') : '-')
const rupiah = (value: number | null) => (value ? value.toLocaleString('id-ID') : '-')

export default async function RekapResiPrintPage({ searchParams }: Props) {
  const params = await searchParams
  const month = /^\d{4}-\d{2}$/.test(params.month ?? '') ? params.month! : wibToday().slice(0, 7)
  const recap = await getResiRecap(month, params.vendor ?? null)
  const periodLabel = new Date(`${month}-01T00:00:00+07:00`).toLocaleDateString('id-ID', { month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' })
  const total = recap.rows.reduce((sum, row) => sum + (row.amount ?? 0), 0)
  const withImage = recap.rows.filter(row => row.image_url)
  const withoutResi = recap.rows.filter(row => !row.no_resi?.trim()).length
  const imagePages: typeof withImage[] = []
  for (let index = 0; index < withImage.length; index += IMAGES_PER_PAGE) imagePages.push(withImage.slice(index, index + IMAGES_PER_PAGE))
  const printedAt = jakarta(new Date().toISOString(), { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  return (
    <div className="rr-print">
      <PrintToolbar vendors={recap.vendors} vendor={recap.vendor} month={month} />

      <section className="sheet">
        <header className="head">
          <div>
            <h1>Rekap Resi Pengiriman Retail</h1>
            <p className="sub">PT Sinar Roda Utama · Medan</p>
          </div>
          <table className="meta">
            <tbody>
              <tr><td>Vendor</td><td>: <strong>{recap.vendor ?? '-'}</strong></td></tr>
              <tr><td>Periode</td><td>: {periodLabel} (tanggal dokumen)</td></tr>
              <tr><td>Dicetak</td><td>: {printedAt} WIB</td></tr>
            </tbody>
          </table>
        </header>

        {recap.rows.length === 0 ? (
          <p className="empty">Tidak ada kiriman retail untuk vendor dan periode ini.</p>
        ) : (
          <table className="grid">
            <thead>
              <tr>
                <th className="c">No</th>
                <th>Tgl Dokumen</th>
                <th>Serah ke Vendor</th>
                <th>PSS</th>
                <th>Pelanggan</th>
                <th>Kota</th>
                <th>No. Resi</th>
                <th className="r">Biaya (Rp)</th>
                <th className="c">Gambar</th>
              </tr>
            </thead>
            <tbody>
              {recap.rows.map((row, index) => (
                <tr key={row.id}>
                  <td className="c">{index + 1}</td>
                  <td>{dmy(row.document_date)}</td>
                  <td>{jakarta(row.dispatch_time, { day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
                  <td className="mono">{row.pss_no ?? '-'}</td>
                  <td>{row.customer_name ?? '-'}</td>
                  <td>{row.destination_city ?? '-'}</td>
                  <td className="mono">{row.no_resi ?? '-'}</td>
                  <td className="r">{rupiah(row.amount)}</td>
                  <td className="c">{row.image_url ? `Lamp. ${withImage.indexOf(row) + 1}` : '-'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={7} className="r"><strong>Total {recap.rows.length} kiriman</strong></td>
                <td className="r"><strong>{rupiah(total)}</strong></td>
                <td />
              </tr>
            </tfoot>
          </table>
        )}

        {recap.rows.length > 0 && (
          <p className="note">
            {withImage.length} dari {recap.rows.length} kiriman memiliki gambar resi
            {withoutResi > 0 ? ` · ${withoutResi} kiriman belum ada nomor resi` : ''}.
          </p>
        )}

        <div className="sign">
          <div><p>Dibuat oleh,</p><div className="line" /><p>Admin SCM</p></div>
          <div><p>Diperiksa oleh,</p><div className="line" /><p>&nbsp;</p></div>
        </div>
      </section>

      {imagePages.map((page, pageIndex) => (
        <section key={pageIndex} className="sheet images">
          <h2>Lampiran Gambar Resi · {recap.vendor} · {periodLabel}</h2>
          <div className="img-grid">
            {page.map((row, index) => (
              <figure key={row.id}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={row.image_url!} alt={`Resi ${row.no_resi ?? row.pss_no}`} />
                <figcaption>
                  <strong>Lamp. {pageIndex * IMAGES_PER_PAGE + index + 1}</strong> · {row.pss_no} · {row.no_resi ?? '-'}
                  <br />{row.customer_name ?? '-'}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      ))}

      <style>{`
        @page { size: A4 portrait; margin: 12mm; }
        body { background: #f1f1f1; }
        .rr-print { font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 9.5pt; padding: 16px; }
        .rr-print .toolbar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 0 auto 12px; max-width: 186mm; }
        .rr-print .toolbar label { display: flex; gap: 6px; align-items: center; font-size: 10pt; }
        .rr-print .toolbar input, .rr-print .toolbar select, .rr-print .toolbar button { font: inherit; font-size: 10pt; padding: 6px 10px; border-radius: 8px; border: 1px solid #999; background: #fff; }
        .rr-print .toolbar button { cursor: pointer; }
        .rr-print .sheet { background: #fff; max-width: 186mm; margin: 0 auto 16px; padding: 10mm; box-shadow: 0 1px 4px rgba(0,0,0,.15); }
        .rr-print .head { display: flex; justify-content: space-between; gap: 16px; border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 10px; }
        .rr-print h1 { font-size: 15pt; margin: 0; }
        .rr-print .sub { margin: 2px 0 0; color: #555; }
        .rr-print .meta td { padding: 1px 4px; vertical-align: top; }
        .rr-print .grid { width: 100%; border-collapse: collapse; }
        .rr-print .grid th, .rr-print .grid td { border: 1px solid #555; padding: 3px 5px; vertical-align: top; }
        .rr-print .grid th { background: #e9e9e9; text-align: left; font-size: 9pt; }
        .rr-print .grid tr { page-break-inside: avoid; }
        .rr-print .c { text-align: center; }
        .rr-print .r { text-align: right; }
        .rr-print .mono { font-family: 'Courier New', monospace; white-space: nowrap; }
        .rr-print .note { margin: 6px 0 0; color: #444; font-size: 8.5pt; }
        .rr-print .empty { padding: 24px 0; text-align: center; color: #666; }
        .rr-print .sign { display: flex; justify-content: space-between; margin-top: 24px; page-break-inside: avoid; }
        .rr-print .sign > div { width: 45%; text-align: center; }
        .rr-print .sign .line { height: 48px; border-bottom: 1px solid #111; margin: 4px 24px; }
        .rr-print .images { page-break-before: always; }
        .rr-print .images h2 { font-size: 11pt; margin: 0 0 8px; }
        .rr-print .img-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8mm; }
        .rr-print figure { margin: 0; border: 1px solid #bbb; padding: 4px; page-break-inside: avoid; }
        .rr-print figure img { display: block; width: 100%; height: 108mm; object-fit: contain; background: #fff; }
        .rr-print figcaption { font-size: 8.5pt; margin-top: 4px; }
        @media print {
          body { background: #fff; }
          .rr-print { padding: 0; }
          .rr-print .toolbar { display: none; }
          .rr-print .sheet { box-shadow: none; margin: 0; padding: 0; max-width: none; }
        }
      `}</style>
    </div>
  )
}
