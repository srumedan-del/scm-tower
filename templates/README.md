# 📋 SCM Control Tower — Data Entry Templates

Folder ini berisi **template CSV** untuk entry data ke semua tabel SCM. Setiap file bisa dibuka di Excel/Google Sheets, diisi, lalu di-import ke Supabase.

---

## 🚀 Cara Pakai (3 Langkah)

### Step 1 — Isi di Excel/Google Sheets
Buka salah satu CSV di Excel/Google Sheets. **Jangan ubah header row**. Tambah baris data sesuai kebutuhan. Save kembali sebagai CSV (UTF-8).

### Step 2 — Siapkan tabel di Supabase
Jalankan SQL migration dulu (jika belum):
- `supabase/vendor-master.sql` — untuk `vendor_master`, `vendor_rate_card`, `internal_fleet`
- `supabase/shipment-log.sql` — untuk `shipment_log`

### Step 3 — Import ke Supabase
**Cara A — Via Table Editor (paling gampang):**
1. Buka https://app.supabase.com → pilih project `elwzpofgxgauyssatga`
2. Table Editor → pilih tabel (mis. `vendor_master`)
3. Klik **"Insert" → "Import data from CSV"**
4. Upload file CSV → map kolom → klik **Import**

**Cara B — Via SQL (untuk volume besar):**
```sql
COPY public.vendor_master FROM '/path/to/vendor_master.csv' WITH (FORMAT csv, HEADER true, NULL '');
```

**Cara C — Via psql:**
```bash
psql -h db.xxx.supabase.co -U postgres -d postgres -c "\copy vendor_master FROM 'vendor_master.csv' CSV HEADER"
```

---

## 📁 Daftar Template

| File CSV | Tabel Tujuan | Required Fields |
|---|---|---|
| `vendor_master.csv` | `vendor_master` | vendor_code, vendor_name, vendor_type, status |
| `vendor_rate_card.csv` | `vendor_rate_card` | vendor_code, service_type, origin, destination, effective_date |
| `internal_fleet.csv` | `internal_fleet` | vehicle_no, vehicle_type, status |
| `shipment_log.csv` | `shipment_log` | pss_no, shipment_date, destination_city, status |
| `warehouse_checklist.csv` | `warehouse_checklist` | checklist_date, warehouse_code, shift |
| `issue_log.csv` | `issue_log` | issue_no, issue_date, title, severity, status |
| `receiving_header.csv` | `receiving_header` | document_no, receipt_date, source_code |

---

## ⚠️ Field Reference & Enum

### `vendor_master.vendor_type`
- `internal` — armada sendiri
- `external_trucking` — vendor trucking (Fuso/CDD)
- `external_courier` — kurir (Motor/paket kecil)
- `retail` — retail delivery

### `vendor_master.status`
- `active` — aktif
- `onboarding` — proses daftar
- `inactive` — tidak aktif

### `internal_fleet.vehicle_type`
- `pickup`, `cdd`, `cde`, `fuso`, `tronton`, `motor`

### `internal_fleet.status`
- `available`, `on_trip`, `maintenance`, `inactive`

### `shipment_log.service_type`
- `internal`, `trucking`, `courier`, `expedition`, `retail_delivery`

### `shipment_log.status`
- `planned` → `picking` → `packed` → `loaded` → `in_transit` → `delivered`
- `delayed`, `returned`, `cancelled` (terminal/exception)

### `issue_log.severity`
- `low`, `medium`, `high`, `critical`

### `issue_log.status`
- `open`, `in_progress`, `resolved`, `closed`

---

## 🔗 Referensi Antar Tabel

Saat import, ada 2 kolom yang perlu penyesuaian manual setelah import:

1. **`shipment_log.vendor_id`** — di CSV pakai `vendor_code` (mis. "ASSA"). Setelah import, jalankan SQL ini untuk mapping:
   ```sql
   UPDATE shipment_log sl
   SET vendor_id = vm.id
   FROM vendor_master vm
   WHERE sl.vendor_id IS NULL
     AND vm.vendor_code = sl.vendor_id::text;
   ```
   (Atau lebih gampang: edit manual di Table Editor via dropdown)

2. **`vendor_rate_card.vendor_id`** — di CSV pakai `vendor_code`. Jalankan:
   ```sql
   UPDATE vendor_rate_card vrc
   SET vendor_id = vm.id
   FROM vendor_master vm
   WHERE vm.vendor_code = vrc.vendor_id::text;
   ```

---

## 💡 Tips Tambahan

- **Format tanggal**: `YYYY-MM-DD` (mis. `2026-09-15`)
- **Format angka**: tanpa separator ribuan, pakai titik untuk desimal (`1500.50`)
- **Coverage areas** di `vendor_master`: pisahkan dengan koma, mis. `"Medan, Banda Aceh, Pekanbaru"`
- **Kosongkan field yang tidak diketahui** — biarkan kosong, jangan isi "0" atau "-"
- **Untuk bulk update**, lebih efisien pakai SQL `UPDATE ... FROM` daripada edit di Table Editor

---

## ❓ Kalau Stuck

Kalau ada error import atau data gak masuk:
1. Cek kolom header CSV sama dengan nama kolom di Supabase (case-sensitive)
2. Cek format tanggal: harus `YYYY-MM-DD`
3. Cek enum values: sesuai daftar di atas
4. Cek foreign key: vendor harus exist dulu sebelum import rate_card/shipment