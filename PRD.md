# Product Requirements Document (PRD)
## SCM Control Tower

**Versi:** 1.3  
**Tanggal:** September 2026  
**Status:** In Development  

---

## 1. Latar Belakang

SCM Control Tower adalah aplikasi web internal untuk memantau dan mengelola rantai pasok (supply chain) — mulai dari penerimaan barang (inbound/receiving), pengeluaran barang (outbound/shipment), hingga pengelolaan master data. Aplikasi ini menggantikan proses manual berbasis spreadsheet yang tidak terintegrasi dan rentan kesalahan.

**Gap sistem saat ini:** ERP yang digunakan adalah **Microsoft Dynamics NAV Vision**, yang hanya mencatat sisi dokumen penjualan/pengiriman (Posted Sales Shipment/PSS beserta Item Ledger Entries) — yaitu *apa* yang dikirim dan ke pelanggan mana. NAV Vision **tidak memiliki modul Transport Management System (TMS)**, sehingga tidak ada pencatatan sistematis untuk *bagaimana* barang tersebut sampai ke pelanggan: tidak ada penugasan kendaraan/driver, tidak ada rute, tidak ada waktu dispatch aktual, dan tidak ada bukti serah terima (POD) yang terstruktur. Data yang tersedia dari NAV pada level header PSS hanya sebatas `Promised Delivery Date` (janji tanggal kirim) dan `Cust. Receipt Date` (tanggal terima yang diinput manual di NAV, sering kali hanya diisi sama dengan document date, bukan waktu aktual di lapangan).

Karena itu, salah satu tujuan utama SCM Control Tower adalah menjadi **TMS pelengkap** di atas data PSS dari NAV — mencatat proses fisik pengiriman (assign kendaraan/driver, dispatch, tracking status, POD, kegagalan kirim) yang selama ini tidak tercatat di sistem manapun, sekaligus menjadi basis data untuk KPI Delivery & Distribution (lihat 4.1.1).

---

## 2. Tujuan Produk

- Memberikan **visibilitas real-time** terhadap pergerakan barang masuk dan keluar
- Mempercepat proses rekonsiliasi antara data NAV (ERP) dengan kondisi aktual di gudang
- Menyediakan **dashboard KPI** untuk monitoring kinerja operasional (lead time, keterlambatan, stok)
- Memudahkan pengelolaan master data pelanggan, SKU, rute, dan armada kendaraan
- Menjadi **TMS (Transport Management System) sederhana** yang melengkapi NAV Vision — mencatat penugasan kendaraan/driver, status dispatch-in transit-delivered, dan bukti serah terima (POD) yang saat ini tidak tercatat di sistem manapun

---

## 3. Pengguna

| Peran | Deskripsi |
|---|---|
| **Admin / SCM Manager** | Akses penuh: upload data, kelola master data, lihat semua laporan |
| **Operator Gudang** | Melihat data receiving dan outbound, verifikasi penerimaan barang |
| **Supervisor Logistik** | Monitor KPI, shipment tracking, issue log |

---

## 4. Modul dan Fitur

### 4.1 Dashboard
- KPI cards: total PSS, total PTR, total shipment aktif
- Ringkasan tren bulanan outbound dan inbound
- Alert keterlambatan delivery

#### 4.1.1 KPI Delivery & Distribution

**Tujuan:** Memberikan visibilitas kinerja pengiriman (delivery) dan distribusi cabang, sebagai bagian dari dashboard KPI utama.

| KPI | Formula | Sumber Data | Target | Frekuensi Review |
|---|---|---|---|---|
| **On-Time Delivery (OTD) Rate** | (Jumlah pengiriman tepat waktu / Total pengiriman) x 100% | Surat jalan/POD (timestamp) vs janji waktu kirim | ≥95% | Harian |
| **On-Time In-Full (OTIF)** | (Jumlah order tepat waktu DAN lengkap / Total order) x 100% | Surat jalan/POD + sistem order (qty/item) | ≥90–95% | Harian |
| **Delivery Lead Time** | Rata-rata (Waktu barang diterima customer − Waktu order dikonfirmasi) | Timestamp sistem (order → dispatch → delivered) | Sesuai SLA cabang | Mingguan |
| **Vehicle/Transporter Utilization Rate** | (Kapasitas/kuota terpakai / Total kapasitas) x 100% — khusus armada Internal (volume/berat/drop point) | Data muatan per trip (`shipment_tracking`, `master_vehicle`) | 75–85% (Internal) | Mingguan |
| **Cost per Delivery** | Total biaya distribusi periode / Total jumlah pengiriman periode — formula berbeda per model transporter (lihat 4.5.4) | Rekap biaya aktual (`shipment_tracking.trip_cost`) vs `master_rate_card` | Sesuai budget cabang, dipantau per model (Internal/Retail/Trucking) | Bulanan |
| **Delivery Issue Rate** *(pengganti Failure Rate)* | (Jumlah shipment dengan catatan kendala / Total pengiriman) x 100% | Issue Log (4.8) — dicatat sebagai catatan operasional, bukan status shipment | Serendah mungkin, breakdown per jenis kendala | Harian |

**Catatan definisi:**
- OTD: perlu didefinisikan ambang "tepat waktu" (window ±jam atau harus persis di hari yang dijanjikan) agar konsisten dengan `delivery_delay_days` dan `is_late` pada `outbound_header`.
- OTIF lebih ketat dari OTD karena menggabungkan dua kondisi sekaligus: ketepatan waktu **dan** kelengkapan qty/item.
- Delivery Lead Time dapat dipecah menjadi sub-metric untuk identifikasi bottleneck:
  - *Order-to-dispatch time*: dari order confirm sampai barang keluar gudang
  - *Dispatch-to-delivery time*: dari keluar gudang sampai sampai ke customer
- Tidak ada proses retur/gagal kirim di alur shipment — kendala operasional (barang rusak, keterlambatan signifikan, dll.) dicatat sebagai entri terpisah di modul **Issues / Issue Log** (4.8), tidak mengubah status shipment yang tetap berakhir di Delivered.
- Cost per Delivery dihitung dengan formula berbeda menurut model transporter: biaya operasional aktual untuk Internal, per-kg-per-tujuan untuk Eksternal-Retail, dan per-trip/FTL untuk Eksternal-Trucking (lihat 4.5.4) — sehingga sebaiknya dilaporkan terpisah per model, bukan digabung rata-rata mentah.

**Komponen biaya Cost per Delivery:**
- BBM/bahan bakar
- Gaji/upah driver & kenek (termasuk lembur)
- Maintenance kendaraan (rutin + insidental)
- Depresiasi kendaraan (jika milik sendiri)
- Toll & parkir
- Biaya pihak ketiga (jika menggunakan jasa ekspedisi/kurir eksternal)

Metrik biaya dapat dipecah lebih detail menjadi:
- Cost per km
- Cost per unit/pallet terkirim
- Cost per drop point (untuk trip multi-drop)

**Implikasi data & modul terkait:**
- `shipment_tracking` perlu menyimpan timestamp aktual (dispatch, delivery, POD) sebagai basis perhitungan OTD, OTIF, dan lead time.
- `master_rate_card` dan input biaya operasional aktual menjadi basis perhitungan Cost per Delivery.
- Dashboard KPI cards (4.1) menampilkan ringkasan OTD/OTIF dan alert keterlambatan; detail breakdown (failure reason, cost trend) ditampilkan di modul **Workflow** (4.6) atau halaman KPI tersendiri.

### 4.2 Receiving / Inbound
**Tujuan:** Mencatat dan memvalidasi penerimaan barang transfer antar gudang (PTR — Purchase Transfer Receipt)

**Fitur:**
- Upload PTR Header dari file Excel NAV (kolom: No., Transfer Order, From, To, Posting Date, dll.)
- Upload PTR Detail (Item Ledger Entries inbound)
- Filter berdasarkan bulan posting
- Tabel ringkas dengan kolom: Posting Date, PTR No, Transfer Order, From→To, Shipping Agent, Ship Date, Lead Time
- Klik PTR No → modal detail: info header + tabel item (item no, deskripsi, qty, lot, expired)
- Tombol Verifikasi Data: cek orphan detail, header tanpa detail
- Hapus data individual

**Aturan bisnis:**
- PTR No unik (unique constraint di DB)
- Lead time dihitung otomatis (ship_to_posting_days)

### 4.3 Outbound
**Tujuan:** Mencatat pengiriman barang ke pelanggan berdasarkan Posted Sales Shipment (PSS) dari NAV

**Fitur:**
- Upload PSS Header dari file Excel NAV (kolom: No., Document Date, Order No., Customer, dll.)
- Upload Outbound Detail (Item Ledger Entries outbound/ILE)
  - Normalisasi otomatis: nomor PAO → PSS terdekat (cari ke atas, lalu ke bawah)
  - Filter baris tanpa `entry_no` (NOT NULL constraint)
  - Kolom `is_sale` adalah generated column — tidak dimasukkan manual
- Filter berdasarkan bulan document date
- Tabel ringkas: Document Date, PSS No, Order No, Customer, Receipt Date, Delay (badge merah/hijau)
- Klik PSS No → modal detail:
  - Header: PSS No, Customer Name, Alamat (dari tabel `customers`), Document Date, Order No, Customer No
  - Tabel item: Item No, Deskripsi (dari `master_sku`), QTY, LOT, Expired Date
  - Filter: sembunyikan item "HD SET" yang tidak punya deskripsi di master_sku
- Hapus data individual

**Aturan bisnis:**
- `shipment_no` unik di `outbound_header`
- `entry_no` unik di `outbound_detail`
- Delay dihitung dari `delivery_delay_days` dan `is_late` (generated column)

### 4.3.1 Crossdocking

**Tujuan:** Mencatat pengiriman crossdocking — barang dari **Kantor Pusat** yang transit/dikirim melalui cabang Medan ke tujuan akhir (pelanggan/cabang lain). Berbeda dari Outbound reguler (4.3), shipment jenis ini **tidak berasal dari PSS NAV** karena dokumen sumbernya diterbitkan oleh Kantor Pusat, bukan cabang — sehingga harus **diinput manual** oleh cabang.

**Fitur:**
- Form input manual header crossdocking: tujuan (customer/alamat), tanggal terima dari Kantor Pusat, tanggal janji kirim ke tujuan akhir, referensi dokumen dari Kantor Pusat (jika ada, sebagai teks bebas — bukan constraint unik seperti PSS No.)
- Form input detail item: pilih dari `master_sku` (atau input manual jika item belum ada di master), qty, lot, expired date
- Daftar crossdocking aktif, dengan status yang sama seperti Outbound (mengalir ke Shipment Tracking & TMS di 4.5)
- Edit/hapus data sebelum shipment di-dispatch

**Aturan bisnis:**
- Karena input manual, validasi lebih longgar dibanding upload PSS (tidak ada `entry_no`/`shipment_no` unik dari NAV) — sistem generate ID internal sendiri (`crossdocking_id`)
- Setelah dibuat, crossdocking shipment mengikuti alur TMS yang sama seperti shipment dari PSS (assign transporter, dispatch, delivery, POD — lihat 4.5)
- `shipment_tracking` membedakan sumber shipment via kolom `source_type` (`PSS` atau `Crossdocking`) agar tetap bisa dilaporkan terpisah maupun digabung di dashboard KPI

### 4.4 Inventory
- Tampilan stok per SKU per lokasi gudang
- Customer Stock Map: visualisasi peta distribusi stok ke pelanggan

### 4.5 Shipment Tracking & TMS (Transport Management System)

**Tujuan:** Mengisi gap yang tidak dicover NAV Vision — mencatat proses fisik pengiriman dari PSS terbit sampai barang diterima pelanggan, karena NAV Vision hanya mencatat dokumen (PSS) tanpa proses transportasinya.

#### 4.5.1 Gap Analysis — Data NAV Vision vs Kebutuhan TMS

| Data | Tersedia di NAV (PSS Header) | Status | Catatan |
|---|---|---|---|
| No. PSS, Order No., Customer | ✅ (`No.`, `Order No.`, `Sell-to Customer No/Name`) | Ada | Sudah tercakup di `outbound_header` |
| Document Date | ✅ (`Document Date`) | Ada | Tanggal dokumen diterbitkan, bukan tanggal kirim aktual |
| Promised Delivery Date | ✅ (`Promised Delivery Date`) | Ada | Janji ke pelanggan — basis perhitungan keterlambatan |
| Cust. Receipt Date | ✅ (`Cust. Receipt Date`) | Ada, tapi tidak reliable | Sering diisi sama dengan document date di NAV, bukan waktu real diterima customer |
| Location Code (gudang asal) | ✅ (`Location Code`) | Ada | Contoh: `MDN-PAR` |
| Package Tracking No. | ✅ (kolom ada, sering kosong) | Parsial | Field disediakan NAV tapi tidak konsisten diisi |
| **Kendaraan/armada yang mengirim** | ❌ | **Gap** | Perlu dicatat manual di app (assign dari `master_vehicle`) |
| **Driver** | ❌ | **Gap** | Belum ada master data driver — perlu ditambahkan |
| **Rute pengiriman** | ❌ | **Gap** | Perlu di-assign dari `master_route`, atau dicatat sebagai multi-drop trip |
| **Waktu dispatch aktual (keluar gudang)** | ❌ | **Gap** | Basis perhitungan *dispatch-to-delivery time* |
| **Waktu delivery aktual (sampai ke pelanggan)** | ❌ | **Gap** | Basis perhitungan OTD/OTIF real, bukan tanggal NAV yang tidak akurat |
| **Bukti serah terima (POD)** | ❌ | **Gap** | Belum ada — bisa berupa foto/tanda tangan digital |
| **Transporter (Internal/Eksternal) & model layanan** | ❌ | **Gap** | Perlu dicatat manual — assign dari `master_transporter` (lihat 4.5.4) |
| **Biaya aktual per trip** | ❌ | **Gap** | Basis perhitungan Cost per Delivery, formula berbeda per model transporter |
| **Data crossdocking dari Kantor Pusat** | ❌ (tidak ada di NAV cabang) | **Gap** | Perlu input manual — lihat modul Crossdocking (4.3.1) |

#### 4.5.2 Alur Status Pengiriman (Delivery Workflow)

```
PSS diupload (dari NAV)
      │
      ▼
[Draft/Pending Dispatch]  — shipment otomatis muncul dari outbound_header yang baru diupload
      │  (assign: kendaraan, driver, rute/trip)
      ▼
[Dispatched]  — input waktu keluar gudang (dispatch_time), odometer/muatan opsional
      │
      ▼
[In Transit]  — opsional: update posisi/checkpoint jika multi-drop
      │
      ▼
[Delivered]  — input waktu sampai (delivery_time) + POD (nama penerima, tanda tangan/foto)
```

**Catatan:** Tidak ada proses retur/gagal kirim dalam alur ini — setiap shipment yang sudah dispatch diasumsikan selesai sampai ke pelanggan (Delivered). Jika terjadi kendala operasional di lapangan (barang rusak, keterlambatan signifikan, dll.), dicatat terpisah sebagai catatan di **Issue Log (4.8)** tanpa mengubah status shipment.

#### 4.5.3 Fitur

- **Daftar shipment aktif** dengan filter status: Draft, Dispatched, In Transit, Delivered
- **Assign trip**: pilih satu atau beberapa shipment (PSS dan/atau Crossdocking — lihat 4.3.1) untuk multi-drop → assign **transporter** (Internal/Eksternal, lihat 4.5.4), kendaraan (jika Internal), driver (jika Internal), rute (`master_route`)
- **Update status** dengan timestamp aktual: `dispatch_time`, `delivery_time`
- **Input POD**: nama penerima, waktu terima, foto bukti (upload), catatan
- **Input biaya trip**: berbeda menurut model transporter — lihat 4.5.4 untuk detail skema biaya per model
- **Kalkulasi otomatis**: `dispatch_to_delivery_hours`, `is_on_time` (vs Promised Delivery Date NAV), status OTIF per shipment
- Data ini menjadi sumber utama untuk KPI Delivery & Distribution (4.1.1): OTD, OTIF, Delivery Lead Time, Vehicle/Transporter Utilization, Cost per Delivery

**Aturan bisnis:**
- Satu shipment (`shipment_tracking`) terhubung ke satu sumber (`outbound_header`/PSS atau `crossdocking_header`), tapi satu trip bisa membawahi banyak shipment (multi-drop)
- Status hanya bisa maju (Draft → Dispatched → In Transit → Delivered), tidak mundur, kecuali koreksi oleh Admin
- Tidak ada status retur/gagal — proses ini tidak berlaku di operasional cabang
- `is_on_time` dihitung dari `delivery_time` aktual vs `Promised Delivery Date` dari NAV (untuk shipment sumber PSS) atau tanggal janji kirim manual (untuk shipment sumber Crossdocking)

#### 4.5.4 Model Transporter & Skema Biaya

Cabang menggunakan kombinasi armada internal dan transporter eksternal, masing-masing dengan skema biaya berbeda:

| Model | Jumlah | Deskripsi | Skema Biaya | Multi-drop |
|---|---|---|---|---|
| **Internal** | 2 unit truck (milik SRU) | Kendaraan operasional milik cabang sendiri, dengan driver internal | Biaya operasional aktual: BBM, gaji/lembur driver, maintenance, depresiasi (lihat komponen di 4.1.1) | Bisa |
| **Eksternal — Retail** | 3 transporter eksternal (jasa retail) | Pengiriman partai kecil, cocok untuk pengiriman ke banyak tujuan dengan volume kecil per tujuan | **Per kg per tujuan** — dihitung dari berat kiriman x rate per kg sesuai tujuan (`master_rate_card`) | Tidak (satu tujuan per pengiriman) |
| **Eksternal — Trucking** | 3 transporter eksternal (jasa trucking) | Pengiriman partai besar / Full Truck Load (FTL) | **Per trip/FTL** — tarif tetap per trip sesuai rute (`master_rate_card`), terlepas dari jumlah drop | Bisa (multi-drop dalam satu trip) |

**Catatan:**
- 3 transporter eksternal yang sama bisa melayani baik model Retail maupun Trucking tergantung kebutuhan pengiriman — model (Retail/Trucking) ditentukan per shipment/trip, bukan melekat permanen ke transporter.
- Untuk model Retail, `trip_cost` dihitung dari total berat (kg) seluruh item pada shipment dikalikan rate per kg sesuai kota/kode tujuan.
- Untuk model Trucking, `trip_cost` mengacu ke tarif FTL per rute pada `master_rate_card`, dibagi rata atau dialokasikan per shipment jika multi-drop (untuk kebutuhan Cost per Delivery per shipment).
- Untuk model Internal, tidak ada "rate card" per pengiriman — biaya dihitung dari akumulasi biaya operasional aktual (lihat 4.1.1) dan bisa dialokasikan per trip.

### 4.6 Workflow
- Analitik receiving: lead time trend, keterlambatan per shipping agent
- Visualisasi alur proses SCM

### 4.7 Master Data

| Sub-modul | Deskripsi |
|---|---|
| **Customers** | Data pelanggan: kode, nama, alamat, kota, koordinat, lead time |
| **SKU** | Kode produk, nama, kategori, UOM, safety stock, grup |
| **Vehicles** | Data armada kendaraan internal (2 unit): nopol, tipe, kapasitas (volume/berat), status |
| **Drivers** *(baru)* | Data driver/pengemudi internal: nama, no. SIM, no. HP, status aktif |
| **Transporters** *(baru)* | Data transporter: Internal (SRU) atau Eksternal (3 perusahaan) — nama, jenis layanan (Retail/Trucking), kontak PIC |
| **Routes** | Rute pengiriman: origin, destination, estimasi waktu |
| **Rate Card** | Tarif pengiriman: per kg per tujuan (Eksternal-Retail), per trip/FTL per rute (Eksternal-Trucking) |
| **Warehouses** | Data gudang: kode lokasi, alamat |

### 4.8 Issues / Issue Log
- Pencatatan masalah operasional (damaged goods, keterlambatan, dll.)
- Status issue: open, in progress, resolved

### 4.9 Warehouse Checklist
- Checklist operasional harian gudang
- Tanda tangan / konfirmasi digital

### 4.10 Settings
- Konfigurasi sistem
- Manajemen user dan akses (planned)

---

## 5. Arsitektur Teknis

| Layer | Teknologi |
|---|---|
| Frontend | Next.js 16 (App Router), React, TypeScript |
| Styling | Tailwind CSS |
| Backend | Next.js Server Actions (no separate API) |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| File Processing | XLSX (browser-side parsing) |
| Deployment | (TBD) |

**Pola upload data:**
1. User pilih file Excel/CSV di browser
2. File di-parse client-side dengan `xlsx` library
3. Data di-normalize dan divalidasi di browser
4. Data dikirim ke Server Action → insert ke Supabase via `supabaseAdmin`

---

## 6. Integrasi Data

Sumber data utama: **Microsoft Dynamics NAV (ERP)**

| Data | Tabel NAV | Tabel App |
|---|---|---|
| PSS Header | Posted Sales Shipments | `outbound_header` |
| ILE Outbound | Item Ledger Entries (sale=true) | `outbound_detail` |
| PTR Header | Posted Transfer Receipts | `receiving_header` |
| ILE Inbound | Item Ledger Entries (transfer) | `receiving_detail` |

Data diexport manual dari NAV → upload via UI.

**Data non-NAV (manual):**
- **Crossdocking** — shipment dari Kantor Pusat via cabang Medan tidak memiliki dokumen PSS di NAV cabang, sehingga diinput manual melalui form (lihat 4.3.1), bukan melalui upload Excel.

**Normalisasi PAO → PSS:**
Dalam ILE, baris dengan `Document No.` prefix `PAO` (Purchase Adjustment Order) di-remap ke nomor PSS terdekat (nearest above, then below) sebelum disimpan ke DB.

---

## 7. Struktur Database (Tabel Utama)

```
outbound_header     — PSS header (shipment_no UNIQUE)
outbound_detail     — ILE outbound (entry_no NOT NULL, is_sale GENERATED)
receiving_header    — PTR header (ptr_no UNIQUE)
receiving_detail    — ILE inbound
crossdocking_header — Header crossdocking dari Kantor Pusat, input manual (BARU)
crossdocking_detail — Detail item crossdocking (BARU)
customers           — Master pelanggan (customer_code)
master_sku          — Master produk (sku_code)
master_vehicle      — Master kendaraan internal (2 unit)
master_driver       — Master driver internal (BARU — untuk TMS)
master_transporter  — Master transporter Internal/Eksternal (BARU — untuk TMS)
master_route        — Master rute
master_rate_card    — Tarif pengiriman (per kg / per trip, tergantung transporter)
shipment_tracking   — Tracking & TMS pengiriman aktif (DIPERLUAS — lihat detail di bawah)
delivery_pod        — Bukti serah terima / Proof of Delivery (BARU)
```

**Tabel baru `crossdocking_header` & `crossdocking_detail`:**
```
crossdocking_header:
  crossdocking_id     — PK, auto-generate (bukan dari NAV)
  destination_customer — FK ke customers (atau teks bebas jika belum ada di master)
  received_from_hq_date — tanggal barang diterima dari Kantor Pusat
  promised_delivery_date — janji kirim ke tujuan akhir (input manual)
  hq_reference_no      — referensi dokumen dari Kantor Pusat (teks bebas, opsional)
  notes                 — catatan
  created_by, created_at

crossdocking_detail:
  detail_id        — PK
  crossdocking_id    — FK ke crossdocking_header
  item_no             — FK ke master_sku (atau teks manual)
  description           — deskripsi item
  qty, lot, expired_date
```

**Tabel baru `master_transporter`:**
```
transporter_id     — PK
name                 — nama transporter (mis. nama 3 perusahaan eksternal, atau "Internal - SRU")
type                  — Internal | Eksternal
service_model          — Retail | Trucking | NULL (untuk Internal)
pic_name, pic_contact
is_active
```

**Field pada `shipment_tracking` (untuk mendukung TMS):**
```
shipment_id          — ID internal shipment
source_type           — PSS | Crossdocking
source_id               — FK ke outbound_header ATAU crossdocking_header (tergantung source_type)
trip_id                   — grouping untuk multi-drop trip
transporter_id             — FK ke master_transporter
vehicle_id                  — FK ke master_vehicle (diisi jika transporter_id = Internal)
driver_id                     — FK ke master_driver (diisi jika transporter_id = Internal)
route_id                       — FK ke master_route (nullable)
status                          — Draft | Dispatched | In Transit | Delivered
dispatch_time                    — timestamp aktual keluar gudang
delivery_time                      — timestamp aktual sampai ke pelanggan
is_on_time                          — GENERATED: delivery_time <= promised_delivery_date
weight_kg                             — berat kiriman (basis biaya untuk model Eksternal-Retail)
trip_cost                              — biaya aktual (formula tergantung service_model — lihat 4.5.4)
```

**Tabel baru `delivery_pod`:**
```
pod_id           — PK
shipment_id       — FK ke shipment_tracking
receiver_name      — nama penerima
received_at         — timestamp penerimaan
photo_url             — bukti foto (upload ke Supabase Storage)
notes                  — catatan tambahan
```

---

## 8. Non-Functional Requirements

- **Performa:** Halaman utama load < 3 detik untuk data 1000 baris
- **Upload:** Support file hingga 10MB (dikonfigurasi via `next.config.ts` `bodySizeLimit`)
- **Keamanan:** Semua operasi tulis menggunakan `supabaseAdmin` (service role, bypass RLS) dari Server Action — tidak expose ke client
- **Responsif:** Tampilan optimal di desktop (minimum 1280px lebar)

---

## 9. Backlog / Planned Features

- [ ] Autentikasi dan role-based access control (admin, operator, viewer)
- [ ] Export data ke Excel dari setiap halaman
- [ ] Dashboard KPI real-time dengan refresh otomatis
- [ ] Notifikasi email/WhatsApp untuk keterlambatan delivery
- [ ] Integrasi langsung dengan NAV API (menggantikan upload manual)
- [ ] Mobile view untuk operator gudang
- [ ] Update LOT dan Expiry Date via upload ulang (script `update_lot_expiry.py` tersedia)
- [ ] Paginasi pada tabel outbound dan receiving untuk dataset besar

**TMS (Transport Management System):**
- [ ] Master data Driver (`master_driver`) — CRUD dasar, untuk 2 driver internal
- [ ] Master data Transporter (`master_transporter`) — setup Internal (SRU) + 3 transporter eksternal, dengan `service_model` (Retail/Trucking)
- [ ] Tabel `delivery_pod` + upload foto POD ke Supabase Storage
- [ ] Form input manual Crossdocking (`crossdocking_header`/`crossdocking_detail`) — lihat 4.3.1
- [ ] Halaman assign trip: pilih multi-shipment (PSS dan/atau Crossdocking) → assign transporter, kendaraan/driver (jika Internal), rute
- [ ] Update status shipment via mobile-friendly form (untuk diisi driver/checker di lapangan, bukan hanya admin di kantor)
- [ ] Perhitungan otomatis `is_on_time` berbasis `Promised Delivery Date` (bukan `Cust. Receipt Date` NAV yang tidak reliable)
- [ ] Modul input biaya trip dengan 3 formula berbeda: operasional aktual (Internal), per-kg-per-tujuan (Eksternal-Retail), per-trip/FTL (Eksternal-Trucking)
- [ ] Setup `master_rate_card` dengan struktur per kg per tujuan (Retail) dan per rute (Trucking)
- [ ] Notifikasi/alert saat shipment melewati Promised Delivery Date tapi status masih Draft/Dispatched
- [ ] (Jangka panjang) Integrasi GPS tracking kendaraan real-time, jika budget/hardware tersedia

---

## 10. Catatan Implementasi

- Semua perubahan file harus di-deploy di path `d:\SCM APP\scm-tower\scm-tower\` (bukan subfolder `scm-tower` di dalamnya)
- Dev server berjalan dengan `npm run dev` dari direktori tersebut
- Cache Next.js (`.next`) perlu dihapus dan server di-restart setelah perubahan `next.config.ts`
- Kolom `is_sale` dan `delivery_delay_days` adalah generated columns di Supabase — tidak boleh di-insert manual