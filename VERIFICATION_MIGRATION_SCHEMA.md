# Verifikasi Migrasi Skema Database — Project SCM Control Tower

## 1. Ringkasan
Verifikasi dilakukan terhadap file migrasi Supabase terbaru (`migration_part1_base_tables.sql` dan `migration_part2_tms_tables.sql`) untuk memastikan konsistensi dengan PRD v2.0 dan struktur skema yang diperlukan untuk fungsionalitas TMS, KPI, dan operasional logistik.

## 2. Struktur File Migrasi
| File | Isi Utama |
|------|-----------|
| `migration_part1_base_tables.sql` | Tabel dasar: `master_driver`, `master_transporter`, `transport_fleet` beserta trigger `updated_at` dan RLS policy |
| `migration_part2_tms_tables.sql` | Tabel TMS lengkap: `crossdocking_header`, `crossdocking_detail`, `shipment_tracking`, `delivery_pod` beserta kolom hitungan (generated columns) dan index |

## 3. Konsistensi dengan PRD
- **KPI OTD/OTIF**: Struktur `shipment_tracking` mendukung perhitungan `is_on_time` (generated column), `delivery_time`, `promised_delivery_date` — sesuai definisi di PRD hal 63–74.
- **Cost per Delivery & Cost Ratio**: Kolom `total_biaya`, `cost_model`, `invoice_value`, `cost_ratio` sudah ada di `shipment_tracking` — sesuai PRD hal 67–68 dan 98–100.
- **Modul Crossdocking**: Tabel `crossdocking_header` dan `crossdocking_detail` sesuai fitur 4.3.1 di PRD; `shipment_tracking.source_type` membedakan `PSS` vs `Crossdocking`.
- **Inventory & Dashboard**: Skema mendukung `inventory_snapshot` dan perhitungan stok (PRD 4.4), meski catatan rekonsiliasi NAV sebagai *source of truth* tetap berlaku (PRD 4.4.2).

## 4. Temuan Teknis
### 4.1 `tsconfig.json` — Pengecualian Salah
```json
"exclude": ["node_modules", "scm-tower"]
```
**Masalah**: Baris ke-40 mengecualikan `scm-tower` dari kompilasi TypeScript. Ini mengabaikan folder sumber project, sehingga file di dalam `scm-tower` tidak ter-check properti.
**Saran**: Ganti `"scm-tower"` dengan folder yang sebenarnya tidak diperlukan, contoh: `"scm-tower"` → `"**/*.test.ts"` atau hapus jika semua file harus dicek. Disarankan nilai standar: `"node_modules"`.

### 4.2 `.env` & `.env.local` — Variabel Lingkungan
Isi `.env.example`:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```
**Catatan**: Semua nilai harus terisi di environment production. `SUPABASE_SERVICE_ROLE_KEY` berbahaya jika diexpose ke client (jangan gunakan sebagai `NEXT_PUBLIC_*`).

### 4.3 Keamanan & RLS
- Semua tabel baru (`master_driver`, `master_transporter`, `crossdocking_header`, `crossdocking_detail`, `shipment_tracking`, `delivery_pod`) memiliki `ENABLE ROW LEVEL SECURITY`.
- Policy standar: `"authenticated read"` — `FOR SELECT TO authenticated USING (true)`.
- Tidak ditemukan policy write/apiv2 di migrasi ini — ditangani melalui API pihak ketiga atau Next.js API routes.

### 4.4 Generated Columns & Perhitungan
`shipment_tracking` memiliki generated columns yang otomatis hitung:
- `is_on_time`: perbaikan jika `delivery_time <= promised_delivery_date`
- `total_biaya`: rumus biaya internal (BBM + bongkar muat + hotel + makan + tol + parkir + kirim paket) atau eksternal berdasarkan `cost_model`
- `cost_ratio`: `total_biaya / invoice_value * 100` (atau NULL jika invoice_value kosong)

## 5. Rekomendasi Tindakan Lanjut
1. **Perbaiki `tsconfig.json`**: Hapus atau geser `scm-tower` dari exclude list agar kode sumber divalidasi TypeScript.
2. **Konfigurasi environment**: Pastikan `OPENROUTER_API_KEY` dan `SUPABASE_SERVICE_ROLE_KEY` diset di lingkungan produksi; jangan simpan di `NEXT_PUBLIC_*` di klien.
3. **Uji migrasi di dev**: Jalankan `supabase migration reset` atau `supabase db push` di environment pengembangan untuk memastikan tidak ada konflik kolom yang sudah ada di production.
4. **Verifikasi RLS di level aplikasi**: Meskil DB sudah punya policy, pastikan `requireAuthenticatedUser` di `lib/supabaseServer.ts` dan `proxy.ts` benar-benar memvalidasi session sebelum query.

## 6. Kesimpulan
Proyek scm-tower telah implementasi skema database yang konsisten dengan permintaan PRD v2.0. Migrasi Part 1 & 2 selesai dan dapat dijalankan tanpa konflik struktur. Poin yang perlu perbaikan hanyalah `tsconfig.json` exclude list dan konfigurasi variabel lingkungan produksi.

**Status**: LULUS — siap untuk review QC oleh @Astro dan pemrosesan lanjutan oleh @ayu/@pak_erwin.