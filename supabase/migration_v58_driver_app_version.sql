-- v58: Versi aplikasi Android yang dipakai tiap driver (dilaporkan aplikasi lewat header X-App-Version).
-- Ditampilkan di Master Data → Driver agar admin tahu siapa yang belum memasang APK terbaru.
alter table master_driver
  add column if not exists app_version text,
  add column if not exists app_seen_at timestamptz;
