# Customer Stock Map — Setup

## 1. Install dependency
```bash
npm install leaflet react-leaflet
npm install -D @types/leaflet
```

## 2. Taruh file
- `CustomerStockMap.tsx` → `components/customer-stock-map/CustomerStockMap.tsx`
- `page-example.tsx` → contoh saja, sesuaikan dengan struktur routing kamu (lihat isinya untuk cara import yang benar)

## 3. Kenapa harus `dynamic(..., { ssr: false })`
Leaflet mengakses objek `window` saat di-load. Next.js me-render Server Component/Client Component pertama kali di server, jadi kalau `CustomerStockMap` diimpor langsung, build akan error `window is not defined`. Solusinya: import lewat `next/dynamic` dengan `ssr: false` seperti di `page-example.tsx`.

## 4. Struktur data
Komponen menerima prop opsional `customers: Customer[]`. Kalau tidak diisi, dia pakai 20 data contoh (kota/kabupaten di Aceh & Sumatera Utara). Ganti dengan data asli:

```ts
interface Customer {
  id: string
  name: string
  city: string
  province: 'Aceh' | 'Sumatera Utara'
  lat: number
  lng: number
  machineCount: number
  lastOrderDate: string   // format ISO: '2026-07-12'
  isPareto: boolean       // true kalau termasuk customer pareto (kontribusi tinggi)
}
```

## 5. Logika status (bisa disesuaikan)
Di dalam file, fungsi `expectedCycleDays()` menentukan ambang batas "wajar" hari sejak order terakhir berdasarkan jumlah mesin:
- ≥ 40 mesin → siklus order diharapkan tiap 21 hari
- ≥ 20 mesin → 30 hari
- < 20 mesin → 45 hari

Kalau lewat ambang batas ini, customer ditandai "Butuh Perhatian". Kombinasi dengan `isPareto` menghasilkan 4 status:
- **Pareto Kritis** (merah) — customer pareto yang overdue → prioritas tertinggi
- **Butuh Perhatian** (oranye) — bukan pareto tapi overdue
- **Pareto Sehat** (hijau) — pareto, order masih dalam siklus wajar
- **Normal** (biru) — bukan pareto, order masih wajar

Angka-angka ini contoh awal — sesuaikan dengan cycle time riil produk kamu (bisa dari histori order rata-rata per customer, bukan angka tetap).

## 6. Kenapa pakai `CircleMarker`, bukan pin/marker biasa
Radius lingkaran mengikuti `sqrt(machineCount)`, jadi ukuran titik di peta langsung merepresentasikan besar-kecilnya customer tanpa perlu buka popup. Ini juga menghindari isu klasik Leaflet di Next/Webpack di mana ikon marker default sering tidak muncul (path asset-nya patah saat bundling).

## 7. Warna & style
Semua warna diambil langsung dari token yang sudah ada di `tailwind.config.ts` kamu (`canvas`, `surface`, `border`, `text`, `muted`, `blue`, `green`, `orange`, `red`), jadi tampilannya otomatis konsisten dengan bagian lain aplikasi.