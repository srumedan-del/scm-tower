# SCM Tower Driver

Aplikasi Android untuk driver: Trip, scan Surat Jalan, POD, gagal kirim, BBM, dan biaya.
Data tersimpan di antrean lokal lebih dulu, jadi tetap aman saat tidak ada sinyal.

## Menjalankan

1. Salin `.env.example` menjadi `.env`, lalu isi `EXPO_PUBLIC_API_URL` dengan alamat scm-tower yang sudah online.
2. Jalankan `npm install`.
3. Jalankan `npx expo start`.

Pelacakan lokasi latar belakang dan beberapa modul native butuh development build atau APK, bukan Expo Go.

## Build APK

```bash
npx eas-cli build --platform android --profile preview
```

Build berjalan di cloud Expo dan membutuhkan akun Expo gratis.

## Sebelum build pertama

- Jalankan `supabase/migration_v38_driver_app.sql` di Supabase.
- Deploy scm-tower dengan kode terbaru.
- Sesuaikan `android.package` di `app.json` dengan identitas perusahaan. Nilai ini sulit diubah setelah aplikasi dipasang.
- Ganti ikon di folder `assets`.
