import { requireAuthenticatedUser } from '@/lib/requireUser'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { lineDifference, opnameDateParts } from '@/lib/stock-opname'
import { PrintOnLoad } from './PrintOnLoad'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ doc?: string }> }

const fmtDate = (iso: string | null) => (iso ? iso.split('-').reverse().join('/') : '')
const num = (value: number | null) => (value == null ? '' : value.toLocaleString('id-ID'))

export default async function OpnamePrintPage({ params, searchParams }: Props) {
  await requireAuthenticatedUser()
  const { id } = await params
  const doc = (await searchParams).doc === 'lembar' ? 'lembar' : 'berita'
  const [{ data: session }, { data: rawLines }, { data: settings }] = await Promise.all([
    supabaseAdmin.from('stock_opname_session').select('*').eq('id', Number(id)).maybeSingle(),
    supabaseAdmin.from('stock_opname_line').select('*').eq('session_id', Number(id)).order('sort_order'),
    supabaseAdmin.from('stock_opname_settings').select('signers').eq('id', 1).maybeSingle(),
  ])
  if (!session) return <p style={{ padding: 24 }}>Sesi opname tidak ditemukan.</p>
  const lines = (rawLines ?? []).map(line => ({ ...line, qty_system: Number(line.qty_system), qty_physical: line.qty_physical == null ? null : Number(line.qty_physical) }))
  const signers = (settings?.signers as { name: string; title: string }[] | undefined) ?? []
  const date = opnameDateParts(session.opname_date)

  return (
    <div className="opname-print">
      <style>{`
        @page { size: A4 landscape; margin: 10mm; }
        body { background: #fff !important; }
        .opname-print { font-family: Calibri, 'Segoe UI', Arial, sans-serif; color: #000; font-size: 10pt; padding: 12px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .opname-print table { border-collapse: collapse; width: 100%; }
        .opname-print .sheet th, .opname-print .sheet td { border: 1px solid #000; padding: 3px 5px; vertical-align: middle; }
        .opname-print .sheet th { background: #D9D9D9; font-weight: 700; text-align: center; }
        .opname-print .r { text-align: right; } .opname-print .c { text-align: center; }
        .opname-print .head td { border: 1px solid #000; padding: 4px 6px; }
        .opname-print .sign td { text-align: center; padding: 4px; vertical-align: bottom; }
        .opname-print .toolbar { margin-bottom: 12px; display: flex; gap: 8px; }
        .opname-print .toolbar button { font: inherit; padding: 6px 14px; border-radius: 8px; border: 1px solid #999; background: #fff; cursor: pointer; }
        @media print { .opname-print .toolbar { display: none; } .opname-print { padding: 0; } }
      `}</style>
      <PrintOnLoad />

      {doc === 'lembar' ? (
        <>
          <table className="head" style={{ marginBottom: 10 }}>
            <tbody><tr>
              <td style={{ fontWeight: 700, fontSize: '12pt' }}>FORM STOCK OPNAME {String(session.period ?? 'Mingguan').toUpperCase()} BLOOD LINE &amp; ELISIO</td>
              <td style={{ width: '32%' }}>TANGGAL : {date.long}</td>
            </tr></tbody>
          </table>
          <table className="sheet">
            <thead><tr>
              <th style={{ width: '5%' }}>No</th><th style={{ width: '16%' }}>No Item</th><th>Nama Item</th><th style={{ width: '13%' }}>Lot No</th><th style={{ width: '12%' }}>Expiration Date</th><th style={{ width: '14%' }}>Quantity Fisik</th>
            </tr></thead>
            <tbody>
              {lines.map((line, i) => (
                <tr key={line.id}>
                  <td className="c">{i + 1}</td><td>{line.no_item}</td><td>{line.nama_item}</td>
                  <td>{line.lot_no}</td><td className="c">{fmtDate(line.expiration_date)}</td><td style={{ height: 26 }} />
                </tr>
              ))}
            </tbody>
          </table>
          <table className="sign" style={{ marginTop: 28, width: '60%' }}>
            <tbody>
              <tr><td>Penghitung</td><td>Pencatat</td></tr>
              <tr><td style={{ height: 60 }}>(&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;)</td><td>(&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;)</td></tr>
            </tbody>
          </table>
        </>
      ) : (
        <>
          <table className="head" style={{ marginBottom: 10 }}>
            <tbody>
              <tr>
                <td rowSpan={2} style={{ fontWeight: 700, fontSize: '13pt', textAlign: 'center' }}>SELISIH STOCK OPNAME GUDANG MEDAN<br /><span style={{ fontSize: '11pt' }}>PERIODE {date.upper}</span></td>
                <td style={{ width: '24%' }}>F-SRU-SCMWHL-37</td>
              </tr>
              <tr><td>No. Revisi : 1 &nbsp;·&nbsp; Tanggal Revisi : 01-Nov-23</td></tr>
            </tbody>
          </table>
          <p>Pada hari {date.day}, tanggal {date.long} telah dilaksanakan stock opname di gudang Medan oleh Tim Accounting dan Tim SCM</p>
          <p>Dari hasil stock opname didapatkan hasil sebagai berikut :</p>
          <table className="sheet">
            <thead><tr>
              <th>No</th><th>BIN Code</th><th>Kategori Produk</th><th>Nama Item</th><th>No Item</th><th>Lot No</th><th>Expiration Date</th><th>Quantity System</th><th>PIC</th><th>Quantity Fisik</th><th>Selisih</th><th>Penyebab</th><th>Action Plan</th><th>Status</th>
            </tr></thead>
            <tbody>
              {lines.map((line, i) => {
                const diff = lineDifference(line)
                return (
                  <tr key={line.id}>
                    <td className="c">{i + 1}</td><td>{line.bincode}</td><td>{line.kategori}</td><td>{line.nama_item}</td><td>{line.no_item}</td>
                    <td>{line.lot_no}</td><td className="c">{fmtDate(line.expiration_date)}</td><td className="r">{num(line.qty_system)}</td><td>{session.pic}</td>
                    <td className="r">{num(line.qty_physical)}</td><td className="r">{diff == null ? '' : diff === 0 ? '-' : num(diff)}</td>
                    <td>{line.penyebab}</td><td>{line.action_plan}</td><td className="c">{line.line_status}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p style={{ marginTop: 12 }}>Demikian berita acara stock opname ini dibuat sebagai bentuk pertanggung jawaban atas pelaksanaan stock opname yang telah di lakukan</p>
          <table className="sign" style={{ marginTop: 16 }}>
            <tbody>
              <tr><td style={{ width: '20%' }}>Dibuat Oleh,</td><td colSpan={4}>Diperiksa Oleh,</td></tr>
              <tr>{Array.from({ length: 5 }, (_, i) => <td key={i} style={{ height: 70 }} />)}</tr>
              <tr>{Array.from({ length: 5 }, (_, i) => <td key={i} style={{ fontWeight: 700, textDecoration: 'underline' }}>{signers[i]?.name ?? ''}</td>)}</tr>
              <tr>{Array.from({ length: 5 }, (_, i) => <td key={i}>{signers[i]?.title ?? ''}</td>)}</tr>
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}
