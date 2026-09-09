# Product Requirements Document (PRD)
## SCM Control Tower

**Versi:** 1.7
**Tanggal:** 09 September 2026
**Status:** In Development  

**Catatan perubahan v1.7:** Shipment menjadi pusat perencanaan dan monitoring pengiriman. Menu Trip Control tidak lagi ditampilkan pada sidebar karena penetapan transporter, kendaraan, driver, helper, rute, dan Trip ID dilakukan langsung saat membuat atau mengedit Shipment. Pencatatan biaya dilakukan terpisah melalui menu Shipment Cost.

---

## 1. Latar Belakang

SCM Control Tower adalah aplikasi web internal untuk memantau dan mengelola rantai pasok (supply chain) — mulai dari penerimaan barang (inbound/receiving), pengeluaran barang (outbound/shipment), hingga pengelolaan master data. Aplikasi ini menggantikan proses pencatatan manual dan berbasis spreadsheet yang tidak terintegrasi dan rentan kesalahan.

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

Saat ini aplikasi digunakan oleh **1 user tunggal** (Kepala Gudang cabang), yang memegang akses penuh atas seluruh modul — upload data, kelola master data, monitoring KPI, shipment tracking/TMS, hingga issue log. Tidak ada pemisahan role pada tahap ini.

| Peran | Deskripsi |
|---|---|
| **Admin (Kepala Gudang)** | Akses penuh: upload data, kelola master data, kelola TMS (assign trip, update status, POD), monitor KPI, issue log, seluruh laporan |

**Catatan:** Pemisahan role (Admin / Operator Gudang / Supervisor Logistik) sebelumnya direncanakan untuk skenario multi-user di masa depan — lihat backlog "Autentikasi dan role-based access control" (9). Jika tim bertambah, role ini bisa diaktifkan kembali sesuai kebutuhan pembagian akses.

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
| **Cost per Delivery** | Total biaya distribusi periode / Total jumlah pengiriman periode — dipantau terpisah per model (Internal/Eksternal) dan per DK/LK | Rekap biaya aktual per shipment (`shipment_tracking.total_biaya`) | Sesuai budget cabang | Bulanan |
| **Cost Ratio** *(baru)* | `total_biaya / invoice_value` x 100% untuk shipment eksternal | `shipment_tracking` (total_biaya vs invoice_value dari PSS/PSI) | Dipantau tren-nya, terutama untuk shipment LK bernilai kecil; Internal tidak memakai invoice | Bulanan |
| **Delivery Issue Rate** *(pengganti Failure Rate)* | (Jumlah shipment dengan catatan kendala / Total pengiriman) x 100% | Issue Log (4.8) — dicatat sebagai catatan operasional, bukan status shipment | Serendah mungkin, breakdown per jenis kendala | Harian |

**Catatan definisi:**
- **OTD resmi** hanya dihitung dari shipment yang berstatus `Delivered`, memiliki POD, dan memiliki `delivery_time` aktual. Pembilang adalah shipment dengan `delivery_time` dalam SLA terhadap `promised_delivery_date`; penyebut adalah seluruh shipment Delivered ber-POD pada periode yang sama. `Cust. Receipt Date`, `is_late`, dan `delivery_delay_days` dari NAV tidak boleh dipakai untuk KPI OTD karena bukan bukti waktu lapangan.
- Shipment yang sudah melewati `promised_delivery_date` tetapi belum Delivered dilaporkan sebagai **Overdue/Open Shipment**, terpisah dari OTD agar tidak mencampurkan kinerja final dengan pekerjaan yang belum selesai.
- SLA OTD harus dikonfigurasi per customer/rute: default adalah selesai pada tanggal janji kirim pukul 23:59 waktu lokal; jika customer memakai window waktu, gunakan batas waktu tersebut.
- OTIF hanya dihitung setelah tersedia data `qty_planned` dan `qty_delivered` per item pada stop pengiriman. Sebelum itu, dashboard wajib menampilkan OTIF sebagai `Belum tersedia`, bukan estimasi.
- Delivery Lead Time dapat dipecah menjadi sub-metric untuk identifikasi bottleneck:
  - *Order-to-dispatch time*: dari order confirm sampai barang keluar gudang
  - *Dispatch-to-delivery time*: dari keluar gudang sampai sampai ke customer
- Cost per Delivery dan Cost Ratio dipantau terpisah menurut **model transporter** (Internal/Eksternal) dan **DK/LK** (lihat 4.5.4) — jangan digabung rata-rata mentah karena karakteristik biaya sangat berbeda (LK jauh lebih tinggi dari DK).
- Modul **Pengajuan Dana & Realisasi Biaya** (4.5.5) menggunakan agregasi Cost per Delivery/Total Biaya bulanan (khusus Internal) sebagai basis pengajuan anggaran bulan berikutnya.

**Komponen biaya Cost per Delivery (Internal):**
- BBM (liter & rupiah)
- Bongkar muat
- Hotel (untuk trip luar kota yang menginap)
- Uang makan driver & helper
- Tol & parkir
- Kirim paket (opsional, titipan kurir kecil di luar muatan utama)

**Komponen biaya Cost per Delivery (Eksternal — Retail & Trucking):**
- Total biaya kirim eksternal per invoice dari transporter (tidak dirinci per komponen, mengikuti tagihan ekspedisi)

Metrik biaya dapat dipecah lebih detail menjadi:
- Cost per delivery per DK vs per LK
- Cost Ratio (biaya kirim / nilai invoice) per shipment atau per bulan
- Cost per drop point (untuk trip multi-drop)

**Implikasi data & modul terkait:**
- Event status, POD, dan waktu aktual menjadi basis perhitungan OTD dan lead time; detail item per stop menjadi basis OTIF.
- Biaya aktual dicatat sekali pada level trip dan dialokasikan ke stop untuk analitik Cost per Delivery dan Cost Ratio. `master_rate_card` hanya menjadi referensi estimasi/proyeksi.
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

#### 4.4.1 HD Machine Utilization & Replenishment Support (Dukungan Customer & Marketing)

**Tujuan:** Membantu SCM memberikan dukungan proaktif ke **pelanggan (RS/klinik HD)** dan **tim marketing** terkait kebutuhan & pemakaian consumable HD Set, berdasarkan jumlah mesin HD yang terpasang di tiap customer — sehingga follow-up PO ke customer bisa dilakukan tepat waktu sebelum stok mereka habis. Modul ini mendigitalkan dashboard monitoring manual yang sudah berjalan (`DASHBOARD INVENTORY CONTROL STOK HD SET DI RS`).

**Konteks bisnis:** Setiap customer HD (RS/klinik dengan mesin dialisis) punya kebutuhan consumable HD Set yang proporsional terhadap jumlah mesin dan frekuensi tindakan (default asumsi: 2x tindakan/hari/mesin, 25 hari kerja/bulan). SCM tidak memiliki visibilitas stok fisik di gudang customer — perkiraan stok saat ini dihitung dari kombinasi jumlah mesin, asumsi pemakaian, dan riwayat pengiriman terakhir ke customer tersebut.

**Fitur:**
- **Dashboard per customer HD** dengan kolom: Jumlah Mesin HD, Estimasi Pemakaian Harian, Kebutuhan Bulanan, Safety Stock, ROP, Stok Akhir (tgl+qty), Pengiriman Terakhir (tgl+qty), Estimasi Stok Saat Ini, DOI (Days of Inventory), Estimasi Tanggal Habis, Available Stock/Hari, Tanggal FU-PO (Follow-Up Purchase Order)
- **Badge status** per customer: Aman (hijau), Mendekati FU-PO (kuning), Lewat FU-PO / stok negatif / data pengiriman kosong (merah — prioritas tinggi)
- **Alert/notifikasi** untuk tim marketing & sales saat customer mendekati atau melewati tanggal FU-PO, supaya follow-up PO ke customer dilakukan sebelum stok benar-benar habis
- **Input/update manual**: jumlah mesin HD per customer, tanggal & qty pengiriman terakhir, info stok on-hand dari customer (jika ada)
- **Filter per kota/wilayah** — membantu perencanaan rute pengiriman consumable HD Set berikutnya (bisa terhubung ke modul TMS di 4.5 jika pengirimannya memakai transportasi cabang)
- **Export laporan** (format mirip dashboard existing, dengan tanggal snapshot) untuk dibagikan ke tim marketing sebagai bahan follow-up ke customer

**Formula (mengikuti logika dashboard yang sudah berjalan):**

| Field | Formula |
|---|---|
| Estimasi Pemakaian Harian | `jumlah_mesin_hd x tindakan_per_hari_per_mesin` (default 2) |
| Kebutuhan Bulanan | `estimasi_harian x hari_kerja_per_bulan` (default 25) |
| Safety Stock | `estimasi_harian x safety_stock_days` (default 6 hari) |
| ROP (Reorder Point) | `estimasi_harian x rop_days` (default 8 hari) |
| Estimasi Stok Saat Ini | `stok_akhir_qty + pengiriman_terakhir_qty` |
| DOI (Days of Inventory) | `estimasi_stok / estimasi_harian` |
| Estimasi Tanggal Habis | `tanggal_pengiriman_terakhir + DOI` |
| Available Stock | `estimasi_stok - rop_qty` (buffer di atas titik reorder) |
| Available Hari | `available_stock / estimasi_harian` |
| Tanggal FU-PO | `estimasi_tanggal_habis - lead_time_reorder` (lead time dikonfigurasi per customer, historis bervariasi ~8–11 hari) |

**Aturan bisnis:**
- Berlaku khusus untuk customer berkategori **HD** (`customers.is_hd_customer = true`)
- Jika belum pernah ada data pengiriman ke suatu customer, sistem menampilkan status prioritas tinggi ("Data tidak lengkap/stok berpotensi negatif") alih-alih menghitung tanggal FU-PO
- "Stok Akhir" saat ini pada praktiknya sering bernilai 0 karena SCM tidak punya visibilitas stok fisik di gudang customer — ini keterbatasan yang perlu didokumentasikan; peningkatan akurasi ke depan bisa datang dari pelaporan stok on-hand berkala oleh customer/marketing
- Snapshot dashboard dibuat berkala (mengikuti praktik saat ini yang manual per tanggal "Dibuat: [tanggal]") — bisa dijadwalkan mingguan di aplikasi

### 4.4.2 Inventory Reconciliation & Data Governance

**Keputusan desain v1.6:** NAV Vision tetap menjadi *source of truth* untuk saldo stok. SCM Control Tower tidak boleh membentuk saldo stok paralel tanpa proses rekonsiliasi yang disetujui.

**Fitur dan aturan bisnis:**
- Snapshot stok NAV per SKU-lokasi diimport secara terjadwal atau manual dengan batch ID, nama file, waktu upload, dan uploader.
- Halaman rekonsiliasi membandingkan stok NAV, stock opname bila tersedia, barang inbound yang belum posted, serta barang outbound/crossdock yang belum selesai.
- Selisih tidak mengubah saldo NAV; selisih dibuat sebagai Issue Log dengan PIC, alasan, tindakan koreksi, dan status penyelesaian.
- Data NAV yang telah dipakai dalam shipment, POD, atau laporan biaya tidak boleh dihapus. Koreksi dilakukan melalui batch koreksi/audit event, bukan edit diam-diam.

### 4.5 Shipment Tracking & TMS (Transport Management System)

**Tujuan:** Mengisi gap yang tidak dicover NAV Vision — mencatat proses fisik pengiriman dari PSS terbit sampai barang diterima pelanggan, karena NAV Vision hanya mencatat dokumen (PSS) tanpa proses transportasinya.

#### 4.5.1 Gap Analysis — Data NAV Vision vs Kebutuhan TMS

| Data | Tersedia di NAV (PSS Header) | Status | Catatan |
|---|---|---|---|
| No. PSS, Order No., Customer | ✅ (`No.`, `Order No.`, `Sell-to Customer No/Name`) | Ada | Sudah tercakup di `outbound_header` |
| Nomor PSI (Posted Sales Invoice) | ✅ (ada di laporan biaya kirim eksisting) | Ada, belum di-capture di app | Perlu ditambahkan sebagai field baru di `outbound_header` (`psi_no`) — dipakai untuk mengambil **Invoice Value** basis Cost Ratio |
| Document Date | ✅ (`Document Date`) | Ada | Tanggal dokumen diterbitkan, bukan tanggal kirim aktual |
| Promised Delivery Date | ✅ (`Promised Delivery Date`) | Ada | Janji ke pelanggan — basis perhitungan keterlambatan |
| Cust. Receipt Date | ✅ (`Cust. Receipt Date`) | Ada, tapi tidak reliable | Sering diisi sama dengan document date di NAV, bukan waktu real diterima customer |
| Location Code (gudang asal) | ✅ (`Location Code`) | Ada | Contoh: `MDN-PAR` |
| Package Tracking No. | ✅ (kolom ada, sering kosong) | Parsial | Field disediakan NAV tapi tidak konsisten diisi |
| **Klasifikasi DK/LK (Dalam Kota/Luar Kota) per pelanggan** | ❌ | **Gap** | Saat ini dikelola manual di spreadsheet terpisah (~94 pelanggan sudah dipetakan) — perlu jadi field master (`customers.region_type`) |
| **Kendaraan/armada yang mengirim** | ❌ | **Gap** | Perlu dicatat manual di app (assign dari `master_vehicle`) |
| **Driver & Helper** | ✅ | Tersedia | Dipilih dari master driver/helper saat membuat atau mengedit Shipment |
| **Rute pengiriman** | ✅ | Tersedia | Dipilih dari master route saat membuat atau mengedit Shipment |
| **Waktu dispatch aktual (keluar gudang)** | ✅ | Tersedia | Diisi pada Shipment; basis perhitungan *dispatch-to-delivery time* |
| **Waktu delivery aktual (sampai ke pelanggan)** | ✅ | Tersedia | Diisi melalui Shipment/POD; basis perhitungan OTD real |
| **Bukti serah terima (POD)** | ✅ | Tersedia | Nama penerima, waktu terima, dan catatan; media foto/tanda tangan masih opsional/backlog |
| **Transporter (Internal/Eksternal) & model layanan** | ✅ | Tersedia | Dipilih saat membuat atau mengedit Shipment |
| **Rincian biaya aktual per trip/shipment** | ✅ sebagian | Tersedia | Diisi pada menu Shipment Cost; Internal memakai komponen biaya operasional, Eksternal memakai invoice/total biaya |
| **Pengajuan Dana & Realisasi Biaya bulanan (khusus Internal)** | Proses manual via dokumen teks + approval berjenjang | **Parsial** | Agregasi dan halaman budget tersedia; approval/export lanjutan tetap backlog — lihat 4.5.5 |
| **Data crossdocking dari Kantor Pusat** | ❌ (tidak ada di NAV cabang) | **Gap** | Perlu input manual — lihat modul Crossdocking (4.3.1) |

#### 4.5.2 Alur Status Pengiriman (Delivery Workflow)

```
PSS diupload (dari NAV)
      │
      ▼
[Draft]  — PSS dipilih dari daftar For Transport Planning dan dibuat menjadi Shipment
  │  (assign: transporter, kendaraan, driver, helper, rute, Trip ID)
      ▼
[Dispatched]  — input waktu keluar gudang (dispatch_time), odometer/muatan opsional
      │
      ▼
[In Transit]  — opsional: update posisi/checkpoint jika multi-drop
      │
      ▼
[Delivered]  — input waktu sampai (delivery_time) + POD (nama penerima, tanda tangan/foto)
```

**Catatan:** Detail status pengiriman dikelola pada menu Shipment. Kendali perjalanan tidak memerlukan menu terpisah; assignment sumber daya dilakukan pada panel pembuatan/edit Shipment. Jika terjadi kendala operasional di lapangan, dicatat pada catatan Shipment dan/atau **Issue Log (4.8)**.

#### 4.5.2a Keputusan Pengendalian Status & Exception (v1.6)

Ketentuan pada sub-bab ini menggantikan asumsi sebelumnya bahwa setiap shipment yang dispatch pasti berakhir Delivered.

**Status normal:** `Draft` -> `Dispatched` -> `In Transit` -> `Delivered`.

- `Draft`: sumber PSS/Crossdocking sudah tervalidasi, belum ditetapkan ke trip.
- `Dispatched`: `dispatch_time` wajib terisi.
- `Delivered`: `delivery_time`, nama penerima, dan POD wajib terisi. Kuantitas aktual wajib dicatat ketika modul line sudah tersedia.

**Exception:** dari `Dispatched` atau `In Transit`, user berwenang dapat membuat event `Delivery Attempt Failed`, `Partial Delivered`, `Rescheduled`, `Cancelled`, atau `Returned` bila kebutuhan bisnis tersebut diaktifkan. Setiap event wajib memiliki waktu, alasan, PIC, dan referensi Issue Log bila ada.

**Kontrol:** perubahan status harus melalui transisi yang diizinkan dan tercatat pada event log yang tidak dapat ditimpa. Koreksi terhadap `Delivered` hanya dilakukan Admin dengan alasan. Status Crossdocking yang telah masuk TMS mengikuti status TMS sebagai sumber kebenaran agar tidak ada dua status operasional yang berbeda.

#### 4.5.3 Fitur

- **For Transport Planning**: daftar PSS dari Outbound yang belum dibuatkan Shipment Tracking; user dapat memilih satu atau beberapa PSS lalu membuat Shipment.
- **List Outbound Deliveries**: daftar Shipment yang sudah dibuat, berisi PSS/CD No., Document Date, customer, transporter, driver, Trip ID, status, dan POD.
- **Pembuatan/edit Shipment**: assign **transporter** (Internal/Eksternal), kendaraan, driver, helper, rute, dan Trip ID dalam satu panel Shipment.
- **Update status** dengan timestamp aktual: `dispatch_time`, `delivery_time`
- **Input POD**: nama penerima, waktu terima, foto bukti (upload), catatan
- **Shipment Cost**: menu terpisah untuk mengisi biaya aktual berdasarkan model transporter; tidak ada form biaya pada panel Shipment.
- **Kalkulasi otomatis**: `dispatch_to_delivery_hours`, `is_on_time` (vs Promised Delivery Date NAV), status OTIF per shipment
- Data ini menjadi sumber utama untuk KPI Delivery & Distribution (4.1.1): OTD, OTIF, Delivery Lead Time, Vehicle/Transporter Utilization, Cost per Delivery

**Aturan bisnis:**
- Satu shipment (`shipment_tracking`) terhubung ke satu sumber (`outbound_header`/PSS atau `crossdocking_header`); beberapa shipment masih dapat memakai Trip ID yang sama untuk kebutuhan grouping dan pelaporan.
- Status hanya bisa maju (Draft → Dispatched → In Transit → Delivered), tidak mundur, kecuali koreksi oleh Admin
- Tidak ada status retur/gagal — proses ini tidak berlaku di operasional cabang
- `is_on_time` dihitung dari `delivery_time` aktual vs `Promised Delivery Date` dari NAV (untuk shipment sumber PSS) atau tanggal janji kirim manual (untuk shipment sumber Crossdocking)

#### 4.5.3a Model Data Trip, Stop, dan Line (v1.6)

Untuk pengiriman multi-drop, `trip_id` saja tidak cukup sebagai tempat mencatat biaya. Model data operasional yang wajib digunakan adalah:

```text
Trip (satu kendaraan/perjalanan atau satu invoice transporter)
  -> Trip Stop (satu tujuan/shipment)
      -> Trip Stop Line (item, qty planned, qty delivered, reason)
  -> Trip Expense (biaya aktual satu kali)
  -> Expense Allocation (porsi biaya dari Trip ke setiap Stop)
```

**Aturan bisnis:**
- Satu Trip dapat mempunyai banyak Stop; satu Stop terkait tepat satu sumber PSS atau Crossdocking.
- Biaya aktual Internal maupun Eksternal dicatat satu kali pada Trip/Invoice. Total biaya cabang selalu dihitung dari Trip Expense, bukan penjumlahan biaya yang diulang pada setiap stop.
- Untuk multi-drop, `allocation_method` wajib dipilih: `weight`, `invoice_value`, `quantity`, atau `equal`. Sistem menyimpan `allocated_cost` per stop beserta metode dan nilai pembaginya.
- Cost per Delivery dan Cost Ratio per customer memakai `allocated_cost`; total biaya laporan cabang memakai biaya sumber Trip/Invoice satu kali.
- `Trip Stop Line` menyimpan qty planned dan qty delivered; data inilah prasyarat perhitungan OTIF dan partial delivery.

#### 4.5.4 Model Transporter & Skema Biaya

Cabang menggunakan kombinasi armada internal dan transporter eksternal, masing-masing dengan skema biaya berbeda. Selain itu, setiap pengiriman diklasifikasikan berdasarkan **DK/LK** (Dalam Kota/Luar Kota) — dimensi terpisah dari model transporter, ditentukan dari lokasi pelanggan tujuan (`customers.region_type`), bukan dari jenis transporter yang dipakai.

| Model | Jumlah | Deskripsi | Skema Biaya | Multi-drop |
|---|---|---|---|---|
| **Internal** | 2 unit truck (milik SRU) | Kendaraan operasional milik cabang sendiri, dengan driver + helper internal | Rincian komponen biaya aktual per trip (lihat di bawah) | Bisa |
| **Eksternal — Retail** | 3 transporter eksternal (jasa retail) | Pengiriman partai kecil, cocok untuk pengiriman ke banyak tujuan dengan volume kecil per tujuan | Berdasarkan **No. Invoice** dari ekspedisi + **Total Biaya Kirim Eksternal** per invoice | Tidak (satu tujuan per pengiriman) |
| **Eksternal — Trucking** | 3 transporter eksternal (jasa trucking) | Pengiriman partai besar / Full Truck Load (FTL) | Berdasarkan **No. Invoice** dari ekspedisi + **Total Biaya Kirim Eksternal** per invoice, dialokasikan per shipment jika multi-drop | Bisa (multi-drop dalam satu trip) |

**Rincian komponen biaya aktual per shipment (mengikuti format rekap bulanan yang sudah berjalan):**

| Field | Berlaku untuk | Keterangan |
|---|---|---|
| `dk_lk` | Semua | Dalam Kota / Luar Kota — diturunkan otomatis dari `customers.region_type` pelanggan tujuan |
| `payment_voucher_no` (No. Payment) | Semua | Nomor voucher reimbursement/kasbon dari finance, format mis. `K-MDN-B-2606-070` |
| `bbm_liter`, `bbm_rupiah` | Internal | Konsumsi BBM per trip |
| `bongkar_muat_cost` | Internal | Biaya bongkar muat |
| `hotel_cost` | Internal | Untuk trip luar kota yang menginap |
| `uang_makan_driver`, `uang_makan_helper` | Internal | Uang makan per trip |
| `toll_cost`, `parkir_cost` | Internal | Tol & parkir |
| `kirim_paket_cost` | Internal (opsional) | Biaya titip kirim paket kecil di luar muatan utama |
| `invoice_no_eksternal` | Eksternal | No. Invoice dari perusahaan ekspedisi |
| `total_biaya_eksternal` | Eksternal | Total tagihan dari ekspedisi per invoice |
| `total_biaya` | Semua | GENERATED — jumlah seluruh komponen (Internal) atau `total_biaya_eksternal` (Eksternal) |
| `invoice_value` | Eksternal | Nilai invoice/PSS dari NAV untuk analisis biaya eksternal; tidak digunakan untuk pengiriman Internal |
| `cost_ratio` | Eksternal | GENERATED — `total_biaya / invoice_value`; tidak ditampilkan atau dihitung sebagai rasio untuk pengiriman Internal |

**Catatan:**
- 3 transporter eksternal yang sama bisa melayani baik model Retail maupun Trucking tergantung kebutuhan pengiriman — model (Retail/Trucking) ditentukan per shipment/trip, bukan melekat permanen ke transporter.
- Pengiriman Internal tidak memerlukan Invoice Value, nomor invoice eksternal, atau nomor resi. Form Internal hanya mencatat biaya operasional seperti BBM, hotel, tol, parkir, uang makan, bongkar muat, kirim paket opsional, dan biaya lain-lain.
- Pengisian biaya dilakukan pada menu **Shipment Cost**, sedangkan menu **Shipment** hanya menyimpan data operasional, timeline, status, dan POD.
- Struktur di atas mengadopsi format kolom yang sudah dipakai cabang di rekap Excel bulanan "Realisasi Biaya Kirim Crossdocking", supaya transisi dari spreadsheet ke aplikasi tidak mengubah cara kerja tim finance/approval.
- `master_rate_card` tetap berguna sebagai referensi estimasi/proyeksi biaya (misalnya untuk modul Pengajuan Dana di 4.5.5), meskipun biaya aktual per shipment dicatat langsung di `shipment_tracking`.

#### 4.5.5 Pengajuan Dana & Realisasi Biaya Kirim (Budget Request & Cost Realization)

**Tujuan:** Mendigitalkan proses bulanan pengajuan dana biaya kirim (khusus transporter Internal) yang saat ini dikerjakan manual via dokumen teks + lampiran Excel, lengkap dengan breakdown DK/LK dan riwayat approval.

**Fitur:**
- **Realisasi Biaya (otomatis)**: agregasi bulanan dari `shipment_tracking` (transporter = Internal) — total biaya per DK, per LK, dan gabungan — menggantikan rekap manual "Realisasi Biaya Kirim SCM Medan Periode [Bulan]"
- **Proyeksi Biaya (input/estimasi)**: input proyeksi biaya bulan berjalan per DK/LK, bisa mengacu ke realisasi bulan sebelumnya + `master_rate_card` sebagai basis estimasi
- **Form Pengajuan Dana**: kalkulasi otomatis mengikuti format yang sudah berjalan:
  - `LK` + `DK` = **Total SRU Medan DK + LK**
  - `+ Buffer biaya SCM` = **Subtotal Pengajuan Biaya**
  - Pembulatan ke nilai pengajuan final (mis. dibulatkan ke kelipatan tertentu)
- **Lampiran otomatis**: referensi ke 3 dokumen yang biasa dilampirkan — PA (Proyeksi Anggaran) bulan berjalan, Proyeksi Biaya bulan berjalan, dan Realisasi Biaya bulan sebelumnya — semuanya bisa digenerate dari data yang sama di app
- **Info rekening bank** (master data, tidak berubah tiap bulan): nama bank, no. rekening, atas nama
- **Document Tracking / Approval Log**: daftar pihak yang perlu approve secara berurutan (nama + status/tanggal approve) — sebagai checklist sederhana, bukan workflow engine otomatis
- **Export**: hasil akhir bisa diexport ke format teks/PDF yang sama seperti dokumen pengajuan saat ini, supaya tetap kompatibel dengan proses submit ke finance pusat

**Aturan bisnis:**
- Modul ini hanya berlaku untuk transporter **Internal** — biaya Eksternal tidak melalui proses pengajuan dana ini karena dibayar berdasarkan invoice ekspedisi (proses AP/hutang biasa)
- Buffer biaya SCM adalah nilai tetap/manual yang bisa disesuaikan tiap bulan oleh Kepala Gudang saat submit pengajuan
- Realisasi bulan berjalan otomatis tersedia setelah seluruh shipment bulan tersebut berstatus Delivered dan biayanya sudah diinput lengkap

#### 4.5.6 Keputusan UI dan Navigasi v1.7

- Sidebar menampilkan menu **Shipment** sebagai pusat perencanaan dan monitoring pengiriman.
- Menu **Trip Control** tidak ditampilkan sebagai workflow terpisah. Data assignment perjalanan tetap tersimpan pada Shipment melalui `transporter_id`, `vehicle_id`, `driver_id`, `helper_id`, `route_id`, dan `trip_id`.
- Menu **Shipment Cost** menjadi satu-satunya tempat input komponen biaya dan referensi invoice biaya.
- Pada menu Shipment, tab **For Transport Planning** menampilkan PSS yang belum dibuatkan Shipment; tab **List Outbound Deliveries** menampilkan Shipment yang sudah dibuat.
- Tabel data pada Shipment, Receiving, dan Outbound menggunakan scroll pada area tabel; header halaman dan kontrol tetap berada di luar area scroll.

### 4.6 Workflow
- Analitik receiving: lead time trend, keterlambatan per shipping agent
- Visualisasi alur proses SCM

### 4.7 Master Data

| Sub-modul | Deskripsi |
|---|---|
| **Customers** | Data pelanggan: kode, nama, alamat, kota, koordinat, lead time, region_type (DK/LK), **is_hd_customer & jumlah_mesin_hd** *(baru — lihat 4.4.1)* |
| **SKU** | Kode produk, nama, kategori, UOM, safety stock, grup |
| **Vehicles** | Data armada kendaraan internal (2 unit): nopol, tipe, kapasitas (volume/berat), status |
| **Drivers & Helpers** *(baru)* | Data kru internal: nama, role (Driver/Helper), no. SIM (untuk driver), no. HP, status aktif |
| **Transporters** *(baru)* | Data transporter: Internal (SRU) atau Eksternal (3 perusahaan) — nama, jenis layanan (Retail/Trucking), kontak PIC |
| **Routes** | Rute pengiriman: origin, destination, estimasi waktu |
| **Rate Card** | Referensi tarif untuk estimasi/proyeksi biaya (biaya aktual dicatat langsung per shipment — lihat 4.5.4) |
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

**Catatan runtime:** Konvensi Next.js 16 menggunakan `proxy.ts` untuk refresh session Supabase dan proteksi route. File `middleware.ts` tidak lagi digunakan.

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

## 6.1 Keputusan Arsitektur Data & Migrasi (v1.6)

- **Satu master transporter:** aplikasi menggunakan tepat satu tabel master transporter sebagai sumber resmi. Bila `vendors` dipilih sebagai master, `shipment_tracking.transporter_id` harus mereferensikan `vendors.id`; bila `master_transporter` dipilih, seluruh UI dan import harus menggunakan tabel tersebut. Penyimpanan nama transporter/kendaraan/driver di `notes` tidak boleh menjadi sumber laporan resmi.
- **Implementasi saat ini:** transporter pada alur Shipment berasal dari tabel `vendors`, armada dari `transport_fleet`, driver/helper dari `master_driver`, dan rute dari `routes`. View TMS boleh menambahkan field hasil join untuk display, tetapi field tersebut tidak boleh dikirim kembali ke tabel `shipment_tracking` saat update.
- **Identitas dan audit:** setiap operasi create, update, delete, perubahan status, upload batch, POD, dan approval menyimpan `user_id`, waktu, aksi, nilai sebelum/sesudah yang relevan, dan alasan koreksi.
- **Transaksi atomik:** pembuatan Crossdocking beserta detail, pembuatan Trip dengan Stop, serta pengalokasian biaya harus atomik. Jika salah satu bagian gagal, tidak boleh ada header atau biaya yatim.
- **Penomoran aman konkurensi:** nomor Trip, Crossdocking, Issue, dan batch upload dibuat pada database dengan sequence/unique constraint; aplikasi tidak boleh hanya mencari nomor terbesar lalu menambah satu.
- **Snapshot HD:** `machine_count` dan parameter konsumsi yang dipakai pada kalkulasi disalin ke record snapshot agar histori tidak berubah saat master customer diperbarui. Kalkulasi dapat dikerjakan melalui view atau trigger; generated column tidak boleh memakai subquery ke tabel customer.

## 7. Struktur Database (Tabel Utama)

```
outbound_header     — PSS header (shipment_no UNIQUE, + psi_no BARU)
outbound_detail     — ILE outbound (entry_no NOT NULL, is_sale GENERATED)
receiving_header    — PTR header (ptr_no UNIQUE)
receiving_detail    — ILE inbound
crossdocking_header — Header crossdocking dari Kantor Pusat, input manual (BARU)
crossdocking_detail — Detail item crossdocking (BARU)
customers           — Master pelanggan (customer_code, + region_type BARU: DK/LK)
master_sku          — Master produk (sku_code)
master_vehicle      — Master kendaraan internal (2 unit)
master_driver       — Master driver & helper internal (BARU — untuk TMS, + field role)
master_transporter  — Master transporter Internal/Eksternal (BARU — untuk TMS)
master_route        — Master rute
master_rate_card    — Referensi tarif untuk estimasi/proyeksi biaya
shipment_tracking   — Tracking & TMS pengiriman aktif (DIPERLUAS — lihat detail di bawah)
trip                — Header perjalanan/invoice transporter (BARU v1.6)
trip_stop           — Tujuan/shipment di dalam trip (BARU v1.6)
trip_stop_line      — Item dan qty planned/actual per stop, basis OTIF (BARU v1.6)
trip_expense        — Komponen biaya aktual satu kali per trip/invoice (BARU v1.6)
expense_allocation  — Alokasi biaya trip ke stop/shipment (BARU v1.6)
shipment_event_log  — Riwayat status dan exception yang append-only (BARU v1.6)
upload_batch        — Jejak batch import NAV dan hasil validasi (BARU v1.6)
delivery_pod        — Bukti serah terima / Proof of Delivery (BARU)
budget_request       — Pengajuan dana biaya kirim bulanan, khusus Internal (BARU)
budget_approval_log   — Riwayat/checklist approval pengajuan dana (BARU)
hd_stock_monitoring    — Monitoring stok consumable HD Set per customer HD (BARU — lihat 4.4.1)
```

**Field tambahan pada `customers`:**
```
region_type       — DK | LK — klasifikasi Dalam Kota/Luar Kota, dipakai untuk breakdown Cost per Delivery & Pengajuan Dana
is_hd_customer      — boolean — penanda customer kategori HD (rumah sakit/klinik dialisis)
hd_machine_count       — jumlah mesin HD terpasang di customer (khusus is_hd_customer = true)
```

**Field tambahan pada `outbound_header`:**
```
psi_no    — Nomor Posted Sales Invoice dari NAV, dipakai untuk mengambil invoice_value (basis Cost Ratio)
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

**Field tambahan pada `master_driver` (kru internal):**
```
role    — Driver | Helper
```

**Field pada `shipment_tracking` (untuk mendukung TMS & pencatatan biaya riil):**
```
shipment_id             — ID internal shipment
source_type              — PSS | Crossdocking
source_id                  — FK ke outbound_header ATAU crossdocking_header (tergantung source_type)
trip_id                      — grouping untuk multi-drop trip
transporter_id                — FK ke master_transporter
vehicle_id                      — FK ke master_vehicle (diisi jika transporter_id = Internal)
driver_id                         — FK ke master_driver, role=Driver (diisi jika transporter_id = Internal)
helper_id                           — FK ke master_driver, role=Helper (diisi jika transporter_id = Internal)
route_id                              — FK ke master_route (nullable)
status                                  — Draft | Dispatched | In Transit | Delivered
dispatch_time                            — timestamp aktual keluar gudang
delivery_time                              — timestamp aktual sampai ke pelanggan
is_on_time                                  — GENERATED: delivery_time <= promised_delivery_date

-- klasifikasi & biaya
dk_lk                — GENERATED/copy dari customers.region_type pelanggan tujuan
payment_voucher_no     — No. Payment / voucher reimbursement dari finance
bbm_liter, bbm_rupiah    — khusus Internal
bongkar_muat_cost          — khusus Internal
hotel_cost                   — khusus Internal
uang_makan_driver              — khusus Internal
uang_makan_helper                — khusus Internal
toll_cost, parkir_cost             — khusus Internal
kirim_paket_cost                     — khusus Internal, opsional
invoice_no_eksternal                    — khusus Eksternal
total_biaya_eksternal                     — khusus Eksternal
total_biaya                                  — GENERATED: jumlah komponen Internal, atau total_biaya_eksternal
invoice_value                                  — nilai invoice/PSS dari NAV, khusus shipment eksternal (basis Cost Ratio)
cost_ratio                                        — GENERATED untuk shipment eksternal; Internal tidak memakai rasio invoice
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

**Tabel baru `budget_request` (Pengajuan Dana bulanan — khusus Internal):**
```
budget_request_id       — PK
period                     — mis. "2026-09"
lk_amount_projected          — proyeksi biaya LK
dk_amount_projected            — proyeksi biaya DK
total_projected                  — GENERATED: lk_amount_projected + dk_amount_projected
buffer_amount                      — buffer biaya SCM (input manual per bulan)
subtotal                              — GENERATED: total_projected + buffer_amount
rounded_request_amount                  — nilai pengajuan final (dibulatkan)
bank_name, bank_account_no, bank_account_holder
previous_realization_ref                    — referensi ke rekap realisasi bulan sebelumnya (agregat shipment_tracking)
notes
created_at
```

**Tabel baru `budget_approval_log`:**
```
log_id             — PK
budget_request_id    — FK ke budget_request
approver_name           — nama pihak yang harus approve
sequence_no               — urutan approval
status                       — Pending | Approved (opsional, sederhana)
approved_at
```

**Tabel baru `hd_stock_monitoring` (per customer HD, per snapshot):**
```
monitoring_id           — PK
customer_id               — FK ke customers (is_hd_customer = true)
snapshot_date               — tanggal snapshot dashboard dibuat
treatment_per_day_per_machine — default 2 (bisa dikustomisasi per customer)
working_days_per_month          — default 25
safety_stock_days                 — default 6
rop_days                            — default 8
lead_time_reorder_days                — default ~8-11, dikonfigurasi per customer

-- input manual
last_known_stock_date, last_known_stock_qty   — Stok Akhir
last_shipment_date, last_shipment_qty           — Pengiriman terakhir

-- GENERATED
daily_usage           — hd_machine_count x treatment_per_day_per_machine
monthly_need            — daily_usage x working_days_per_month
safety_stock_qty           — daily_usage x safety_stock_days
rop_qty                       — daily_usage x rop_days
estimated_stock                 — last_known_stock_qty + last_shipment_qty
doi_days                           — estimated_stock / daily_usage
estimated_stockout_date              — last_shipment_date + doi_days
available_stock                        — estimated_stock - rop_qty
available_days                           — available_stock / daily_usage
fu_po_date                                 — estimated_stockout_date - lead_time_reorder_days

notes
```

---

## 8. Non-Functional Requirements

- **Performa:** Halaman utama load < 3 detik untuk data 1000 baris
- **Upload:** Support file hingga 10MB (dikonfigurasi via `next.config.ts` `bodySizeLimit`)
- **Keamanan:** Semua operasi tulis menggunakan `supabaseAdmin` (service role, bypass RLS) dari Server Action — tidak expose ke client
- **Responsif:** Tampilan optimal di desktop (minimum 1280px lebar)

### 8.1 Keamanan, Otorisasi, dan Audit (v1.6)

- Login wajib untuk semua halaman dan Server Action yang membaca atau mengubah data operasional.
- Service-role Supabase hanya boleh dipakai di server. Setiap Server Action yang memakainya wajib memverifikasi session dan otorisasi user terlebih dahulu; service role bukan pengganti otorisasi aplikasi.
- Tahap saat ini memiliki role `Admin`. Desain akses masa depan: `Admin` (master data/koreksi/approval), `Operator Gudang` (upload, receiving, dispatch), `Driver/Checker` (update checkpoint/POD), dan `Viewer` (read-only).
- Data final (POD, biaya final, delivery final, approval) tidak dihapus; koreksi dilakukan dengan event/audit trail sesuai kewenangan.
- Foto POD disimpan pada storage privat dengan akses berbasis autentikasi; URL publik permanen tidak digunakan.

---

## 9. Backlog / Planned Features

### Prioritas Go-Live (wajib sebelum KPI dan biaya menjadi dasar keputusan)

- [ ] Konsolidasikan `vendors` dan `master_transporter` menjadi satu master resmi, lalu perbaiki seluruh FK dan laporan.
- [ ] Implementasikan model `Trip`, `Trip Stop`, `Trip Expense`, dan `Expense Allocation`; migrasikan biaya yang saat ini tersimpan per shipment agar total biaya tidak berlipat pada multi-drop.
- [ ] Ubah dashboard OTD agar hanya memakai `delivery_time` aktual + POD; tampilkan Overdue/Open Shipment terpisah.
- [ ] Implementasikan event log append-only serta exception delivery dan alasan koreksi. Status operasional saat ini tetap `Draft`, `Dispatched`, `In Transit`, dan `Delivered`.
- [ ] Tambahkan trip stop line untuk qty planned/actual sebelum mengaktifkan KPI OTIF.
- [ ] Perbaiki model snapshot HD dan buat view/trigger kalkulasi yang valid di PostgreSQL.
- [ ] Tambahkan rekonsiliasi inventory NAV vs snapshot/opname/in-transit serta upload batch audit.
- [ ] Terapkan verifikasi session/role pada seluruh Server Action dan audit field pada mutasi data.

- [ ] Autentikasi dan role-based access control (admin, operator, viewer)
- [ ] Dashboard KPI real-time dengan refresh otomatis
- [ ] Notifikasi email/WhatsApp untuk keterlambatan delivery
- [ ] Integrasi langsung dengan NAV API (menggantikan upload manual)
- [ ] Mobile view untuk operator gudang
- [ ] Update LOT dan Expiry Date via upload ulang (script `update_lot_expiry.py` tersedia)
- [ ] Paginasi pada tabel outbound dan receiving untuk dataset besar

**TMS (Transport Management System):**
- [x] Master data Driver/Helper (`master_driver`) — CRUD dasar, dengan field role
- [x] Master data Transporter melalui `vendors` — Internal (SRU) dan eksternal dengan model layanan
- [ ] Tabel `delivery_pod` + upload foto POD ke Supabase Storage (data POD dasar sudah tersedia; media masih backlog)
- [x] Form input manual Crossdocking (`crossdocking_header`/`crossdocking_detail`) — lihat 4.3.1
- [x] Assignment transporter, kendaraan, driver/helper, rute, dan Trip ID dilakukan pada form Shipment; halaman Trip Control terpisah tidak menjadi workflow utama
- [x] Update status shipment dan waktu aktual melalui form Shipment/POD
- [x] Perhitungan otomatis `is_on_time` berbasis `Promised Delivery Date` dan `delivery_time`
- [x] Modul input biaya pada Shipment Cost dengan formula Internal, Eksternal-Retail, dan Eksternal-Trucking
- [ ] Setup `master_rate_card` dengan struktur per kg per tujuan (Retail) dan per rute (Trucking)
- [ ] Notifikasi/alert saat shipment melewati Promised Delivery Date tapi status masih Draft/Dispatched
- [ ] (Jangka panjang) Integrasi GPS tracking kendaraan real-time, jika budget/hardware tersedia

**Cost Tracking & Budget Request:**
- [ ] Tambahkan `psi_no` ke `outbound_header` dan `region_type` (DK/LK) ke `customers` — termasuk import awal ~94 pelanggan yang sudah dipetakan DK/LK dari spreadsheet eksisting
- [x] Form input biaya shipment sesuai rincian komponen riil (BBM, bongkar muat, hotel, uang makan driver/helper, tol, parkir, kirim paket, biaya lain-lain) untuk Internal; No. Invoice + Total Biaya untuk Eksternal
- [x] Master data Driver & Helper dengan field `role`
- [ ] Modul Pengajuan Dana & Realisasi Biaya (4.5.5): form proyeksi, kalkulasi otomatis subtotal, export ke format dokumen yang sesuai dengan proses submit ke finance saat ini
- [ ] Dashboard/laporan Cost Ratio (biaya kirim vs invoice value) per shipment, per bulan, per DK/LK

**HD Machine Utilization & Replenishment Support:**
- [ ] Tambahkan `is_hd_customer` dan `hd_machine_count` ke `customers`, termasuk import data ~26 customer HD yang sudah ada di dashboard existing
- [ ] Modul `hd_stock_monitoring` (4.4.1): CRUD snapshot per customer, kalkulasi otomatis daily usage/DOI/estimasi habis/FU-PO
- [ ] Dashboard dengan badge status (Aman/Mendekati FU-PO/Lewat FU-PO) dan filter per kota/wilayah
- [ ] Notifikasi ke tim marketing/sales saat customer mendekati atau melewati tanggal FU-PO
- [ ] Export laporan snapshot untuk dibagikan ke tim marketing
- [ ] (Catatan: field terkait Nomor PSI/Invoice Value untuk Cost Ratio — lihat 4.5.4 — ditunda ke update berikutnya)

---

## 10. Catatan Implementasi

- Project dipindahkan ke `d:\project\scm-tower\` — path lama tidak berlaku
- Dev server berjalan dengan `npm run dev` dari direktori tersebut
- Cache Next.js (`.next`) perlu dihapus dan server di-restart setelah perubahan `next.config.ts`
- Kolom `is_sale` dan `delivery_delay_days` adalah generated columns di Supabase — tidak boleh di-insert manual
- Next.js versi yang digunakan: **16.3.3** (Turbopack) — ada breaking changes dari versi sebelumnya
- Konvensi autentikasi Next.js 16 sudah menggunakan `proxy.ts`; `middleware.ts` telah dihapus.

---

## 12. Changelog Implementasi (September 2026)

### 12.1 Issue Log

**Status: ✅ Diimplementasikan**

- Halaman `/issues` dengan tabel dan summary badge (Open / In Progress / Closed / Total)
- Form tambah/edit/hapus issue via modal (`IssueEditPanel`)
- Field: Kategori, Judul, Deskripsi, Rencana Mitigasi, Status, Probability, Impact, PIC (Pelapor), Tanggal Issue, Due Date, Tanggal Closed
- **Penomoran otomatis** format `ISS-YYMM-0001` (4 digit, per bulan) — contoh `ISS-2609-0001`
- Kolom **UMUR** issue di tabel (badge warna: hijau <3h, kuning 3-6h, orange 7-13h, merah ≥14h, abu = Closed)
- Kolom **PIC** di tabel dan form
- Semua operasi tulis pakai **Server Action** (`supabaseAdmin`) — bypass RLS
- Kolom di `issue_log`: `id, issue_no, issue_date, category, title, description, impact, probability, status, due_date, closed_at, mitigation_plan, pic_name, created_at, updated_at, owner_id`
- SQL untuk tambah kolom PIC: `ALTER TABLE public.issue_log ADD COLUMN IF NOT EXISTS pic_name text;`

### 12.2 Shipment Tracking — Tab "Belum Dibuat"

**Status: ✅ Diimplementasikan**

- Halaman Shipment dipecah jadi 2 tab: **Belum Dibuat** (orange) dan **Tracking** (indigo)
- Tab "Belum Dibuat" membaca dari view `vw_pss_untracked` yang berisi:
  - PSS dari `outbound_header` yang belum punya `shipment_tracking` (via `pss_no`)
  - Crossdocking dari `crossdocking_header` yang belum `Delivered/Cancelled` dan belum punya tracking (via `crossdocking_id`)
- Badge counter di tab menampilkan jumlah pending
- Kolom tabel: PSS No, Tipe (PSS/Crossdocking), Customer, Kota Tujuan, Doc Date, Promised Date, Delay
- **Kota Tujuan** di-lookup dari `customers.city` via `customer_no` (COALESCE dengan `ship_to_city`)
- Checkbox multi-select + floating bar "Buat Shipment →" saat ada yang dipilih
- Klik baris atau floating bar membuka `BulkShipmentPanel`
- Data cutoff: hanya PSS `document_date >= '2026-09-01'`

SQL view (Supabase):
```sql
DROP VIEW IF EXISTS public.vw_pss_untracked;
CREATE VIEW public.vw_pss_untracked AS
SELECT h.id, 'PSS'::text AS source_type, h.pss_no, h.customer_no, h.customer_name,
  COALESCE(c.city, h.ship_to_city) AS destination_city,
  h.document_date, h.promised_delivery_date, h.is_late, h.delivery_delay_days, h.psi_no
FROM public.outbound_header h
LEFT JOIN public.customers c ON c.customer_code = h.customer_no
WHERE h.document_date >= '2026-09-01'
  AND NOT EXISTS (SELECT 1 FROM public.shipment_tracking st WHERE st.pss_no = h.pss_no)
UNION ALL
SELECT cd.id, 'Crossdocking'::text AS source_type, 'CD-' || cd.id::text AS pss_no,
  cd.customer_code AS customer_no, cd.customer_name,
  COALESCE(c.city, cd.destination_address) AS destination_city,
  cd.received_from_hq_date AS document_date, cd.promised_delivery_date,
  CASE WHEN cd.promised_delivery_date < CURRENT_DATE THEN true ELSE false END AS is_late,
  CASE WHEN cd.promised_delivery_date < CURRENT_DATE THEN (CURRENT_DATE - cd.promised_delivery_date) ELSE 0 END AS delivery_delay_days,
  NULL::text AS psi_no
FROM public.crossdocking_header cd
LEFT JOIN public.customers c ON c.customer_code = cd.customer_code
WHERE cd.received_from_hq_date >= '2026-09-01'
  AND cd.status NOT IN ('Delivered', 'Cancelled')
  AND NOT EXISTS (SELECT 1 FROM public.shipment_tracking st WHERE st.crossdocking_id = cd.id)
ORDER BY document_date DESC;
```

### 12.3 Bulk Create Shipment

**Status: ✅ Diimplementasikan**

- `BulkShipmentPanel` — modal untuk membuat beberapa shipment sekaligus dari PSS/CD yang dipilih
- Field: Trip ID (auto-generate, read-only), Vendor (dari tabel `vendors`), No. Polisi Kendaraan (wajib), Tipe Kendaraan (dropdown), Nama Driver (wajib), Rute (opsional), Status Awal
- **Trip ID format**: `TRIP-YYMM-0001` (4 digit, per bulan) — contoh `TRIP-2609-0001`
- Trip ID di-generate via Server Action `generateTripId()` yang query `shipment_tracking` secara numerik (bukan lexicographic) untuk menghindari duplikasi
- Info vendor, nopol, tipe kendaraan, nama driver disimpan di kolom `notes` format: `Vendor: X | Nopol: Y | Tipe: Z | Driver: W`
- Untuk PSS: set `source_type='PSS'`, `pss_no`, `outbound_header_id`
- Untuk Crossdocking: set `source_type='Crossdocking'`, `crossdocking_id`

### 12.4 Shipment Tracking — Tab "Tracking"

**Status: ✅ Diimplementasikan (update)**

- Kolom **OTD** dihapus dari tabel tracking (tetap tersedia di halaman Shipment Cost)
- Kolom **Biaya (Rp)** dihapus dari tabel tracking (dipindah ke halaman Shipment Cost)
- Tab utama menggunakan **For Transport Planning** untuk PSS yang belum dibuatkan Shipment dan **List Outbound Deliveries** untuk daftar Shipment yang sudah dibuat.
- Header Shipment Tracking tetap, sedangkan hanya isi tabel yang memiliki scroll; status card dan filter status terpisah tidak digunakan pada tampilan saat ini.
- Klik baris mana saja (termasuk Draft/Dispatched) membuka panel edit — sebelumnya Draft/Dispatched hanya toggle checkbox
- Checkbox tetap berfungsi untuk assign trip multi-drop (dengan `stopPropagation`)
- Hapus shipment otomatis hapus POD terkait terlebih dahulu (menghindari FK constraint)
- Dropdown PSS di form tambah shipment hanya menampilkan PSS yang **belum** punya tracking

### 12.5 Halaman Shipment Cost (`/shipment-cost`)

**Status: ✅ Baru diimplementasikan**

- Menu baru di sidebar: **Shipment Cost** (icon DollarSign) — posisi antara Shipment dan Receiving
- **4 KPI cards**: Total Shipment, Total Biaya, Invoice Value Eksternal, Avg Cost Ratio
- **Breakdown** per Model Transporter (Internal/Retail/Trucking) dan per DK/LK
- **Tabel detail** per shipment:
  - Trip ID, PSS/CD No, Customer, DK/LK, Transporter (dari master atau `notes`), Model
  - No. Voucher (Internal) / No. Invoice Eksternal
  - Komponen biaya Internal: BBM, Bongkar Muat, Hotel, Uang Makan, Tol, Parkir, Kirim Paket
  - Total Biaya, Invoice Value Eksternal, Cost Ratio badge (hijau/kuning/merah), OTD, Status
  - Model Internal hanya menampilkan komponen biaya operasional dan tidak menggunakan Invoice Value/Cost Ratio
- Warning bar jika ada shipment belum diisi biaya
- Baris highlight kuning untuk shipment tanpa biaya

### 12.6 Master Routes

**Status: ✅ Diimplementasikan (update)**

- Kolom **Risk Level** dihapus dari form dan tabel (tidak relevan operasional)
- Kolom **City** dihapus dari form (redundant dengan Destination) — nilai `city` otomatis diisi sama dengan `destination` untuk kompatibilitas DB
- Field **Route Code** read-only saat edit (tidak bisa diubah setelah dibuat)
- Placeholder Route Code: `MDN-L-0001` (format target: `MDN-L/D-XXXX`)
- Semua operasi tulis/hapus via Server Action (`supabaseAdmin`) — sebelumnya pakai client `supabase`
- Hapus route otomatis null-kan FK di `shipment_tracking.route_id`

### 12.7 Perubahan Sidebar & Navigasi

**Status: ✅ Diimplementasikan**

- **Warehouse Checklist** dihapus dari sidebar dan halaman (tidak diperlukan saat ini)
- **Shipment Cost** ditambahkan antara Shipment dan Receiving
- Sidebar saat ini: Dashboard → Workflow → Shipment → Shipment Cost → Receiving → Outbound → Crossdocking → Inventory → Issue Log → Master → Settings

### 12.8 Receiving / Inbound Upload Fix

**Status: ✅ Diimplementasikan**

- File Excel dari NAV memiliki 1-2 baris judul (e.g. "Posted Transfer Receipts" / "Sheet1") sebelum baris header kolom
- Ditambahkan fungsi `parseNavExcel()` yang otomatis mendeteksi posisi baris header aktual dengan mencari kata kunci: `no.`, `posting date`, `document no.`, `entry no.`, dst.
- `toNumber()` diperbaiki untuk handle angka dengan koma ribuan (e.g. `3,120` → `3120`)
- Alias kolom diperluas untuk `Entry No.` (NAV style dengan titik → `entry_no_` setelah normalisasi)
- Fix berlaku untuk PTR Header upload, PTR Detail upload, dan default ReceivingUploadButton

### 12.9 Dashboard Open Issues Fix

**Status: ✅ Diimplementasikan**

- KPI card "Open Issues" sekarang hanya menghitung status `Open` dan `In Progress` (bukan semua issue)
- Label berubah dari "Masalah operasional" → "Open & In Progress"
- Query `openIssues` diperbaiki dari `'open'/'in_progress'` (huruf kecil) ke `'Open'/'In Progress'` (kapital sesuai data aktual)
- Badge status di panel bawah: Open = biru, In Progress = kuning

### 12.10 Data Dummy

- Semua data dummy di `shipment_tracking` dihapus (tabel bersih untuk data live)
- SQL hapus data dummy issue:
  ```sql
  DELETE FROM issue_log WHERE issue_no LIKE 'ISS-DUMMY-%';
  -- Insert ulang dengan format baru ISS-2609-XXXX jika diperlukan
  ```

### 12.11 File Dokumentasi Dihapus

File berikut dihapus dan kontennya diarsipkan ke **PRD section 11**:
- `top.md` → PRD 11.1 (Customer Stock Map setup notes)
- `WORKFLOW-SCM-MAP.md` → PRD 11.2 (Workflow customer map log)
- `DUMMY_DATA_LOG.md` → PRD 11.3 (Log data dummy + SQL hapus)
- `build.md` → dihapus tanpa backup (brainstorming obsolete)


---

## 11. Archived Documentation

### 11.1 Customer Stock Map — Setup Notes (dari top.md)

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

Angka-angka ini contoh awal — sesuaikan dengan cycle time riil produk (bisa dari histori order rata-rata per customer, bukan angka tetap).

## 6. Kenapa pakai `CircleMarker`, bukan pin/marker biasa
Radius lingkaran mengikuti `sqrt(machineCount)`, jadi ukuran titik di peta langsung merepresentasikan besar-kecilnya customer tanpa perlu buka popup. Ini juga menghindari isu klasik Leaflet di Next/Webpack di mana ikon marker default sering tidak muncul (path asset-nya patah saat bundling).

## 7. Warna & style
Semua warna diambil langsung dari token yang sudah ada di `tailwind.config.ts` (`canvas`, `surface`, `border`, `text`, `muted`, `blue`, `green`, `orange`, `red`), jadi tampilannya otomatis konsisten dengan bagian lain aplikasi.

---

### 11.2 Workflow SCM Control Tower - Customer Map (dari WORKFLOW-SCM-MAP.md)

Dokumen ini adalah catatan kerja bertahap untuk fitur peta customer rumah sakit dan keputusan replenishment.

**Status saat diarsipkan:**
- Tahap aktif: 2 - Customer master dan peta awal
- Status: map publik dan maintain tersembunyi sudah diimplementasikan; pembatasan admin ditunda
- Tanggal pencatatan: 2026-08-29
- Halaman target: `app/(app)/dashboard/page.tsx`
- Referensi struktur data: `data/Monitoring Stock HD Rumah Sakit.xlsx`
- Source of truth aplikasi: Supabase

#### Tahap 1 - Validasi sumber data (Selesai)

- Workbook memiliki satu sheet: `Dashboard`.
- Terdapat 26 baris customer pada contoh Excel; batas aplikasi ditetapkan maksimal 27 customer unik dari Supabase.
- Semua 26 customer memiliki nama, lokasi kabupaten/kota, jumlah mesin HD, dan nilai stok.
- 23 customer memiliki nilai pada kolom `FU-PO`.
- Kolom yang terbaca dari header Excel: `NAMA CUSTOMER/ RUMAH SAKIT`, `KABUPATEN/KOTA`, `Jumlah Mesin HD`, `Estimasi`, `Kebutuhan`, `Safety Stok`, `ROP`, `Stok Akhir`, `Pengiriman`, `Estimasi Stok`, `DOI`, `HABIS`, `Available`, `FU-PO`
- Lokasi mencakup Sumatera Utara dan Aceh: Medan, Rantau Prapat, Pematang Siantar, Banda Aceh, Takengon, Aceh Tamiang, Pidi - Aceh, Langsa - Aceh.

**Keputusan:**
- Peta diintegrasikan ke dashboard Pareto customer stock, bukan landing page.
- Implementasi menggunakan Leaflet + tile provider OpenStreetMap.
- Excel hanya digunakan untuk memahami struktur field; aplikasi tidak membaca Excel saat runtime.
- Data operasional dipelihara di tabel Supabase `customers`.
- Dashboard memakai subscription Supabase Realtime (INSERT, UPDATE, DELETE).
- Policy Supabase sementara membuka CRUD untuk `anon` dan `authenticated` — perlu diperketat pada tahap hardening.
- Tombol maintain tersembunyi dengan kombinasi `Ctrl + Shift + M`.

#### Schema Supabase
Schema awal tersedia di `supabase/customer-map.sql`, termasuk validasi koordinat, trigger `updated_at`, RLS, dan publication Realtime.

#### Checklist yang belum selesai saat diarsipkan
- [ ] Tambahkan koordinat yang sudah tervalidasi untuk semua customer
- [ ] Tambahkan konfigurasi lead time per customer
- [ ] Implementasikan perhitungan DOI, tanggal stockout, dan status replenishment
- [ ] Kembalikan policy CRUD menjadi admin-only setelah sistem operasional stabil
- [ ] Hubungkan halaman login ke Supabase Auth untuk tahap hardening akses

---

### 11.3 Log Data Dummy — SCM Control Tower (dari DUMMY_DATA_LOG.md)

**Tanggal dibuat:** 30 Agustus 2026 — **Update terakhir:** 31 Agustus 2026 01:45 WIB  
**Status:** ACTIVE — DUMMY APPROVED OLEH ERWIN (31 Agu 2026) — tetap digunakan sampai go-live  
**Supabase project:** `elwzpofgxgauyssatga` | **Repo:** `srumedan-del/scm-tower`

> ⚠️ Data di bawah ini **BUKAN data produksi.** Semua entry bertanda `DUMMY APPROVED` adalah dummy yang di-generate atas izin Erwin.

#### Ringkasan Counts (31 Agu 2026)

| Tabel Supabase | Total | Dummy | Real | Keterangan |
|---|---|---|---|---|
| `vendors` | 3 | 1 (`VOTH_INDAH`) | 2 (VOTH001801 RSA, VOTH000095 ASSA) | VOTH_ASSA/RSA sudah tidak dipakai |
| `customers` | 74 | 0 | 74 | 42 DK + 32 LK, 5 lokasi terisi |
| `master_sku` | 90 | 0 | 90 | Sheet3 ERP (NHD 66 HD 22) |
| `transport_fleet` | 8 | 8 | 0 | BK 1234 AA–BK 1122 HH |
| `transport_rate_card` | 236 | 15 (`BIA-DUMMY-0001..0015`) | 221 (`BIA-EKS-2137..`) | |
| `shipments` | 8 | 8 | 0 | SHP-2026-08-001..008 |
| `shipment_status_logs` | 9 | 9 | 0 | Auto-log tiap ganti status |
| `issue_log` | 8 | 8 | 0 | ISS-DUMMY-2026-001..008 |
| `warehouse_checklist` | 7 | 7 | 0 | SRU-MDN 25–29 Agu + MDN-PAR9C/PAR9F 30 Agu |
| `receiving_header` | 104 | 4 | 100 | PTR-2026-08-25..29 dummy + 100 ERP |
| `outbound_detail` | 4693 | 0 | 4693 | Real ERP PSS-2601..2608 |
| `routes` | 12 | 0 | 12 | MDN-BDA-STD dst |
| `warehouses` | 2 | 0 | 2 | MDN-PAR9C/9F |

#### SQL untuk Hapus Data Dummy

```sql
-- Rate card dummy
DELETE FROM transport_rate_card WHERE rate_code LIKE 'BIA-DUMMY-%';
-- Shipments dummy
DELETE FROM shipments WHERE shipment_no LIKE 'SHP-2026-08-%';
-- Logs dummy
DELETE FROM shipment_status_logs WHERE notes LIKE 'DUMMY%';
-- Fleet dummy
DELETE FROM transport_fleet WHERE vehicle_no IN ('BK 1234 AA','BK 5678 BB','BK 9012 CC','BK 3456 DD','BK 7890 EE','BK 2345 FF','BK 6789 GG','BK 1122 HH');
-- Issue dummy
DELETE FROM issue_log WHERE issue_no LIKE 'ISS-DUMMY-%';
-- Checklist dummy
DELETE FROM warehouse_checklist WHERE checklist_date BETWEEN '2026-08-25' AND '2026-08-30';
-- Vendor dummy
DELETE FROM vendors WHERE vendor_code = 'VOTH_INDAH';
-- Receiving dummy
DELETE FROM receiving_header WHERE ptr_no LIKE 'PTR-2026-08-%';
```

#### File Script
- `scripts/seed_dummy_approved.py` — FINAL (shipments valid enum, fleet, issue, checklist, logs) — approved run 30–31 Agu
- `scripts/seed_dummy.py`, `seed_v2.py`, `seed_v3.py`, `test_*.py`, `brute_pod.py` — eksperimen constraint (history)
- `scripts/add_group_to_master_sku.sql` — manual ALTER GROUP

#### Sign-off
- Erwin approve: "kamu buatkan saja data dummy, saya approve" (31 Agu 2026)
- Semua string UPPERCASE sesuai konvensi scm-tower.
- Phone dummy 081234567801..08 — bukan nomor asli, jangan dipakai operasional.
