# Workflow SCM Control Tower - Customer Map

Dokumen ini adalah catatan kerja bertahap untuk fitur peta customer rumah sakit dan keputusan replenishment.

## Status

- Tahap aktif: 2 - Customer master dan peta awal
- Status: map publik dan maintain tersembunyi sudah diimplementasikan; pembatasan admin ditunda
- Tanggal pencatatan: 2026-08-29
- Halaman target: `app/(app)/dashboard/page.tsx`
- Referensi struktur data: `data/Monitoring Stock HD Rumah Sakit.xlsx`
- Source of truth aplikasi: Supabase

## Tahap 1 - Validasi sumber data

### Hasil yang sudah diverifikasi

- Workbook memiliki satu sheet: `Dashboard`.
- Terdapat 26 baris customer pada contoh Excel; batas aplikasi ditetapkan maksimal 27 customer unik dari Supabase.
- Semua 26 customer memiliki nama, lokasi kabupaten/kota, jumlah mesin HD, dan nilai stok.
- 23 customer memiliki nilai pada kolom `FU-PO`.
- Kolom yang terbaca dari header Excel:
  - `NAMA CUSTOMER/ RUMAH SAKIT`
  - `KABUPATEN/KOTA`
  - `Jumlah Mesin HD`
  - `Estimasi`
  - `Kebutuhan`
  - `Safety Stok`
  - `ROP`
  - `Stok Akhir`
  - `Pengiriman`
  - `Estimasi Stok`
  - `DOI`
  - `HABIS`
  - `Available`
  - `FU-PO`
- Lokasi yang muncul mencakup Sumatera Utara dan Aceh, antara lain Medan, Rantau Prapat, Pematang Siantar, Banda Aceh, Takengon, Aceh Tamiang, Pidi - Aceh, dan Langsa - Aceh.

### Keputusan sementara

- Peta akan diintegrasikan ke dashboard Pareto customer stock, bukan landing page.
- Implementasi awal menggunakan Leaflet dan tile provider yang kompatibel dengan OpenStreetMap.
- Data Excel akan diproses menjadi data terstruktur sebelum dipakai marker peta.
- Filter region akan menormalkan variasi nama Aceh, termasuk `Nanggroe Aceh Darussalam`, menjadi `Aceh`.
- Status marker awal akan berbasis DOI/coverage dan dibandingkan dengan lead time plus safety buffer.
- Excel hanya digunakan untuk memahami contoh struktur field; aplikasi tidak membaca Excel saat runtime.
- Data operasional customer, lokasi, stock, order terakhir, dan lead time akan dipelihara di tabel Supabase `customers`.
- Dashboard memakai subscription Supabase Realtime untuk menerima INSERT, UPDATE, dan DELETE customer.
- Tombol `Peta` dan `Maintain data` berada dalam satu panel; mode maintain menggantikan peta dengan form dan tabel CRUD.
- Schema awal Supabase tersedia di `supabase/customer-map.sql`, termasuk validasi koordinat, trigger `updated_at`, RLS, dan publication Realtime.
- Peta dibuka pada cakupan gabungan Aceh dan Sumatera Utara, dengan filter provinsi.
- Customer master dideduplikasi berdasarkan nama dan dibatasi maksimal 27 record.
- Maintain awal hanya meminta nama, kabupaten/kota, provinsi, latitude, longitude, dan jumlah mesin HD.
- Tampilan peta bersifat publik/read-only; visitor tidak perlu login.
- Maintain sementara dapat dibuka dengan kombinasi tersembunyi `Ctrl + Shift + M`; tidak ada tombol maintain pada landing page.
- Pembatasan admin dan login untuk maintain ditunda sampai sistem operasional stabil.
- Policy Supabase sementara membuka CRUD untuk `anon` dan `authenticated`; ini wajib diperketat pada tahap hardening berikutnya.

### Dependency yang belum boleh diasumsikan

- File belum menyediakan alamat lengkap atau latitude/longitude.
- Kabupaten/kota perlu dipetakan ke provinsi; data provinsi eksplisit belum tersedia.
- Arti bisnis kolom `FU-PO` perlu dikonfirmasi sebagai tanggal order terakhir atau tanggal follow-up PO.
- Lead time pengiriman dari Sinar Roda Utama Medan belum tersedia di workbook.
- Nama SKU atau rincian stock per SKU belum terlihat pada sheet ini.
- Nilai tanggal Excel perlu dinormalisasi karena sebagian tanggal terbaca sebagai serial number dan sebagian sebagai teks.

## Tahap 2 - Konfirmasi aturan bisnis dan data lokasi

Checklist:

- [ ] Tetapkan nama dan schema tabel Supabase `customers`.
- [ ] Konfirmasi apakah field referensi `FU-PO` akan disebut `last_order_date`.
- [ ] Konfirmasi lead time Medan ke tiap kabupaten/kota, termasuk satuan hari kerja/kalender.
- [ ] Tentukan safety buffer pengiriman.
- [ ] Sediakan alamat lengkap atau setujui geocoding berbasis nama customer dan kabupaten/kota.
- [ ] Validasi mapping kabupaten/kota ke Sumatera Utara atau Aceh.
- [ ] Tentukan apakah peta menampilkan satu marker per customer atau agregasi per lokasi.
- [ ] Jalankan `supabase/customer-map.sql` di Supabase SQL Editor.
- [x] Buat migration idempotent untuk tabel `customers` lama yang belum memiliki kolom `province`.
- [x] Bersihkan policy admin lama agar policy maintain sementara tidak terkena konflik RLS.
- [x] Tambahkan panduan Google Maps dan validasi rentang koordinat pada form maintain.
- [ ] Kembalikan policy CRUD menjadi admin-only setelah sistem operasional stabil.
- [ ] Hubungkan halaman login ke Supabase Auth untuk tahap hardening akses.

## Tahap 3 - Persiapan data aplikasi

- [x] Buat tipe data customer map.
- [x] Buat pembacaan customer unik dari Supabase tanpa membaca Excel saat runtime.
- [ ] Tambahkan koordinat yang sudah tervalidasi.
- [ ] Tambahkan konfigurasi lead time.
- [ ] Implementasikan perhitungan DOI, tanggal stockout, dan status replenishment.
- [ ] Tambahkan fallback untuk data tidak lengkap.

## Tahap 4 - Implementasi peta MVP

- [ ] Buat komponen client-side Leaflet.
- [ ] Tampilkan batas awal Sumatera Utara dan Aceh.
- [ ] Tampilkan icon rumah sakit sebagai marker.
- [ ] Tampilkan popup/tooltip berisi mesin HD, order terakhir, stock, DOI, dan replenishment.
- [ ] Tambahkan legenda status dan filter provinsi/status.
- [ ] Pastikan tampilan mobile menggunakan click/tap sebagai alternatif hover.

## Tahap 5 - Validasi

- [ ] Bandingkan jumlah marker dengan customer hasil filter Excel.
- [ ] Cocokkan angka stock dan mesin HD pada minimal tiga customer.
- [ ] Uji customer dengan stock negatif atau DOI negatif.
- [ ] Uji koordinat kosong dan lokasi ambigu.
- [ ] Uji keputusan replenishment terhadap lead time aktual.
- [ ] Jalankan build Next.js.
- [x] Validasi build setelah pemisahan akses publik dan admin.

## Catatan perubahan workflow

| Tanggal | Tahap | Hasil | Keputusan/aksi berikutnya |
|---|---|---|---|
| 2026-08-29 | 1 | 26 customer ditemukan; data lokasi belum berupa koordinat | Konfirmasi definisi FU-PO, lead time, dan sumber alamat |
