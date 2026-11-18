-- v59
-- 1) Riwayat PSS yang dikeluarkan dari trip (Pindah Trip, Perubahan muatan, Batal kirim).
--    Baris shipment_tracking tetap dihapus agar PSS kembali ke For Transport Planning;
--    alasannya disimpan di sini dan ditampilkan sebagai label di daftar perencanaan.
create table if not exists shipment_trip_removal (
  id bigserial primary key,
  source_type text not null default 'PSS',
  pss_no text,
  crossdocking_id bigint,
  trip_id text,
  reason text not null check (reason in ('Pindah Trip', 'Perubahan muatan', 'Batal kirim')),
  notes text,
  removed_by text,
  removed_at timestamptz not null default now()
);
create index if not exists shipment_trip_removal_pss_idx on shipment_trip_removal (pss_no, removed_at desc);
create index if not exists shipment_trip_removal_cd_idx on shipment_trip_removal (crossdocking_id, removed_at desc);
alter table shipment_trip_removal enable row level security;

-- 2) Foto POD lebih dari satu, per jenis: [{ "type": "dokumen" | "produk" | "serah_terima", "path": "..." }].
--    photo_url tetap diisi foto dokumen pertama agar tampilan lama tetap jalan.
alter table delivery_pod
  add column if not exists photos jsonb;
