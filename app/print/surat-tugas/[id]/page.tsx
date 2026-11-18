import { requireAuthenticatedUser } from '@/lib/requireUser'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { PrintOnLoad } from '@/app/print/opname/[id]/PrintOnLoad'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ id: string }> }

/** Baris kosong minimal di tabel tujuan, sama dengan form kertas (03 SURAT TUGAS). */
const MIN_ROWS = 7

const rupiah = (value: number) => (value ? value.toLocaleString('id-ID') : '-')
const num = (value: number | null | undefined, digits = 0) =>
  value == null || !Number.isFinite(value) ? '' : value.toLocaleString('id-ID', { maximumFractionDigits: digits })
const jakarta = (iso: string | null, options: Intl.DateTimeFormatOptions) =>
  iso ? new Date(iso).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', ...options }) : ''
const dayDate = (iso: string | null) => jakarta(iso, { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
const clock = (iso: string | null) => (iso ? jakarta(iso, { hour: '2-digit', minute: '2-digit' }).replace(':', '.') : '')
const sum = (rows: any[], field: string) => rows.reduce((total, row) => total + (Number(row[field]) || 0), 0)

/** Logo roda merah PT Sinar Roda Utama (digambar ulang dari form kertas). */
function Logo() {
  return (
    <svg viewBox="0 0 40 40" width="11mm" height="11mm" aria-hidden="true">
      <circle cx="20" cy="20" r="16.5" fill="none" stroke="#E21F26" strokeWidth="5" />
      {/* Tiga jari-jari menyilang di tengah roda. */}
      {[90, 30, 150].map((angle) => {
        const dx = 16 * Math.cos((angle * Math.PI) / 180)
        const dy = 16 * Math.sin((angle * Math.PI) / 180)
        return <line key={angle} x1={20 - dx} y1={20 + dy} x2={20 + dx} y2={20 - dy} stroke="#E21F26" strokeWidth="4.5" />
      })}
    </svg>
  )
}

export default async function SuratTugasPrintPage({ params }: Props) {
  await requireAuthenticatedUser()
  const { id } = await params
  const { data: current } = await supabaseAdmin.from('shipment_tracking').select('*').eq('id', Number(id)).maybeSingle()
  if (!current) return <p style={{ padding: 24 }}>Data shipment tidak ditemukan.</p>

  // Satu Surat Tugas per trip: semua PSS di trip yang sama ikut tercetak.
  const tripNo = current.trip_id ? String(current.trip_id) : null
  const { data: tripRows } = tripNo
    ? await supabaseAdmin.from('shipment_tracking').select('*').eq('trip_id', tripNo).order('delivery_sequence', { ascending: true, nullsFirst: false }).order('id')
    : { data: [current] }
  const rows = (tripRows ?? [current]) as any[]

  const { data: trip } = tripNo
    ? await supabaseAdmin.from('trip').select('trip_no, vehicle_id, driver_id, helper_id, started_at, dispatch_time, completed_at, odometer_start, odometer_end').eq('trip_no', tripNo).maybeSingle()
    : { data: null }
  const vehicleId = trip?.vehicle_id ?? current.vehicle_id
  const driverId = trip?.driver_id ?? current.driver_id
  const helperId = trip?.helper_id ?? current.helper_id
  const pssNos = rows.map((row) => row.pss_no).filter(Boolean) as string[]

  const [vehicle, crew, loads, headers] = await Promise.all([
    vehicleId ? supabaseAdmin.from('transport_fleet').select('vehicle_no').eq('id', vehicleId).maybeSingle() : Promise.resolve({ data: null }),
    supabaseAdmin.from('master_driver').select('id, driver_name').in('id', [driverId, helperId].filter((value) => value != null)),
    pssNos.length ? supabaseAdmin.from('vw_pss_load_summary').select('pss_no, total_koli').in('pss_no', pssNos) : Promise.resolve({ data: [] }),
    pssNos.length ? supabaseAdmin.from('outbound_header').select('pss_no, order_no').in('pss_no', pssNos) : Promise.resolve({ data: [] }),
  ])
  const crewName = new Map(((crew.data ?? []) as any[]).map((row) => [Number(row.id), String(row.driver_name)]))
  const driverName = driverId != null ? crewName.get(Number(driverId)) ?? '' : ''
  const helperName = helperId != null ? crewName.get(Number(helperId)) ?? '' : ''
  const koliByPss = new Map(((loads.data ?? []) as any[]).map((row) => [String(row.pss_no), Number(row.total_koli) || 0]))
  const orderByPss = new Map(((headers.data ?? []) as any[]).map((row) => [String(row.pss_no), row.order_no as string | null]))

  const destinations = rows.map((row) => {
    const ref = row.pss_no ?? (row.crossdocking_id != null ? `CD-${row.crossdocking_id}` : '')
    return {
      tujuan: [row.customer_name, row.destination_city].filter(Boolean).join(' - '),
      koli: row.pss_no ? koliByPss.get(row.pss_no) ?? null : null,
      ref,
      doc: row.pss_no ? orderByPss.get(row.pss_no) ?? '' : '',
    }
  })
  const totalKoli = destinations.reduce((total, row) => total + (row.koli ?? 0), 0)
  const blankRows = Math.max(0, MIN_ROWS - destinations.length)

  // Biaya trip ada di satu PSS pembawa (lib/trip-cost); TKBM dan parkir per PSS, dijumlahkan untuk trip.
  const liter = sum(rows, 'bbm_liter')
  const costs = {
    bbm: sum(rows, 'bbm_rupiah'),
    bongkar: rows.reduce((total, row) => total + (Number(row.bongkar_muat_cost ?? row.biaya_tkbm) || 0), 0),
    hotel: sum(rows, 'hotel_cost'),
    makanDriver: sum(rows, 'uang_makan_driver'),
    makanKenek: sum(rows, 'uang_makan_helper'),
    tol: sum(rows, 'toll_cost'),
    parkir: sum(rows, 'parkir_cost'),
  }
  const totalBiaya = Object.values(costs).reduce((total, value) => total + value, 0)
  const kmStart = trip?.odometer_start != null ? Number(trip.odometer_start) : null
  const kmEnd = trip?.odometer_end != null ? Number(trip.odometer_end) : null
  const distance = kmStart != null && kmEnd != null && kmEnd >= kmStart ? kmEnd - kmStart : null
  const fcr = distance != null && liter > 0 ? distance / liter : null
  const departed = trip?.started_at ?? trip?.dispatch_time ?? current.dispatch_time ?? null
  const returned = trip?.completed_at ?? null
  const crewLabel = [driverName, helperName].filter(Boolean).join(' / ')
  const printDate = new Date().toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'long', year: 'numeric' })

  const info: Array<[string, string]> = [
    ['Nomor Surat Tugas', tripNo ?? (current.pss_no ?? '')],
    ['No. Plat Kendaraan', (vehicle.data as any)?.vehicle_no ?? ''],
    ['Driver / Kenek', crewLabel],
    ['Berangkat Hari / Tgl', dayDate(departed)],
    ['Jam Out', clock(departed)],
    ['Kembali Hari / Tgl', dayDate(returned)],
    ['Jam In', clock(returned)],
  ]
  const costLines: Array<[string, number]> = [
    ['2. Bongkar Muat', costs.bongkar],
    ['3. Hotel', costs.hotel],
    ['4. Uang Makan Driver', costs.makanDriver],
    ['5. Uang Makan Kenek', costs.makanKenek],
    ['6. Tol', costs.tol],
    ['7. Parkir', costs.parkir],
  ]

  const copy = (
    <section className="st">
      <div className="st-head">
        <div className="st-brand">
          <div className="st-logo-row">
            <Logo />
            <h1>SURAT TUGAS</h1>
          </div>
          <div className="st-company"><span className="pt">PT.</span> Sinar Roda Utama</div>
          <div>Pergudangan Paragon No.9C, Jl. Asrama,</div>
          <div>Kec. Medan Helvetia, Medan Sumatera Utara 20123</div>
          <div>Dengan ini ditugaskan :</div>
        </div>
        <table className="st-info">
          <tbody>
            {info.map(([label, value]) => (
              <tr key={label}><td className="lbl">{label}</td><td className="colon">:</td><td className="val">{value}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      <table className="st-grid">
        <colgroup><col style={{ width: '42%' }} /><col style={{ width: '7%' }} /><col style={{ width: '24%' }} /><col style={{ width: '27%' }} /></colgroup>
        <thead>
          <tr><th>Tujuan</th><th>Jumlah</th><th colSpan={2}>Keterangan</th></tr>
          <tr className="sub"><th>RS, Ekspedisi, dll.</th><th>Koli</th><th colSpan={2}>Nomor Surat jalan, Mutasi, Dokumen</th></tr>
        </thead>
        <tbody>
          {destinations.map((row, index) => (
            <tr key={index}><td>{row.tujuan}</td><td className="c">{row.koli || ''}</td><td>{row.ref}</td><td>{row.doc}</td></tr>
          ))}
          {Array.from({ length: blankRows }, (_, index) => (
            <tr key={`blank-${index}`}><td /><td /><td /><td /></tr>
          ))}
          <tr className="total"><td>TOTAL</td><td className="c">{totalKoli || ''}</td><td /><td /></tr>
        </tbody>
      </table>

      <table className="st-bbm">
        <tbody>
          <tr>
            <td rowSpan={2} className="bbm-label">1. BBM</td>
            <td className="lbl">Jumlah Liter</td><td className="colon">:</td><td className="val">{liter ? `${num(liter, 2)} L` : ''}</td>
            <td className="lbl">KM Awal</td><td className="colon">:</td><td className="val">{num(kmStart)}</td>
            <td className="lbl">KM Akhir</td><td className="colon">:</td><td className="val">{num(kmEnd)}</td>
          </tr>
          <tr>
            <td className="lbl">Jumlah Rupiah</td><td className="colon">:</td><td className="val">{costs.bbm ? `Rp ${rupiah(costs.bbm)}` : ''}</td>
            <td className="lbl">Jarak Tempuh</td><td className="colon">:</td><td className="val">{distance != null ? `${num(distance)} km` : ''}</td>
            <td className="lbl">FCR</td><td className="colon">:</td><td className="val">{fcr != null ? `${num(fcr, 2)} km/L` : ''}</td>
          </tr>
        </tbody>
      </table>

      <div className="st-bottom">
        <table className="st-costs">
          <tbody>
            {costLines.map(([label, value]) => (
              <tr key={label}><td className="lbl">{label}</td><td className="rp">: Rp.</td><td className="amt">{rupiah(value)}</td></tr>
            ))}
            <tr className="grand"><td className="lbl">TOTAL BIAYA PENGIRIMAN</td><td className="rp">: Rp.</td><td className="amt">{rupiah(totalBiaya)}</td></tr>
          </tbody>
        </table>
        <div className="st-request">
          <div>Medan, Tanggal : {printDate}</div>
          <div>Diajukan Oleh :</div>
          <div className="st-crew">
            <span>( {driverName || 'Driver'} )</span>
            <span>( {helperName || 'Kenek'} )</span>
          </div>
          <div className="st-crew roles"><span>Driver</span><span>Kenek</span></div>
        </div>
      </div>

      <div className="st-sign">
        <div><div>Diperiksa Oleh :</div><div className="name">( Erwin Sapta )</div><div>Kepala Gudang</div></div>
        <div><div>Disetujui Oleh :</div><div className="name">( .............................. )</div><div>FAT</div></div>
      </div>
    </section>
  )

  return (
    <div className="st-print">
      <style>{`
        /* Kertas 1/2 A4 mendatar (210 x 148,5 mm), satu Surat Tugas per lembar. */
        @page {
          size: 210mm 148.5mm;
          margin: 6mm 10mm;
          @top-left { content: ""; } @top-center { content: ""; } @top-right { content: ""; }
          @bottom-left { content: ""; } @bottom-center { content: ""; } @bottom-right { content: ""; }
        }
        body { background: #fff !important; }
        .st-print { font-family: Calibri, 'Segoe UI', Arial, sans-serif; color: #000; font-size: 8.5pt; padding: 12px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .st-print .toolbar { margin-bottom: 12px; display: flex; gap: 8px; }
        .st-print .toolbar button { font: inherit; font-size: 10pt; padding: 6px 14px; border-radius: 8px; border: 1px solid #999; background: #fff; cursor: pointer; }
        .st { width: 190mm; height: 136mm; box-sizing: border-box; display: flex; flex-direction: column; gap: 1.2mm; overflow: hidden; }
                .st table { border-collapse: collapse; }
        .st-head { display: flex; justify-content: space-between; gap: 6mm; }
        .st-brand { line-height: 1.25; }
        .st-logo-row { display: flex; align-items: center; gap: 10mm; margin-left: 12mm; }
        .st-logo-row h1 { font-size: 16pt; font-weight: 700; margin: 0; letter-spacing: 0.3px; }
        .st-company { font-family: Georgia, 'Times New Roman', serif; font-size: 11.5pt; color: #1F3B70; }
        .st-company .pt { font-variant: small-caps; }
        .st-info { width: 74mm; align-self: flex-start; }
        .st-info td { padding: 0.15mm 0; vertical-align: top; }
        .st-info .lbl { width: 30mm; white-space: nowrap; }
        .st-info .colon { width: 4mm; }
        .st-info .val { font-weight: 700; }
        .st-grid { width: 100%; border: 1px solid #1F3B70; }
        .st-grid th { font-weight: 700; padding: 0.4mm 2mm; border-left: 1px solid #1F3B70; }
        .st-grid thead tr:first-child th { padding-top: 0.8mm; }
        .st-grid thead tr.sub th { border-bottom: 1px solid #1F3B70; }
        .st-grid th:first-child { border-left: none; }
        .st-grid td { height: 3.9mm; padding: 0 2mm; border-top: 1px solid #1F3B70; border-left: 1px solid #1F3B70; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 0; }
        .st-grid td:first-child { border-left: none; }
        .st-grid tr.total td { border-top: 2.5px solid #1F3B70; font-weight: 700; }
        .st-grid .c { text-align: center; }
        .st-bbm { width: 100%; border: 1px solid #1F3B70; }
        .st-bbm td { padding: 0.3mm 1.5mm; white-space: nowrap; }
        .st-bbm .bbm-label { width: 14mm; }
        .st-bbm .colon { width: 3mm; }
        .st-bbm .val { font-weight: 700; min-width: 22mm; }
        .st-bottom { display: flex; gap: 6mm; }
        .st-costs { width: 112mm; border: 1px solid #1F3B70; }
        .st-costs td { padding: 0.15mm 2mm; }
        .st-costs .lbl { width: 52mm; }
        .st-costs .rp { width: 12mm; white-space: nowrap; }
        .st-costs .amt { text-align: right; font-weight: 700; }
        .st-costs tr.grand td { font-weight: 700; border-top: 1.5px solid #000; }
        .st-request { flex: 1; display: flex; flex-direction: column; gap: 0.6mm; }
        .st-crew { margin-top: auto; display: flex; justify-content: space-around; font-weight: 700; }
        .st-crew.roles { margin-top: 0; font-weight: 400; }
        .st-sign { display: flex; gap: 30mm; padding-left: 8mm; }
        .st-sign > div { display: flex; flex-direction: column; gap: 0; }
        .st-sign .name { margin-top: 6mm; font-weight: 700; }
        @media print { .st-print .toolbar { display: none; } .st-print { padding: 0; } }
      `}</style>
      <PrintOnLoad />
      {copy}
    </div>
  )
}
