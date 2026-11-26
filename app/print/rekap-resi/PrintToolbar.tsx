'use client'

/** Pilihan vendor/bulan dan tombol cetak; disembunyikan saat dicetak. */
export function PrintToolbar({ vendors, vendor, month }: { vendors: string[]; vendor: string | null; month: string }) {
  return (
    <form className="toolbar" method="get">
      <label>
        Bulan <input type="month" name="month" defaultValue={month} />
      </label>
      <label>
        Vendor{' '}
        <select name="vendor" defaultValue={vendor ?? ''}>
          {vendors.map(name => <option key={name} value={name}>{name}</option>)}
        </select>
      </label>
      <button type="submit">Tampilkan</button>
      <button type="button" onClick={() => window.print()}>Cetak / Simpan PDF</button>
      <button type="button" onClick={() => window.close()}>Tutup</button>
    </form>
  )
}
