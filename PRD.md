# Product Requirements Document (PRD)
## SCM Control Tower

**Versi:** 1.0  
**Tanggal:** September 2026  
**Status:** In Development  

---

## 1. Latar Belakang

SCM Control Tower adalah aplikasi web internal untuk memantau dan mengelola rantai pasok (supply chain) — mulai dari penerimaan barang (inbound/receiving), pengeluaran barang (outbound/shipment), hingga pengelolaan master data. Aplikasi ini menggantikan proses manual berbasis spreadsheet yang tidak terintegrasi dan rentan kesalahan.

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
| **Operator Gudang** | Melihat data receiving dan outbound, verifikasi penerimaan barang |
| **Supervisor Logistik** | Monitor KPI, shipment tracking, issue log |

---

## 4. Modul dan Fitur

### 4.1 Dashboard
- KPI cards: total PSS, total PTR, total shipment aktif
- Ringkasan tren bulanan outbound dan inbound
- Alert keterlambatan delivery

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

### 4.4 Inventory
- Tampilan stok per SKU per lokasi gudang
- Customer Stock Map: visualisasi peta distribusi stok ke pelanggan

### 4.5 Shipment Tracking
- Daftar shipment aktif
- Status pengiriman (dispatch, delivery, POD)
- Input data aktual: tanggal dispatch, delivery, POD

### 4.6 Workflow
- Analitik receiving: lead time trend, keterlambatan per shipping agent
- Visualisasi alur proses SCM

### 4.7 Master Data

| Sub-modul | Deskripsi |
|---|---|
| **Customers** | Data pelanggan: kode, nama, alamat, kota, koordinat, lead time |
| **SKU** | Kode produk, nama, kategori, UOM, safety stock, grup |
| **Vehicles** | Data armada kendaraan: nopol, tipe, status |
| **Routes** | Rute pengiriman: origin, destination, estimasi waktu |
| **Rate Card** | Tarif pengiriman per rute/kendaraan |
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

**Normalisasi PAO → PSS:**
Dalam ILE, baris dengan `Document No.` prefix `PAO` (Purchase Adjustment Order) di-remap ke nomor PSS terdekat (nearest above, then below) sebelum disimpan ke DB.

---

## 7. Struktur Database (Tabel Utama)

```
outbound_header     — PSS header (shipment_no UNIQUE)
outbound_detail     — ILE outbound (entry_no NOT NULL, is_sale GENERATED)
receiving_header    — PTR header (ptr_no UNIQUE)
receiving_detail    — ILE inbound
customers           — Master pelanggan (customer_code)
master_sku          — Master produk (sku_code)
master_vehicle      — Master kendaraan
master_route        — Master rute
master_rate_card    — Tarif pengiriman
shipment_tracking   — Tracking pengiriman aktif
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

---

## 10. Catatan Implementasi

- Semua perubahan file harus di-deploy di path `d:\SCM APP\scm-tower\scm-tower\` (bukan subfolder `scm-tower` di dalamnya)
- Dev server berjalan dengan `npm run dev` dari direktori tersebut
- Cache Next.js (`.next`) perlu dihapus dan server di-restart setelah perubahan `next.config.ts`
- Kolom `is_sale` dan `delivery_delay_days` adalah generated columns di Supabase — tidak boleh di-insert manual
