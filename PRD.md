# Product Requirements Document (PRD)
## SCM Control Tower

**Versi:** 1.2  
**Tanggal:** September 2026  
**Status:** In Development  

---

## 1. Latar Belakang

SCM Control Tower adalah aplikasi web internal untuk memantau dan mengelola rantai pasok (supply chain) — mulai dari penerimaan barang (inbound/receiving), pengeluaran barang (outbound), shipment tracking, hingga pengelolaan master data. Aplikasi ini menggantikan proses manual berbasis spreadsheet yang tidak terintegrasi dan rentan kesalahan.

Sumber data utama adalah **Microsoft Dynamics NAV (ERP)** yang diexport secara manual lalu diupload via UI.

---

## 2. Tujuan Produk

- Memberikan **visibilitas real-time** terhadap pergerakan barang masuk dan keluar
- Mempercepat proses rekonsiliasi antara data NAV (ERP) dengan kondisi aktual di gudang
- Menyediakan **dashboard KPI** untuk monitoring kinerja operasional (lead time, keterlambatan, stok)
- Memudahkan pengelolaan master data pelanggan, SKU, rute, dan armada kendaraan

---

## 3. Pengguna

| Peran | Deskripsi |
|---|---|
| **Admin / SCM Manager** | Akses penuh: upload data, kelola master data, lihat semua laporan |
| **Operator Gudang** | Upload data receiving dan outbound, verifikasi penerimaan barang |
| **Supervisor Logistik** | Monitor KPI, shipment tracking, issue log |

---

## 4. Navigasi Aplikasi

Sidebar memiliki 11 menu utama:

| # | Menu | Route | Status |
|---|---|---|---|
| 1 | Dashboard | `/dashboard` | ✅ Implemented |
| 2 | Workflow | `/workflow` | ✅ Partial |
| 3 | Shipment | `/shipment` | ✅ Implemented |
| 4 | Vendor | `/vendor` | ✅ Implemented |
| 5 | Receiving | `/receiving` | ✅ Implemented |
| 6 | Outbound | `/outbound` | ✅ Implemented |
| 7 | Inventory | `/inventory` | ✅ Partial (read-only) |
| 8 | Checklist | `/warehouse-checklist` | ✅ Partial (read-only) |
| 9 | Issue Log | `/issues` | ✅ Partial (read-only) |
| 10 | Master | `/master-data` | ✅ Implemented |
| 11 | Settings | `/settings` | ✅ Implemented |

---

## 5. Modul dan Fitur

### 5.1 Dashboard

**Status: ✅ Implemented**

KPI strip (4 cards yang bisa diklik):
- **Vendors** → jumlah total vendor aktif (`vendors` table)
- **Shipments** → jumlah total shipment (`shipments` table)
- **Receiving** → jumlah total PTR (`receiving_header` table)
- **Issues** → jumlah open + in_progress issue (`issue_log` table)

Komponen tambahan:
- **Customer Map** — peta interaktif Leaflet dengan realtime Supabase subscription. Marker warna-warni berdasarkan coverage stok vs lead time. Data dari tabel `customers` (latitude, longitude, machine_count, stock_quantity, daily_usage, lead_time_days, safety_buffer_days). Mode "Maintain Data" (Ctrl+Shift+M) untuk edit koordinat langsung di peta.
- **Shipments In Progress** — 5 shipment terbaru dengan status planned/picking/loaded/in_transit
- **Open Issues** — 5 issue terbuka terdekat deadline-nya
- **Quick links** — Workflow, Master Data, Warehouse Checklist, Settings

#### 5.1.1 KPI Delivery & Distribution

Direncanakan sebagai bagian dari Dashboard KPI. Saat ini `delivery_delay_days` dan `is_late` sudah tersedia sebagai **generated column** di tabel `outbound_header` (dihitung dari `promised_delivery_date` vs `cust_receipt_date`).

| KPI | Formula | Sumber Data Tersedia | Status |
|---|---|---|---|
| **On-Time Delivery (OTD) Rate** | (Pengiriman tepat waktu / Total) × 100% | `outbound_header.is_late`, `delivery_delay_days` | 🔲 Belum di-dashboard |
| **On-Time In-Full (OTIF)** | (Tepat waktu DAN lengkap / Total) × 100% | Perlu data qty aktual delivered | 🔲 Belum ada data |
| **Delivery Lead Time** | Rata-rata `cust_receipt_date` − `document_date` | `outbound_header` | 🔲 Belum di-dashboard |
| **Vehicle Utilization Rate** | Kapasitas terpakai / Total kapasitas | `transport_fleet`, `shipment_tracking` | 🔲 Belum ada data |
| **Delivery Failure Rate** | Pengiriman gagal / Total | `issue_log` (belum terstruktur) | 🔲 Belum ada data |
| **Cost per Delivery** | Total biaya / Total pengiriman | `transport_rate_card` (tarif) + biaya aktual | 🔲 Belum ada data |

**Catatan:**
- OTD saat ini sudah bisa dihitung dari `outbound_header` karena field `is_late` sudah ada
- `delivery_delay_days` = `cust_receipt_date` − `promised_delivery_date` (bukan dari POD aktual)
- Untuk OTIF dan failure rate, perlu field tambahan di `shipments` atau `outbound_header`

---

### 5.2 Receiving / Inbound

**Status: ✅ Fully Implemented**

**Tujuan:** Mencatat penerimaan barang transfer antar gudang (PTR — Purchase Transfer Receipt) dari NAV.

**Fitur yang berjalan:**
- Upload PTR Header dari Excel NAV — field: No., Transfer Order, From, To, Posting Date, Shipment Date, Receipt Date, Shipping Agent, lead time days
- Upload PTR Detail (Item Ledger Entries inbound) — field: Document No., Item No., Lot No., Expiration Date, Quantity, Entry No., dll.
- Filter berdasarkan bulan (multi-select, URL-based)
- Tabel: Posting Date, PTR No (clickable), Transfer Order, From→To, Shipping Agent, Ship Date, Lead Time (badge warna)
- Klik PTR No → modal detail: info header + tabel item (Item No, Nama dari `master_sku`, Qty, Lot, Expired)
- Verifikasi Data: deteksi orphan detail dan header tanpa detail
- Edit tanggal shipment inline
- Hapus PTR (cascade ke detail)

**Database:**
- `receiving_header` — ptr_no UNIQUE
- `receiving_detail` — dedup by (document_no, item_no, variant_code, lot_no, serial_no)

**Aturan bisnis:**
- PTR No unik
- Lead time badge: hijau ≤11 hari, kuning <11, merah >18 hari

---

### 5.3 Outbound

**Status: ✅ Fully Implemented**

**Tujuan:** Mencatat pengiriman barang ke pelanggan berdasarkan Posted Sales Shipment (PSS) dari NAV.

**Fitur yang berjalan:**
- Upload PSS Header dari Excel NAV — field: No., Document Date, Order No., Customer No., Customer Name, Promised Delivery Date, Cust. Receipt Date, Location, Project, dll.
- Upload Outbound Detail / ILE (Item Ledger Entries) — field: Document No., Item No., Lot No., Expiration Date, Quantity, Entry No., dll.
  - **Normalisasi otomatis PAO → PSS:** nomor `PAO-XXXX` di-remap ke PSS terdekat (cari ke atas dulu, lalu ke bawah) sebelum disimpan ke DB
  - Filter baris tanpa `entry_no` (NOT NULL constraint di DB)
  - Kolom `is_sale` adalah **generated column** di DB — tidak dimasukkan manual
- Filter berdasarkan bulan document date (multi-select, URL-based)
- Tabel: Document Date, PSS No (clickable), Order No, Customer, Receipt Date, Delay (badge merah/hijau)
- Klik PSS No → **modal detail:**
  - Header: PSS No, Customer Name (dari `customers`), Alamat lengkap, Document Date, Order No, Customer No
  - Tabel item: Item No, Deskripsi (dari `master_sku`), QTY, LOT, Expired Date
  - Filter: item "HD SET" tanpa deskripsi di master_sku disembunyikan
- Hapus PSS Header (cascade ke outbound_detail)

**Database:**
- `outbound_header` — shipment_no UNIQUE, delivery_delay_days & is_late GENERATED
- `outbound_detail` — entry_no NOT NULL UNIQUE, is_sale GENERATED

**Aturan bisnis:**
- `delivery_delay_days` = `cust_receipt_date` − `promised_delivery_date`
- `is_late` = TRUE jika `delivery_delay_days` > 0
- Insert dalam batch 500, 3 concurrent untuk performa upload

---

### 5.4 Shipment Tracking

**Status: ✅ Implemented**

**Fitur yang berjalan:**
- Tabel daftar shipment (shipment_no, document_no, tanggal, origin, destination, vendor, vehicle, driver, status badge, SLA, POD)
- Tambah shipment baru via panel edit
- Edit shipment: semua field termasuk status, SLA, POD, delay reason, notes
- Delete shipment
- Status change otomatis menulis log ke `shipment_status_logs`
- History log status per shipment ditampilkan di panel edit

**Database:**
- `shipments` — status: Draft, Dispatched, In Transit, Arrived, Completed, Delayed, Cancelled
- `shipment_status_logs` — log perubahan status (status_from, status_to, timestamp)
- Vendor dropdown dari `vendors` (vendor_name, vendor_code)

---

### 5.5 Vendor Management

**Status: ✅ Implemented**

Full CRUD: tambah, edit, hapus vendor transport.

**Field:** vendor_code, vendor_name, vendor_type (TRUCKING/COURIER/INTERNAL/RETAIL), pic_name, phone, email, coverage_area, default_sla, is_active.

---

### 5.6 Inventory

**Status: ✅ Partial (Read-only)**

Menampilkan data dari view `vw_inventory_alert` (sku_code, item_name, warehouse_code, available_qty, safety_stock, alert_status). Tidak ada form input — data dikelola via DB view. Limit 50 baris.

---

### 5.7 Warehouse Checklist

**Status: ✅ Partial (Read-only)**

Menampilkan riwayat checklist dari `warehouse_checklist` (checklist_date, warehouse_code, shift, completion_rate, issue_notes). Limit 30 baris. Belum ada form untuk membuat checklist baru via UI.

---

### 5.8 Issue Log

**Status: ✅ Partial (Read-only)**

Menampilkan daftar issue dari `issue_log` (issue_no, category, title, impact, status, due_date). Limit 50 baris. Belum ada CRUD untuk buat issue baru, update status, atau assign owner.

---

### 5.9 Workflow

**Status: ✅ Partial (Analytics + Documentation)**

- Analitik receiving: statistik lead time, keterlambatan per shipping agent (dari `receiving_header` 6 bulan terakhir)
- Diagram 5-langkah proses bisnis receiving
- Panduan format data NAV untuk upload
- Status checklist gudang hari ini (dari `warehouse_checklist`)

---

### 5.10 Master Data

**Status: ✅ Fully Implemented**

Index page dengan count dari 6 tabel, navigasi ke sub-modul:

| Sub-modul | Tabel DB | CRUD |
|---|---|---|
| **Customers** | `customers` | ✅ Full |
| **SKU** | `master_sku` | ✅ Full |
| **Vehicles** | `transport_fleet` | ✅ Full |
| **Routes** | `routes` | ✅ Full |
| **Rate Card** | `transport_rate_card` | ✅ Full |
| **Warehouses** | `warehouses` | ✅ Full |
| **Vendors** | `vendors` | ✅ Full (via /vendor) |

---

### 5.11 Settings

**Status: ✅ Implemented**

- Status koneksi Supabase
- Row count tabel utama (vendors, shipments, receiving_header, outbound_detail)
- Dokumentasi tabel dan env vars yang dibutuhkan

---

## 6. Arsitektur Teknis

| Layer | Teknologi |
|---|---|
| Frontend | Next.js 16.3 (App Router, Turbopack), React, TypeScript |
| Styling | Tailwind CSS v4 |
| Backend | Next.js Server Actions (tidak ada API terpisah) |
| Database | Supabase (PostgreSQL) dengan Row Level Security |
| Auth | Supabase Auth (email/password) |
| Peta | React-Leaflet dengan realtime Supabase subscription |
| File Processing | `xlsx` library (browser-side parsing, tidak ada server upload) |
| Deployment | TBD |

**Dua Supabase client:**
- `lib/supabaseAdmin.ts` — Service role key, bypass RLS. Digunakan **hanya** di Server Actions dan Server Components
- `lib/supabase.ts` — Publishable key. Digunakan di Client Components (edit panel, delete button, dll.)

**Pola upload data dari NAV:**
1. User export Excel dari NAV
2. Pilih file di browser → di-parse client-side dengan `xlsx`
3. Data di-normalize (alias kolom, konversi tanggal Excel serial/string, normalisasi PAO→PSS untuk outbound)
4. Deduplikasi client-side → Server Action → insert ke Supabase via `supabaseAdmin`
5. bodySizeLimit: 10MB (dikonfigurasi di `next.config.ts`)

---

## 7. Database — Tabel Utama

```
── Receiving ──────────────────────────────────────────
receiving_header      ptr_no UNIQUE
receiving_detail      dedup: (document_no, item_no, variant_code, lot_no, serial_no)

── Outbound ───────────────────────────────────────────
outbound_header       shipment_no UNIQUE
                      delivery_delay_days GENERATED (cust_receipt_date - promised_delivery_date)
                      is_late GENERATED (delivery_delay_days > 0)
outbound_detail       entry_no NOT NULL
                      is_sale GENERATED

── Shipment ───────────────────────────────────────────
shipments             status: Draft→Dispatched→In Transit→Arrived→Completed/Delayed/Cancelled
shipment_status_logs  audit trail perubahan status

── Master ─────────────────────────────────────────────
customers             customer_code, address, coordinates, machine_count
master_sku            sku_code, item_name, category, group, uom, safety_stock
vendors               vendor_code, vendor_type, coverage_area, default_sla
transport_fleet       vehicle_no, vehicle_type, capacity_kg, driver
routes                route_code, origin, destination, lead_time_hours, risk_level
warehouses            warehouse_code, city, address
transport_rate_card   rate_code, tariff_model (per_trip/per_kg/per_cbm/per_unit), price

── Operasional ────────────────────────────────────────
issue_log             issue_no, category, title, status, due_date
warehouse_checklist   8 area boolean checklist, completion_rate

── Views ──────────────────────────────────────────────
vw_inventory_alert    alert status stok per SKU per warehouse
```

---

## 8. Integrasi Data NAV

| Data | Report NAV | Tabel App |
|---|---|---|
| PSS Header | Posted Sales Shipments | `outbound_header` |
| ILE Outbound | Item Ledger Entries (is_sale=true) | `outbound_detail` |
| PTR Header | Posted Transfer Receipts | `receiving_header` |
| ILE Inbound | Item Ledger Entries (transfer) | `receiving_detail` |

**Normalisasi PAO → PSS (Outbound ILE):**
Baris dengan `Document No.` prefix `PAO` (Purchase Adjustment Order) secara otomatis di-remap ke nomor PSS terdekat dalam file — cari ke atas dulu, kalau tidak ada cari ke bawah — sebelum disimpan ke DB. Pada upload terakhir: 3.404 dari 7.036 baris berhasil diremap.

---

## 9. Non-Functional Requirements

- **Performa upload:** 7.000+ baris ILE selesai dalam < 30 detik (batch 500, 3 concurrent)
- **Body size limit:** 10MB per Server Action request
- **Keamanan:** Semua operasi tulis dari upload menggunakan `supabaseAdmin` (service role) dari Server Action — tidak expose ke browser
- **Catatan:** Auth guard (middleware) belum diimplementasi — semua route `(app)` bisa diakses langsung tanpa login jika RLS Supabase tidak dikonfigurasi ketat
- **Responsif:** Optimal di desktop (minimum 1280px)

---

## 10. Backlog & Prioritas

### P0 — Sebelum Production
- [ ] **Auth middleware** — proteksi semua route `(app)` agar redirect ke `/login` jika belum autentikasi
- [ ] **Role-based access** — admin vs operator vs viewer

### P1 — High Impact
- [ ] **Dashboard KPI OTD** — hitung dan tampilkan On-Time Delivery Rate dari `outbound_header.is_late`
- [ ] **Issue Log CRUD** — form buat issue baru, update status, assign owner
- [ ] **Warehouse Checklist form** — form input checklist harian

### P2 — Nice to Have
- [ ] Export data ke Excel dari setiap halaman
- [ ] Notifikasi (email/WhatsApp) untuk keterlambatan delivery
- [ ] Integrasi langsung NAV API (gantikan upload manual)
- [ ] Mobile view untuk operator gudang
- [ ] Paginasi pada tabel outbound dan receiving untuk dataset > 500 baris

---

## 11. Catatan Implementasi

- **Working directory yang benar:** `d:\SCM APP\scm-tower\scm-tower\` (bukan subfolder `scm-tower\scm-tower\scm-tower\`)
- Dev server: `npm run dev` dari direktori tersebut
- Cache `.next` perlu dihapus dan server di-restart setelah perubahan `next.config.ts`
- Kolom `is_sale`, `delivery_delay_days`, `is_late` adalah **generated columns** di Supabase — tidak boleh di-insert manual
- `lot_no` dan `expiration_date` di `outbound_detail` kosong jika data diupload sebelum mapping ditambahkan — gunakan `scripts/update_lot_expiry.py` atau upload ulang untuk memperbaiki
- Semua CRUD master data (vendor, customer, shipment, dll.) menggunakan `supabase` client publik langsung dari komponen — **bukan** via Server Action
