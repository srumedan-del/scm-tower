# 📝 Log Data Dummy — SCM Control Tower

**Tanggal dibuat:** 30 Agustus 2026 — **Update terakhir:** 31 Agustus 2026 01:45 WIB
**Dibuat oleh:** Cal (Hermes Agent)
**Tujuan:** Visualisasi workflow SCM untuk testing UI development
**Status:** **ACTIVE — DUMMY APPROVED OLEH ERWIN (31 Agu 2026) — tetap digunakan sampai go-live**
**Supabase project:** `elwzpofgxgauyssatga` | **Repo:** `srumedan-del/scm-tower` (branch `main` — pushed `1fab3e2` + update ini)

> ⚠️ Data di bawah ini **BUKAN data produksi.** Semua entry bertanda `DUMMY APPROVED` adalah dummy yang di-generate atas izin Erwin. Konfirmasi ulang sebelum dipakai untuk reporting ke client.

---

## Ringkasan Counts (31 Agu 2026)

| Tabel Supabase | Total | Dummy | Real | Keterangan |
|---|---|---|---|---|
| `vendors` | 3 | 1 (`VOTH_INDAH`) | 2 (VOTH001801 RSA, VOTH000095 ASSA) | VOTH_ASSA/RSA sudah tidak dipakai, hanya INDAH LOGISTIK dummy yang survive |
| `customers` | 74 | 0 | 74 | 42 DK + 32 LK, 5 lokasi terisi, field `MESIN HD` + `LOKASI` maps |
| `master_sku` | 90 | 0 | 90 | Sheet3 ERP (NHD 66 HD 22), GROUP, `safety_stock` NULL |
| `transport_fleet` | 8 | 8 | 0 | BK 1234 AA–BK 1122 HH, 8 armada dummy |
| `transport_rate_card` | 236 | 15 (`BIA-DUMMY-0001..0015`) | 221 (`BIA-EKS-2137..`) | Semua `per_trip` UPPERCASE, `aktif`, vendor RSA/ASSA/INDAH |
| `shipments` | 8 | 8 | 0 | SHP-2026-08-001..008 — valid enum `Draft/Dispatched/In Transit/Arrived/Completed/Delayed/Cancelled` |
| `shipment_status_logs` | 9 | 9 | 0 | Auto-log tiap ganti status via ShipmentEditPanel |
| `issue_log` | 8 | 8 | 0 | ISS-DUMMY-2026-001..008 — 8 kategori valid |
| `warehouse_checklist` | 7 | 7 | 0 | SRU-MDN 25–29 Agu + MDN-PAR9C/PAR9F 30 Agu |
| `receiving_header` | 104 | 4 | 100 | PTR-2026-08-25..29 dummy + 100 ERP |
| `outbound_detail` | 4693 | 0 | 4693 | Real ERP PSS-2601..2608 |
| `routes` | 12 | 0 | 12 | MDN-BDA-STD dst |
| `warehouses` | 2 | 0 | 2 | MDN-PAR9C/9F |

**Notion workspace (Erwin — erwin.sapta@live.com):**

| Database | ID (short) | Count | Status |
|---|---|---|---|
| Shipment Tracking Database | `9ea3c94c` / db `01ac23dd` | 8 | Dummy — mapped vendor RSA/ASSA/INDAH via relation |
| Outbound Data Collection | `486ac89f` / db `61b9b0cd` | 8 | Dummy aggregated PSS-2608-* |
| Transport Vendor Database | `aae87fa0` | 5 | Existing + dummy |
| Issue Log — SCM Tower (Dummy) | `5a1e19c4` / ds `176f0089` | 8 | **Baru 31 Agu** — dimirror dari `issue_log` |
| Warehouse Checklist — SCM Tower (Dummy) | `b248dd65` / ds `ed8cee79` | 7 | **Baru 31 Agu** — dimirror dari `warehouse_checklist` |
| To-dos | `49af93e2` | 18 | 6 marked **Done** (rate card, shipment, armada, vendor, checklist, review POD) |
| SCM Templates & Dashboards | `e9d98c41` | 34 | — |

---

## 1. `transport_rate_card` — 15 dummy (UPPERCASE)

**Constraint valid:** `tariff_model` hanya `per_trip` (coba `per_kg/per_cbm/per_ton` ditolak `transport_rate_card_uom_check`), `shipping_model=trucking`, `status=aktif`, `category=CAB-CUST`.

| rate_code | origin → destination | vehicle | ton/cbm | price | service_name | lead |
|---|---|---|---|---|---|---|
| BIA-DUMMY-0001 | MEDAN→BINJAI | CDD | 4/15 | 1.850.000 | DUMMY TRUCKING 4 TON 15 CBM R6 TUJUAN MEDAN (retry per_trip) | 1 |
| BIA-DUMMY-0002 | MEDAN→BINJAI | CDE | 6/18 | 2.100.000 | DUMMY TRUCKING 6 TON 18 CBM CDE MEDAN-BINJAI | 1 |
| BIA-DUMMY-0003 | MEDAN→PEMATANG SIANTAR | CDD | 4/15 | 1.850.000 | DUMMY CDD MEDAN-PEMATANG SIANTAR | 1 |
| BIA-DUMMY-0004 | MEDAN→TEBING TINGGI | CDD | 4/15 | 1.650.000 | DUMMY MEDAN-TEBING TINGGI | 1 |
| BIA-DUMMY-0005 | MEDAN→KISARAN | CDD | 4/15 | 1.950.000 | DUMMY MEDAN-KISARAN | 1 |
| BIA-DUMMY-0006 | MEDAN→SIBOLGA | TRONTON | 15/40 | 5.500.000 | DUMMY 15 TON TRONTON MEDAN-SIBOLGA | 2 |
| BIA-DUMMY-0007 | MEDAN→PADANG SIDEMPUAN | FUSO | 10/30 | 4.800.000 | DUMMY 10 TON FUSO | 2 |
| BIA-DUMMY-0008 | MEDAN→LHOKSEUMAWE | BOX | 4/15 | 4.200.000 | DUMMY BOX MEDAN-LHOKSEUMAWE | 2 |
| BIA-DUMMY-0009 | MEDAN→LANGSA | PICKUP | 1/5 | 2.800.000 | DUMMY PICKUP 1.5 TON | 1 |
| BIA-DUMMY-0010 | MEDAN→BANDA ACEH | FUSO | 10/30 | 7.200.000 | DUMMY FUSO MEDAN-BANDA ACEH | 2 |
| BIA-DUMMY-0011 | BINJAI→BANDA ACEH | CDD | 4/15 | 5.800.000 | DUMMY CDD BINJAI-BANDA ACEH | 2 |
| BIA-DUMMY-0012 | MEDAN→MEULABOH | CDD | 4/15 | 6.200.000 | DUMMY | 2 |
| BIA-DUMMY-0013 | MEDAN→KUTACANE | CDE | 6/18 | 4.500.000 | DUMMY CDE | 2 |
| BIA-DUMMY-0014 | MEDAN→TAKENGON | CDD | 4/15 | 5.200.000 | DUMMY | 2 |
| BIA-DUMMY-0015 | MEDAN→SABANG | CDD | 4/15 | 8.500.000 | DUMMY VIA FERRY | 3 |

Identifikasi: `rate_code LIKE 'BIA-DUMMY-%'` + `notes LIKE 'DUMMY APPROVED%'`.

## 2. `shipments` + `shipment_status_logs` — 8 shipment (UPPERCASE, valid enum)

**Enum valid (coba brute force):** `status ∈ {Draft, In Transit, Delayed, Cancelled, Dispatched, Completed, Arrived}`, `sla_status ∈ {On Time, Late, Pending}`, `pod_status ∈ {Pending, Missing}`.

| shipment_no | tanggal | destination | vendor | vehicle | status | sla | pod | eta | notes |
|---|---|---|---|---|---|---|---|---|
| SHP-2026-08-001 | 2026-08-25 | BANDA ACEH — RSUD ZAINOEL ABIDIN | PT. RIANG SARANA ARTHA | BK 1234 AA | Dispatched | On Time | Pending | 2026-08-27 | DUMMY APPROVED — MEDAN-BANDA ACEH R6 |
| SHP-2026-08-002 | 2026-08-26 | LHOKSEUMAWE — RS ARUN | PT. ADI SARANA ARMADA TBK - MEDAN | BK 5678 BB | In Transit | On Time | Pending | 2026-08-28 | DUMMY — MEDAN-LHOKSEUMAWE |
| SHP-2026-08-003 | 2026-08-27 | PEMATANG SIANTAR | INDAH LOGISTIK | BK 9012 CC | Arrived | Late | Pending | 2026-08-29 | TERLAMBAT 1 HARI KARENA HUJAN |
| SHP-2026-08-004 | 2026-08-28 | MEDAN — RSUP H ADAM MALIK | PT. RIANG SARANA ARTHA | BK 3456 DD | Completed | On Time | Missing | 2026-08-30 | POD HILANG |
| SHP-2026-08-005 | 2026-08-29 | TEBING TINGGI | PT. RIANG SARANA ARTHA | BK 7890 EE | Draft | Pending | Pending | 2026-08-31 | DRAFT BELUM DISPATCH |
| SHP-2026-08-006 | 2026-08-30 | KISARAN | PT. ADI SARANA ARMADA TBK - MEDAN | BK 2345 FF | Delayed | Late | Pending | 2026-08-30 | JALAN LONGSOR |
| SHP-2026-08-007 | 2026-08-30 | SIBOLGA | INDAH LOGISTIK | BK 6789 GG | Cancelled | Pending | Missing | 2026-09-01 | CANCELLED CUSTOMER REQUEST |
| SHP-2026-08-008 | 2026-08-30 | PADANG SIDEMPUAN | PT. RIANG SARANA ARTHA | BK 1122 HH | In Transit | On Time | Pending | 2026-08-31 | ON TIME |

**`shipment_status_logs` 9 rows:** tiap shipment 1 log `Draft→current` (`DUMMY LOG`) + auto-log via UI `STATUS UPDATE VIA UI` saat ganti status di `ShipmentEditPanel` (baru: tampil di modal `RIWAYAT STATUS`).

## 3. `transport_fleet` — 8 armada

| vehicle_no | type | driver | phone | vendor_id | status | notes |
|---|---|---|---|---|---|---|
| BK 1234 AA | CDD | BUDI SANTOSO | 081234567801 | 1 | aktif | ISUZU ELF - 4 TON |
| BK 5678 BB | CDD | AGUS WIRANTO | 081234567802 | 1 | aktif | MITSUBISHI CANTER - 6 TON |
| BK 9012 CC | CDE | JOKO SUSILO | 081234567803 | 2 | aktif | HINO DUTRO - 8 TON |
| BK 3456 DD | BOX | RIZAL ANWAR | 081234567804 | 1 | aktif | ISUZU NMR - 4 TON |
| BK 7890 EE | TRONTON | HENDRA GUNAWAN | 081234567805 | 2 | aktif | HINO RANGER - 15 TON |
| BK 2345 FF | CDD | SUTRISNO | 081234567806 | 1 | aktif | ISUZU ELF - 4 TON |
| BK 6789 GG | PICKUP | FAISAL RAHMAN | 081234567807 | 1 | aktif | GRAN MAX PICKUP - 1.5 TON |
| BK 1122 HH | FUSO | DEDY PRANOTO | 081234567808 | 2 | aktif | MITSUBISHI FUSO - 10 TON |

`vehicle_no` unique — dummy teridentifikasi via prefix `BK` batch ini.

## 4. `issue_log` — 8 issue (UPPERCASE)

**Kategori valid:** `Shipment/Receiving/Warehouse/Vendor/System/Inventory/Outbound/Other`, `impact ∈ {Low,Medium,High,Critical}`, `probability ∈ {Low,Medium,High}`, `status ∈ {Open,In Progress,Closed,Cancelled}`.

| issue_no | category | status | impact | title |
|---|---|---|---|---|
| ISS-DUMMY-2026-001 | Shipment | In Progress | High | KETERLAMBATAN PENGIRIMAN MEDAN - BANDA ACEH AKIBAT CUACA |
| ISS-DUMMY-2026-002 | Receiving | Open | Medium | LEAD TIME JKT-CKPA TINGGI 19 HARI |
| ISS-DUMMY-2026-003 | Warehouse | Closed | Low | PALLET RUSAK DI AREA RECEIVING |
| ISS-DUMMY-2026-004 | Vendor | Open | Medium | VENDOR RAJA CEPAT BUTUH NDA SEBELUM ONBOARDING |
| ISS-DUMMY-2026-005 | System | Closed | Low | SYNC STOK VIEW VW_INVENTORY_ALERT KOSONG |
| ISS-DUMMY-2026-006 | Inventory | In Progress | Medium | SAFETY STOCK HD PACK MASIH NULL |
| ISS-DUMMY-2026-007 | Outbound | Closed | Low | DOKUMEN PSS-2601 DUPLIKAT DI OUTBOUND_DETAIL |
| ISS-DUMMY-2026-008 | Other | Open | Medium | KOORDINAT CUSTOMER BARU 20% BELUM TERISI |

## 5. `warehouse_checklist` — 7 checklist

| date | warehouse | shift | completion | issue_notes |
|---|---|---|---|---|
| 2026-08-25 | SRU-MDN | Pagi | 87.5% | Staging outbound belum, 1 box di lantai |
| 2026-08-26 | SRU-MDN | Pagi | 100% | Semua selesai tepat waktu |
| 2026-08-27 | SRU-MDN | Pagi | 75% | Stok pallet menipis, safety check belum lengkap |
| 2026-08-28 | SRU-MDN | Siang | 100% | Shift siang aman |
| 2026-08-29 | SRU-MDN | Pagi | 87.5% | 1 dock rusak, butuh repair |
| 2026-08-30 | MDN-PAR9C | Siang | 100% | DUMMY — SIANG SHIFT LENGKAP |
| 2026-08-30 | MDN-PAR9F | Pagi | 75% | DUMMY — DOCK PAR9F SEDANG MAINTENANCE |

---

## 📌 Notion Sync (31 Agu 2026)

**6 To-dos → Done:**
- `e7341e46` Isi tarif / rate card vendor trucking dan retail
- `e2453fb9` Catat shipment tracking harian (PSS, rute, vendor, ETA, POD)
- `8fa445ad` Isi data armada internal (nopol, jenis, driver)
- `71e0b846` Lengkapi master vendor transport (PIC, SLA, coverage)
- `3c3f93e2` Checklist Warehouse
- `b59a478f` Review delay dan POD mingguan

**Notion DB dummy:**
- Shipment Tracking 8 + Outbound 8 dimirror dari Supabase (verified counts)
- Issue Log — SCM Tower (Dummy) 8 rows + Warehouse Checklist — SCM Tower (Dummy) 7 rows (baru, `parent=3c2f93e2` Ruang Kendali Supply Chain)

---

## 🗑️ Cara Hapus Data Dummy

```sql
-- Rate card dummy
DELETE FROM transport_rate_card WHERE rate_code LIKE 'BIA-DUMMY-%';
-- Shipments dummy
DELETE FROM shipments WHERE shipment_no LIKE 'SHP-2026-08-%';
-- Logs akan ikut terhapus via FK atau manual:
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

**Notion:** hapus manual pages di Shipment Tracking / Outbound / Issue Log / Warehouse Checklist yang judulnya mengandung `SHP-`, `PSS-`, `ISS-DUMMY`, atau ubah To-dos kembali ke `Not started` jika perlu reset.

---

## 📁 File Script

- `scripts/seed_dummy_approved.py` — FINAL (shipments valid enum, fleet, issue, checklist, logs) — **approved run 30–31 Agu**
- `scripts/seed_dummy.py`, `seed_v2.py`, `seed_v3.py`, `test_*.py`, `brute_pod.py` — eksperimen constraint (history)
- `scripts/add_group_to_master_sku.sql` — manual ALTER GROUP (REST tidak bisa)

---

## ✅ Sign-off

- Erwin approve: “kamu buatkan saja data dummy, saya approve” (31 Agu 2026) — semua dummy di atas sah untuk testing UI.
- Semua string UPPERCASE sesuai konvensi scm-tower.
- Phone dummy 081234567801..08 — bukan nomor asli, jangan dipakai operasional.
