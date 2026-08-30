# 📊 Notion Data Entry Templates — SCM Control Tower

Template Notion untuk entry data manual via UI. Setiap section bisa kamu copy-paste ke Notion page yang sesuai.

---

## 1. 🏢 Vendor PIC/SLA/Coverage

Gunakan ini untuk melengkapi master vendor yang statusnya `onboarding` atau `active` tapi belum ada PIC/SLA-nya.

### Format per entry:

```
Vendor: [KODE]
PIC Name: [Nama PIC]
PIC Phone: [08xxx]
PIC Email: [email@vendor.com]
Kota: [Kota]
Coverage: [Pisah koma, mis. "Medan, Banda Aceh, Pekanbaru"]
SLA (hari): [angka]
Payment Terms: [COD / Net 14 / Net 30]
Kontrak Start: [YYYY-MM-DD]
Kontrak End: [YYYY-MM-DD]
Status: [active / onboarding / inactive]
Notes: [keterangan tambahan]
```

### Entry pattern ke Notion:
- Page `Lengkapi master vendor transport (PIC, SLA, coverage)` di database `49af93e2-...`
- Sub-page = 1 vendor per entry
- Isi semua field di atas di body page
- Update Status parent → `Done` setelah semua vendor complete

---

## 2. 💰 Rate Card

```
Vendor: [KODE]
Service: [trucking / courier / retail_delivery / expedition]
Origin: [Kota asal]
Destination: [Kota tujuan]
Vehicle Type: [CDD / Fuso / Pickup / Motor]
Rate per Trip: [Rp angka, tanpa separator]
Rate per Kg: [Rp angka]
Min Charge: [Rp angka]
Min Kg: [angka]
Effective Date: [YYYY-MM-DD]
Notes: [keterangan]
```

---

## 3. 🚛 Armada Internal

```
Nopol: [BK xxxx XX]
Jenis: [Pickup / CDD / CDE / Fuso / Tronton / Motor]
Brand: [Hino / Mitsubishi / dll]
Kapasitas (kg): [angka]
Driver: [Nama]
HP Driver: [08xxx]
Service Terakhir: [YYYY-MM-DD]
Service Berikutnya: [YYYY-MM-DD]
Status: [available / on_trip / maintenance / inactive]
Notes: [keterangan]
```

---

## 4. 📦 Shipment Harian (PSS)

```
PSS No: [PSS-YYYY-MM-DD-NNN]
Tanggal Kirim: [YYYY-MM-DD]
Customer: [Nama]
Destination City: [Kota tujuan]
Address: [Alamat lengkap]
Vendor: [KODE vendor / "Internal"]
Nopol: [BK xxxx XX]
Driver: [Nama]
Service: [trucking / courier / expedition / retail_delivery / internal]
Qty Order: [angka]
Qty Kirim: [angka]
ETA: [YYYY-MM-DD]
Status: [planned / picking / loaded / in_transit / delivered / delayed]
POD Received: [Ya / Belum]
Invoice No: [INV-YYYY-MMDD-NNN]
Invoice Amount: [Rp angka]
Notes: [keterangan]
```

---

## 5. 📥 Receiving / Inbound (PA Crossdocking)

```
Document No: [RCV-YYYY-MM-NNN]
Receipt Date: [YYYY-MM-DD]
Source: [JKT-JP12 / JKT-CKPA / MDN-CAR / JKT-DUM / V-CUS]
Supplier: [Nama]
Line Count: [jumlah baris]
Total Qty: [angka]
Lead Time (hari): [Ship date → Receipt date]
Status: [received / in_inspection / pending]
Notes: [keterangan]
```

⚠️ **Filter Default**: Exclude `V-CUS`, `JKT-DUM`, `MDN-CAR` (sesuai Dashboard Sementara Inbound)

---

## 6. ✅ Warehouse Checklist Harian

```
Tanggal: [YYYY-MM-DD]
Warehouse: [SRU-MDN / WH Lain]
Shift: [Pagi / Siang / Malam]
Total Items: [20 default]
Checked Items: [jumlah selesai]
Completion Rate: [% = checked/total*100]
Issue Notes: [kalau ada masalah]
Checked By: [Nama staff]
```

---

## 7. ⚠️ Issue Log

```
Issue No: [ISS-YYYY-NNN]
Issue Date: [YYYY-MM-DD]
Category: [Vendor / Receiving / Outbound / Warehouse / System / Lainnya]
Title: [judul singkat]
Impact: [deskripsi dampak]
Severity: [low / medium / high / critical]
Status: [open / in_progress / resolved / closed]
Due Date: [YYYY-MM-DD]
Assigned To: [Nama]
Resolution: [kalau sudah selesai]
Resolved Date: [YYYY-MM-DD]
```

---

## 📅 Recurring Tasks (Cron Pattern)

Berikut template task recurring yang bisa kamu set di Notion dengan reminder:

### Mingguan:
- **Review delay & POD mingguan** — setiap Senin pagi
- **Rekap PQ Ekspedisi Eksternal** — setiap Jumat sore

### Bulanan:
- **PA Internal Medan & Crossdocking Periode [Bulan YYYY]** — tanggal 1 setiap bulan
- **Invoice ASSA** — tanggal 5 setiap bulan

### Harian:
- **Catat shipment tracking harian** — setiap sore
- **Checklist Warehouse** — setiap shift

---

## 🔄 Workflow Update Status Notion

Setelah entry selesai, update parent task:

1. **Not started** → kerjakan → update isi task
2. **Not started** → selesai entry → ubah ke **Done**
3. **In progress** → entry sebagian → tetap **In progress**, isi sub-task di body
4. **In progress** → selesai total → **Done**

Contoh body untuk task "Lengkapi master vendor transport":
```
✅ ASSA — Andi (081111222333) — sla 2 hari — coverage Medan/B.Aceh/Pku — Done
✅ RSA — Budi (081111222334) — sla 2 hari — coverage Medan/Siantar — Done
🟡 INDAH — pending PIC — Notion follow up next week
⬜ RAJACEPT — onboarding baru, no PIC yet
```

---

## 💾 Sinkronisasi ke Database

Setelah entry di Notion selesai, **duplicate data ke Supabase** via:
1. Buka UI SCM di `/vendor` → tambah via form
2. Atau edit CSV di `templates/` → import ke Supabase

**Mana yang duluan?** Kalau Notion adalah single source of truth, update Notion dulu, baru replicate ke Supabase. Kalau web app adalah operasional, langsung entry ke Supabase via form.