-- v52: Daftar hari libur (libur nasional dan cuti bersama) untuk melewati pengambilan stok SIRUP otomatis.
-- Sabtu dan Minggu sudah otomatis bukan hari kerja, jadi tidak perlu dicatat di sini.
create table if not exists holidays (
  holiday_date date primary key,
  name text not null,
  created_by text,
  created_at timestamptz not null default now()
);

alter table holidays enable row level security;

-- Isi awal: tanggal libur yang pasti. Tambahkan libur nasional dan cuti bersama lain dari menu Stock Opname → Hari Libur.
insert into holidays (holiday_date, name, created_by) values
  ('2026-12-25', 'Hari Raya Natal', 'migrasi v52'),
  ('2027-01-01', 'Tahun Baru Masehi', 'migrasi v52')
on conflict (holiday_date) do nothing;
