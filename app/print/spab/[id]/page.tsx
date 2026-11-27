import type { Metadata } from 'next'
import { getSpabForPrint } from '@/app/(app)/shipment/spab-actions'
import { SpabToolbar } from './SpabToolbar'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ pdf?: string }> }

const archiveName = (doc: { spab_no: string; customer_name: string | null; pss_no: string | null }) =>
  ['No.', String(doc.spab_no).replace(/\//g, ''), doc.customer_name, doc.pss_no].filter(Boolean).join(' ')

const longDate = (date: string | null) =>
  date ? new Date(`${date}T00:00:00+07:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' }) : ''
const dateTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }).replace(' pukul', '').replace('.', ':') : ''
const num = (value: number | null | undefined, digits = 0) =>
  value == null || !Number.isFinite(value) ? '-' : value.toLocaleString('id-ID', { maximumFractionDigits: digits })

// Nama file PDF mengikuti arsip lama: "No. 03649SPABSRUXI2026 RS HARAPAN PSS-2611-3093".
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const data = await getSpabForPrint(Number(id)).catch(() => null)
  if (!data) return { title: 'SPAB' }
  return { title: archiveName(data.doc) }
}

export default async function SpabPrintPage({ params, searchParams }: Props) {
  const { id } = await params
  const { pdf } = await searchParams
  const data = await getSpabForPrint(Number(id))
  if (!data) return <p style={{ padding: 24 }}>SPAB tidak ditemukan.</p>
  const { doc, items } = data

  const totalBoxes = items.reduce((sum, item) => sum + (item.boxes ?? 0), 0)
  const totalKg = items.reduce((sum, item) => sum + (item.total_kg ?? 0), 0)
  const totalCbm = items.reduce((sum, item) => sum + (item.total_cbm ?? 0), 0)
  const totalQty = items.reduce((sum, item) => sum + item.qty, 0)
  const incomplete = items.some(item => item.boxes == null || item.total_kg == null || item.total_cbm == null)
  const customerShort = String(doc.customer_name ?? '')

  return (
    <div className="spab-print">
      <SpabToolbar fileName={archiveName(doc)} autoPrint={pdf !== '1'} />
      <div className="page">
        <header className="kop">
          <strong>PT. SINAR RODA UTAMA</strong>
          <span>JL. GAJAH MADA NO. 3-5</span>
          <span>JAKARTA PUSAT</span>
          <span>PH 021-6337016 / FAX : 6333007</span>
        </header>

        <h1>SURAT PERINTAH AMBIL BARANG</h1>
        <p className="no">No. {doc.spab_no}</p>

        <div className="to">
          <strong>{doc.recipient}</strong>
          <div>Fax 1 : 021 5366 5640</div>
          <div>Fax 2 : 021 5366 5640</div>
          <div>Fax 3 :</div>
        </div>

        <p>Dengan hormat,<br />Bersama ini kami sampaikan data kiriman barang ke :</p>
        <div className="dest">
          <strong>{doc.customer_name}</strong>
          <div>{doc.customer_address ?? ''}</div>
        </div>
        <p>dengan rincian sebagai berikut :</p>

        <table className="items">
          <thead>
            <tr>
              <th className="c">NO</th>
              <th>NAMA BARANG</th>
              <th className="r">QTY (PCS)</th>
              <th className="r">ISI/ KARTON</th>
              <th className="r">BERAT/ CRT (KG)</th>
              <th className="r">JUMLAH (CRT)</th>
              <th className="r">TOTAL (KG)</th>
              <th className="r">@MOMENT (M3)</th>
              <th className="r">TOTAL MOMENT (M3)</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan={9} className="c">Rincian barang PSS belum tersedia.</td></tr>
            )}
            {items.map((item, index) => (
              <tr key={item.sku}>
                <td className="c">{index + 1}</td>
                <td>
                  <div className="sku">{item.sku}</div>
                  {item.name && <div className="name">{item.name}</div>}
                </td>
                <td className="r">{num(item.qty)}</td>
                <td className="r">{num(item.per_box)}</td>
                <td className="r">{num(item.box_weight, 2)}</td>
                <td className="r">{num(item.boxes)}</td>
                <td className="r">{num(item.total_kg, 2)}</td>
                <td className="r">{num(item.box_cbm, 3)}</td>
                <td className="r">{num(item.total_cbm, 3)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2} className="r"><strong>TOTAL</strong></td>
              <td className="r"><strong>{num(totalQty)}</strong></td>
              <td />
              <td />
              <td className="r"><strong>{num(totalBoxes)}</strong></td>
              <td className="r"><strong>{num(totalKg, 2)}</strong></td>
              <td />
              <td className="r"><strong>{num(totalCbm, 3)}</strong></td>
            </tr>
          </tfoot>
        </table>
        {incomplete && <p className="warn">* Sebagian SKU belum memiliki data kemasan di Master SKU; berat/volume belum lengkap.</p>}

        <table className="summary">
          <tbody>
            <tr><td>Karton</td><td className="r">{num(totalBoxes)}</td><td>Dus</td></tr>
            <tr><td>Total berat</td><td className="r">{num(totalKg, 2)}</td><td>Kg</td></tr>
            <tr><td>Total volume</td><td className="r">{num(totalCbm, 3)}</td><td>M3</td></tr>
            <tr><td>Jumlah</td><td className="r">{num(totalBoxes)}</td><td>Coly</td></tr>
          </tbody>
        </table>

        <div className="pickup">
          <div>Kawasan Industri Jababeka Jl. Jababeka Kav. W 44</div>
          <div>Cikarang</div>
          <div className="ref">
            {[doc.pss_no, customerShort, doc.fleet_type, doc.vehicle_no, doc.driver_name].filter(Boolean).join(' ')}
            {doc.trip_id ? ` · ${doc.trip_id}` : ''}
          </div>
          <div className="dates">
            <span>Tgl Input: {dateTime(doc.created_at)}</span>
            <span>Tgl Keluar Mobil: ____________________</span>
          </div>
        </div>

        <p>Catatan : Barang bisa diambil tanggal {longDate(doc.pickup_date ?? doc.spab_date)}{doc.notes ? `. ${doc.notes}` : ''}</p>
        <p>Demikian kami sampaikan, atas perhatian, bantuan dan kerjasama yang baik, kami ucapkan terima kasih.</p>
        <p className="faxback">Fax kembali ke PT. SINAR RODA UTAMA No. 021-6333007</p>

        <div className="sign">
          <div>
            <p>Jakarta, {longDate(doc.spab_date)}</p>
            <p>Hormat kami</p>
            <div className="space" />
            <p>( {doc.signer} )</p>
          </div>
          <div>
            <p>&nbsp;</p>
            <p>SPAB telah diterima ekspedisi <span className="mobil">No mobil : {doc.vehicle_no ?? ''}</span></p>
            <div className="space" />
            <p>( ......................... )</p>
          </div>
        </div>
      </div>

      <style>{`
        @page { size: A4 portrait; margin: 14mm 14mm 12mm; }
        body { background: #f1f1f1; }
        .spab-print { font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 9.5pt; padding: 16px; }
        .spab-print .toolbar { margin: 0 auto 12px; max-width: 182mm; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
        .spab-print .toolbar button:disabled { opacity: .6; cursor: wait; }
        .spab-print .toolbar-msg { font-size: 9pt; color: #1a7f37; }
        .spab-print .toolbar button { font: inherit; font-size: 10pt; padding: 6px 14px; border-radius: 8px; border: 1px solid #999; background: #fff; cursor: pointer; }
        .spab-print .page { background: #fff; max-width: 182mm; margin: 0 auto; padding: 12mm; box-shadow: 0 1px 4px rgba(0,0,0,.15); }
        .spab-print p { margin: 6px 0; }
        .spab-print .kop { display: flex; flex-direction: column; align-items: center; line-height: 1.35; }
        .spab-print .kop strong { font-size: 11pt; }
        .spab-print h1 { text-align: center; font-size: 12pt; margin: 14px 0 0; text-decoration: underline; }
        .spab-print .no { text-align: center; margin: 2px 0 12px; font-weight: bold; }
        .spab-print .to { margin-bottom: 10px; line-height: 1.4; }
        .spab-print .dest { margin: 6px 0 6px; line-height: 1.4; }
        .spab-print .items { width: 100%; border-collapse: collapse; margin-top: 4px; }
        .spab-print .items th, .spab-print .items td { border: 1px solid #333; padding: 3px 4px; vertical-align: top; }
        .spab-print .items th { font-size: 8pt; background: #eee; }
        .spab-print .items .sku { font-weight: bold; }
        .spab-print .items .name { font-size: 8pt; color: #333; }
        .spab-print .c { text-align: center; }
        .spab-print .r { text-align: right; }
        .spab-print .warn { font-size: 8pt; color: #8a5a00; }
        .spab-print .summary { margin: 8px 0 0 10mm; border-collapse: collapse; }
        .spab-print .summary td { padding: 1px 8px 1px 0; }
        .spab-print .pickup { margin-top: 10px; line-height: 1.4; }
        .spab-print .pickup .ref { font-weight: bold; margin-top: 4px; }
        .spab-print .pickup .dates { display: flex; justify-content: space-between; }
        .spab-print .faxback { text-align: right; }
        .spab-print .sign { display: flex; justify-content: space-between; margin-top: 10px; page-break-inside: avoid; }
        .spab-print .sign > div { width: 46%; }
        .spab-print .sign .space { height: 56px; }
        .spab-print .sign .mobil { margin-left: 12px; }
        @media print {
          body { background: #fff; }
          .spab-print { padding: 0; }
          .spab-print .toolbar { display: none; }
          .spab-print .page { box-shadow: none; padding: 0; max-width: none; }
        }
      `}</style>
    </div>
  )
}
