# 📝 Log Data Dummy — SCM Control Tower

**Tanggal dibuat:** 30 Agustus 2026
**Dibuat oleh:** Cal (AI assistant via Hermes)
**Tujuan:** Visualisasi workflow SCM untuk testing UI development
**Status:** **ACTIVE — TETAP DIGUNAKAN sampai implementasi selesai**

> ⚠️ **Data di bawah ini BUKAN data produksi.** Semua entry adalah dummy yang di-generate untuk testing. Mohon dikonfirmasi sebelum digunakan untuk reporting ke client/pihak eksternal.

---

## 1. Tabel: `vendors`

### Vendor DUMMY (di-insert oleh Cal):

| vendor_code | vendor_name | vendor_type | pic_name | phone | coverage_area | default_sla | is_active |
|---|---|---|---|---|---|---|---|
| `VOTH_ASSA` | ASSA (Anugrah Surya Alam) | COURIER | Budi | +62 811-2222-333 | "Medan, Banda Aceh, Pekanbaru" | 2 | true |
| `VOTH_RSA` | RSA (Riau Surya Abadi) | COURIER | Andi | +62 822-3333-444 | "Medan, Siantar, Rantauprapat" | 2 | true |
| `VOTH_INDAH` | Indah Logistik | TRUCKING | Joko | +62 813-4444-555 | "Medan, Banda Aceh, Lhokseumawe" | 3 | true |

### Vendor DUMMY — DIHAPUS:

| vendor_code | vendor_name | Alasan hapus |
|---|---|---|
| `VOTH_RAJACEPT` | Raja Cepat | Kontrak kerjasama belum ada (per Erwin, 30 Agu 2026). Task onboarding masih open di Notion. |

### Vendor EXISTING (bukan dummy, milik original):

| vendor_code | vendor_name | vendor_type | pic_name | phone |
|---|---|---|---|---|
| `VOTH001801` | PT. RIANG SARANA ARTHA | TRUCKING | RIDWAN | +62 853-7072-5531 |
| `VOTH000095` | PT. ADI SARANA ARMADA TBK - MEDAN | TRUCKING | WINDRA | +62 877-7099-2770 |

**Cara identifikasi dummy:** Semua dummy pakai prefix `VOTH_<NAMA>` (uppercase, underscore). Existing pakai `VOTH<6-digit-number>` (contoh: VOTH001801).

---

## 2. Tabel: `receiving_header`

### 4 row DUMMY (di-insert oleh Cal):

| ptr_no | transfer_from_code | transfer_to_code | shipping_agent_code | ship_to_receipt_days | Keterangan |
|---|---|---|---|---|---|
| `PTR-2026-08-25-001` | JKT-JP12 | SRU-MDN | ASSA | 5 | Dummy lead time normal |
| `PTR-2026-08-27-002` | JKT-JP12 | SRU-MDN | RSA | 5 | Dummy lead time normal |
| `PTR-2026-08-28-003` | MDN-CAR | SRU-MDN | INTERNAL | 0 | Dummy crossdock instant |
| `PTR-2026-08-29-004` | JKT-CKPA | SRU-MDN | INDAH | 18 | Dummy lead time tinggi (alert merah) |

**Pattern dummy:** `PTR-2026-MM-DD-NNN` dengan NNN 001-004, plus dari source yang ada di real DB.

### Real data: 100 row dari ERP export (bukan punya saya)

---

## 3. Tabel: `warehouse_checklist`

### 5 row DUMMY (di-insert oleh Cal):

| checklist_date | warehouse_code | shift | issue_notes |
|---|---|---|---|
| 2026-08-25 | SRU-MDN | Pagi | "Staging outbound belum, 1 box di lantai" |
| 2026-08-26 | SRU-MDN | Pagi | "Semua selesai tepat waktu" |
| 2026-08-27 | SRU-MDN | Pagi | "Stok pallet menipis, safety check belum lengkap" |
| 2026-08-28 | SRU-MDN | Siang | "Shift siang aman" |
| 2026-08-29 | SRU-MDN | Pagi | "1 dock rusak, butuh repair" |

**Note:** Setiap row berisi 8 boolean checklist field (area_receiving_clean, dock_available, forklift_ready, pallet_available, damaged_goods_separated, inbound_documents_complete, outbound_staging_done, safety_check_done). completion_rate adalah GENERATED column (auto-computed).

---

## 4. Tabel: `shipments`

**❌ TIDAK ADA data dummy** — semua gagal insert karena check constraint `shipments_pod_status_check` menolak semua nilai yang di-test (60+ kandidat string/numeric).

**Cara resolve nanti:** butuh akses PostgreSQL langsung untuk query `pg_constraint` dan lihat nilai yang valid, atau minta Erwin paste data manual via Supabase Dashboard Table Editor.

---

## 5. Tabel: `issue_log`

**❌ TIDAK ADA data dummy** — semua gagal insert karena check constraint `issue_log_impact_check` menolak semua nilai yang di-test (string/numeric/panjang variasi).

**Cara resolve nanti:** sama seperti di atas.

---

## 6. Tabel: `shipment_status_logs`

**❌ TIDAK ADA data dummy** — dependent pada `shipments.id` yang tidak ada.

---

## 📌 Notion Updates

**5 task diubah status ke "In progress":**
- Checklist Warehouse (id: `3c3f93e2-767b-8094-ade5-c97f3720dd5c`)
- Lengkapi master vendor transport (id: `71e0b846-6265-4254-a7be-1420d3bbb360`)
- Isi data armada internal (id: `8fa445ad-b954-4171-8e21-d031dfd9be4d`)
- Isi tarif / rate card vendor trucking dan retail (id: `e7341e46-0974-4532-997c-1434dd6a7830`)
- Catat shipment tracking harian (id: `e2453fb9-361a-4fc5-b0e9-74ad2701dd97`)

**Progress notes di-append** ke task "Lengkapi master vendor transport" (sudah di-trash untuk entry Raja Cepat).

---

## 🗑️ Cara Hapus Data Dummy (kalau nanti mau bersih-bersih)

### Via Supabase Dashboard:
1. Buka https://app.supabase.com → project `elwzpofgxgauyssatga`
2. Table Editor → filter & hapus row dengan `vendor_code LIKE 'VOTH_%'` (kecuali existing: VOTH001801, VOTH000095)
3. Receiving header: filter `ptr_no LIKE 'PTR-2026-08-25-%'` sampai `'PTR-2026-08-29-004'`
4. Warehouse checklist: filter by `checklist_date BETWEEN '2026-08-25' AND '2026-08-29'`

### Via SQL:
```sql
-- Hapus vendor dummy (preserve 2 existing)
DELETE FROM vendors 
WHERE vendor_code IN ('VOTH_ASSA', 'VOTH_RSA', 'VOTH_INDAH');

-- Hapus receiving dummy
DELETE FROM receiving_header 
WHERE ptr_no IN (
  'PTR-2026-08-25-001', 'PTR-2026-08-27-002', 
  'PTR-2026-08-28-003', 'PTR-2026-08-29-004'
);

-- Hapus warehouse checklist dummy
DELETE FROM warehouse_checklist 
WHERE checklist_date BETWEEN '2026-08-25' AND '2026-08-29';
```

---

## 📁 File Script yang Membuat Data Dummy

- `D:/scm-app/scm-tower/scripts/seed_dummy.py` — versi awal (gagal semua karena nama kolom salah)
- `D:/scm-app/scm-tower/scripts/seed_v2.py` — schema fix attempt
- `D:/scm-app/scm-tower/scripts/seed_v3.py` — versi final yang berhasil untuk vendors, receiving, checklist
- `D:/scm-app/scm-tower/scripts/test_*.py` — eksperimen untuk resolve constraint

---

## ✅ Sign-off

Sebelum data ini digunakan untuk reporting atau handover ke user lain:
- Erwin perlu konfirmasi ulang bahwa dummy PIC names (Budi, Andi, Joko) **bukan nama asli PIC**
- Phone numbers dummy (0811/0822/0813) **bukan nomor asli** — kalau ada customer yang telp nomor ini, akan salah orang
- Coverage areas dummy **perlu divalidasi** dengan master data rute asli
- SLA values (2-3 hari) adalah **asumsi rata-rata**, perlu divalidasi per-kontrak vendor