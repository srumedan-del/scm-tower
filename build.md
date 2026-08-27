# Struktur One-Page Rolling SCM Control Tower

## 1. Top Page — Pareto Customer Stock Monitor

Ini sudah tepat untuk halaman pertama.

Tujuannya: memberi sinyal cepat pelanggan utama mana yang butuh perhatian.

Isi yang disarankan:

### KPI cards utama

- Total pelanggan Pareto
- Pelanggan dengan stok aman
- Pelanggan dengan stok warning
- Pelanggan dengan stok critical
- Estimasi hari coverage stok
- SKU critical terbanyak
- Potensi lost sales / service risk

### Visual utama

- **Pareto Customer Stock Health**
    - customer A, B, C, D
    - status: Safe / Warning / Critical
    - stock coverage days
    - top SKU risk

### Tabel prioritas

| Customer | SKU Critical | Stock Coverage | Avg Demand | Status | Action |
| --- | --- | --- | --- | --- | --- |
| Customer A | 8 | 3 hari | tinggi | Critical | Replenish |
| Customer B | 4 | 6 hari | sedang | Warning | Monitor |
| Customer C | 0 | 14 hari | tinggi | Safe | Normal |

### Tombol aksi

- View customer stock
- Create replenishment plan
- Check outbound status
- Check pending shipment

**Kenapa ini paling cocok jadi top page?**  

Karena ini langsung menghubungkan inventory, demand, outbound, dan customer service.

---

## 2. Demand & Forecast Signal

Setelah melihat stok Pareto, user perlu tahu apakah demand sedang naik/turun.

Tujuannya: membaca pola permintaan pelanggan.

Isi:

- Demand 7 hari terakhir
- Demand 30 hari terakhir
- Top moving SKU
- SKU dengan demand naik
- SKU dengan demand turun
- Forecast kebutuhan 1–4 minggu

KPI:

- Total demand bulan berjalan
- Growth vs bulan lalu
- Fast moving SKU
- Unusual demand spike
- Forecast risk

Visual:

- Line chart demand harian
- Bar chart top SKU
- Customer demand ranking

Action:

- Review forecast
- Update demand assumption
- Export demand plan

---

## 3. Inventory Control

Setelah demand, masuk ke stok internal.

Tujuannya: melihat apakah gudang punya stok cukup untuk melayani pelanggan Pareto.

Isi:

- Stock on hand
- Available stock
- Reserved stock
- Safety stock
- Low stock
- Overstock
- Slow moving
- Dead stock

KPI:

- Total SKU
- Low stock item
- Overstock item
- Slow moving item
- Stock accuracy
- Inventory aging

Visual:

- Inventory health by SKU category
- Stock coverage by warehouse
- Aging stock bucket

Action:

- Update stock snapshot
- Create adjustment
- View stock movement
- Review aging stock

---

## 4. Inbound / Receiving Control

Setelah melihat stok, kita perlu tahu pasokan yang sedang masuk.

Tujuannya: memantau barang masuk yang bisa menutup risiko kekurangan stok.

Isi:

- Receiving hari ini
- Pending receiving
- Pending posting
- Receiving delay
- Discrepancy
- Damage / shortage
- Incoming SKU critical

KPI:

- Total receiving
- Pending posting
- Avg receipt-to-posting days
- Discrepancy rate
- Damage rate
- Critical SKU incoming

Visual:

- Receiving trend
- Pending posting list
- Incoming stock by SKU

Action:

- Input receiving
- Validate discrepancy
- Post receiving
- Check inbound document

---

## 5. Outbound Fulfillment

Setelah stok dan inbound, masuk ke kemampuan memenuhi order.

Tujuannya: melihat order/customer mana yang belum terpenuhi.

Isi:

- Outbound hari ini
- Pending outbound
- Picking status
- Packing status
- Loading status
- Dispatch status
- Backorder
- Late dispatch

KPI:

- Fulfillment rate
- Pending outbound
- On-time dispatch
- Picking accuracy
- Backorder quantity
- Dispatch lead time

Visual:

- Outbound pipeline
- Order aging
- Pending by customer
- Pending by SKU

Action:

- Create outbound
- Update picking
- Update dispatch
- View pending order

---

## 6. Shipment Tracking & POD Control

Setelah outbound, user harus tahu apakah barang sudah sampai.

Tujuannya: memastikan pengiriman berjalan sampai customer menerima barang.

Isi:

- Shipment hari ini
- In transit
- Delayed shipment
- Delivered
- POD pending
- POD rejected
- SLA breach
- Delay reason

KPI:

- On-time delivery %
- Average delivery lead time
- Delayed shipment
- Pending POD
- SLA compliance
- Shipment aging

Visual:

- Shipment map/list
- Shipment status funnel
- Vendor delay ranking
- POD aging

Action:

- Update shipment status
- Upload POD
- Follow up delayed shipment
- Contact vendor

---

## 7. Vendor Performance

Setelah shipment, penting melihat vendor mana yang menjadi bottleneck.

Tujuannya: menilai performa transport/vendor secara objektif.

Isi:

- Vendor aktif
- Shipment per vendor
- On-time rate
- Average delay
- POD completion
- Issue count
- Cost per shipment/rute

KPI:

- Vendor score
- SLA compliance
- POD completion rate
- Delay count
- Average delay days
- Cost variance

Visual:

- Vendor ranking
- Vendor performance matrix
- Delay reason by vendor
- Rate card overview

Action:

- Review vendor
- Update SLA
- Update rate card
- Log vendor issue

---

## 8. Warehouse Readiness

Ini untuk kesiapan operasional gudang.

Tujuannya: memastikan warehouse siap menerima, picking, packing, loading, dan dispatch.

Isi:

- Checklist completion
- Dock availability
- Forklift readiness
- Pallet availability
- Staging status
- Manpower availability
- Warehouse issue

KPI:

- Checklist completion rate
- Open warehouse issue
- Dock utilization
- Equipment readiness
- Manpower productivity
- Loading readiness

Visual:

- Daily checklist status
- Warehouse readiness score
- Issue by area

Action:

- Fill checklist
- Report issue
- Update dock schedule
- Update manpower plan

---

## 9. Risk & Exception Control

Ini halaman penting untuk ruang kendali.

Tujuannya: mengumpulkan semua masalah penting lintas area.

Isi:

- Stockout risk
- Late inbound
- Pending outbound aging
- Delayed shipment
- POD overdue
- Vendor issue
- Warehouse issue
- Data quality issue

KPI:

- Open issue
- Critical issue
- Issue aging
- Closed this week
- SLA breach count
- Unassigned issue

Visual:

- Risk heatmap
- Issue aging table
- Exception list
- Mitigation progress

Action:

- Create issue
- Assign owner
- Update mitigation
- Close issue

---

## 10. Executive Summary / Daily Command Brief

Ini sebaiknya menjadi bagian akhir one-page rolling.

Tujuannya: memberikan ringkasan keputusan harian.

Isi:

- Apa kondisi hari ini?
- Apa yang critical?
- Apa yang harus dikerjakan dulu?
- Siapa owner-nya?
- Deadline follow up?
- Apa risiko jika tidak ditindak?

Format ideal:

```
Hari ini supply risk meningkat pada 3 pelanggan Pareto karena 8 SKU berada di bawah safety stock.
Prioritas utama adalah replenishment SKU fast moving, percepat receiving pending, dan follow up 5 shipment delayed.
```

Tabel action:

| Priority | Action | Owner | Due | Status |
| --- | --- | --- | --- | --- |
| P1 | Replenish SKU critical Customer A | Warehouse | Today | Open |
| P1 | Follow up shipment delayed | Transport | Today | Open |
| P2 | Clear pending receiving | Inbound | Tomorrow | In Progress |

Action:

- Generate daily report
- Export PDF
- Send daily summary
- Open action list

---

# Struktur Final One-Page Rolling yang Saya Rekomendasikan

Urutan terbaik:

```
1. Pareto Customer Stock Monitor
2. Demand & Forecast Signal
3. Inventory Control
4. Inbound / Receiving Control
5. Outbound Fulfillment
6. Shipment Tracking & POD Control
7. Vendor Performance
8. Warehouse Readiness
9. Risk & Exception Control
10. Executive Summary / Daily Command Brief
```

Ini lebih kuat dibanding hanya menampilkan 7 area fungsi secara datar, karena urutannya mengikuti alur supply chain nyata:

```
Customer demand
→ stock position
→ inbound supply
→ outbound fulfillment
→ shipment delivery
→ vendor performance
→ warehouse readiness
→ risk control
→ management action
```

---

# Bagaimana 7 Area Fungsi Tetap Masuk?

Konsep 7 area fungsi tetap bisa menjadi fondasi, tapi tampilan landing page sebaiknya berbasis **control flow**, bukan hanya kategori.

Mapping-nya:

| One-page Section | Area Fungsi |
| --- | --- |
| Pareto Customer Stock Monitor | Strategy & Planning + Inventory |
| Demand & Forecast Signal | Strategy & Planning |
| Inventory Control | Inventory Management |
| Inbound / Receiving Control | Warehouse Management + Procurement |
| Outbound Fulfillment | Warehouse Management + Logistics |
| Shipment Tracking & POD Control | Logistics & Distribution |
| Vendor Performance | Vendor Management |
| Warehouse Readiness | Warehouse Management |
| Risk & Exception Control | Risk Management |
| Executive Summary | Dashboards / Strategy |

---

# Prioritas yang Harus Dikerjakan Dulu

Untuk awal, jangan kerjakan semua section sekaligus. Fokus ke **data yang paling menentukan keputusan harian**.

## Prioritas 1 — Pareto Customer Stock Monitor

Ini harus jadi prioritas pertama karena sudah menjadi top page.

Minimum data yang dibutuhkan:

| Data | Sumber |
| --- | --- |
| Customer Pareto | customer master / outbound history |
| SKU per customer | outbound history |
| Avg demand | outbound detail |
| Stock available | inventory snapshot |
| Safety stock | master SKU |
| Coverage days | calculation |
| Risk status | calculation |

Output MVP:

- daftar customer Pareto
- daftar SKU critical per customer
- available stock
- average daily demand
- coverage days
- status Safe / Warning / Critical
- recommended action

Formula awal:

```
Coverage Days = Available Stock / Average Daily Demand
```

Status:

```
Critical = coverage <= 3 hari
Warning = coverage > 3 dan <= 7 hari
Safe = coverage > 7 hari
```

---

## Prioritas 2 — Inventory Snapshot

Tanpa inventory snapshot, dashboard Pareto tidak akan kuat.

Yang harus dibuat:

- form input/update stok
- upload/import stock snapshot
- table inventory per SKU/warehouse
- safety stock
- available stock
- low stock alert

Minimum table:

```
master_sku
inventory_snapshot
inventory_movement
warehouses
```

---

## Prioritas 3 — Outbound History untuk Demand

Dashboard Pareto butuh demand historis.

Karena data outbound sudah ada, gunakan dulu untuk:

- rata-rata demand per SKU
- top customer
- top SKU
- demand 30/60/90 hari
- Pareto customer

Minimum calculation:

```
Avg Daily Demand = Total Qty Out 30 Hari / 30
```

Untuk awal, tidak perlu forecasting rumit. Pakai moving average dulu.

---

## Prioritas 4 — Shipment Tracking

Setelah tahu customer dan SKU risk, kita perlu tahu barang yang sudah dikirim tapi belum sampai.

Yang harus ditampilkan:

- shipment in transit
- delayed
- ETA
- actual arrival
- POD status
- vendor
- route
- customer

Ini akan menjawab:

> “Stok customer critical karena belum dikirim, sedang dikirim, atau memang belum tersedia?”
> 

---

## Prioritas 5 — Risk & Action List

Ruang kendali harus menghasilkan tindakan.

Jangan hanya dashboard.

Minimal harus ada:

- action item
- owner
- due date
- status
- priority
- related customer/SKU/shipment

Contoh action:

```
P1 - Customer A SKU X coverage 2 hari, segera replenish 120 pcs hari ini.
```

---

# Prioritas Eksekusi 2 Minggu Pertama

## Minggu 1 — Fokus Top Page Pareto Stock

Kerjakan:

1. Buat layout final top page.
2. Buat tabel/section Pareto Customer Stock Health.
3. Buat query demand dari outbound history.
4. Buat atau rapikan inventory snapshot.
5. Buat formula coverage days.
6. Buat status Safe / Warning / Critical.
7. Buat recommended action sederhana.

Deliverable:

```
Top page sudah bisa menunjukkan customer/SKU mana yang critical.
```

---

## Minggu 2 — Inventory + Action Control

Kerjakan:

1. Buat halaman maintain inventory snapshot.
2. Buat input/update safety stock.
3. Buat issue/action list.
4. Buat tombol “Create Action” dari SKU critical.
5. Buat ringkasan harian:
    - critical customer
    - critical SKU
    - pending shipment
    - open issue

Deliverable:

```
Dashboard bukan hanya lihat kondisi, tapi bisa langsung menghasilkan follow up.
```

---

# Prioritas Teknis Pertama

Secara teknis, urutan kerjanya:

## 1. Buat Supabase view untuk Pareto Stock

Contoh view yang perlu dibuat:

```
vw_pareto_customer_stock_health
```

Isi kolom:

```
customer_code
customer_name
sku_code
item_name
avg_daily_demand
available_qty
safety_stock
coverage_days
risk_status
recommended_action
```

## 2. Sambungkan top page ke Supabase

Landing top page jangan pakai angka dummy lagi.

Ambil data dari:

```
vw_pareto_customer_stock_health
```

## 3. Buat UI top page final

Komponen:

- `ParetoStockHero`
- `StockHealthCards`
- `CustomerRiskTable`
- `CriticalSkuPanel`
- `RecommendedActionPanel`

## 4. Buat route maintain

Minimal:

```
/inventory
/issues
/shipments
```

## 5. Baru lanjut section lain

Setelah top page kuat, baru lanjut section:

- Demand
- Inventory
- Shipment
- Vendor
- Risk

---

# MVP One-Page Versi Awal

Kalau ingin versi paling realistis dan cepat, buat dulu 5 section saja:

```
1. Pareto Customer Stock Monitor
2. Inventory Control
3. Outbound Fulfillment
4. Shipment Tracking
5. Risk & Action Control
```

Kenapa tidak langsung 10 section?

Karena 5 section ini sudah menjawab pertanyaan harian paling penting:

1. Customer mana yang berisiko?
2. SKU mana yang kurang?
3. Apakah order bisa dipenuhi?
4. Apakah barang sudah dikirim/sampai?
5. Apa tindakan hari ini?

Setelah ini stabil, baru tambahkan:

```
6. Vendor Performance
7. Warehouse Readiness
8. Demand & Forecast
9. Receiving / Inbound
10. Executive Summary
```

---

# Rekomendasi Final dari Saya

Untuk sasaran **Ruang Kendali Supply Chain**, saya sarankan Erwin jangan membuat landing page hanya sebagai tampilan promosi. Jadikan landing page sebagai:

> **Operational cockpit untuk membaca risiko dan menentukan tindakan harian.**
> 

Prioritas pertama:

```
Pareto Customer Stock Monitor
```

Prioritas kedua:

```
Inventory Snapshot + Coverage Days
```

Prioritas ketiga:

```
Outbound Demand History
```

Prioritas keempat:

```
Shipment Tracking
```

Prioritas kelima:

```
Risk & Action List
```

Kalau lima ini selesai, ruang kendali supply chain sudah mulai “hidup” dan bisa dipakai untuk keputusan harian, bukan hanya tampilan dashboard.