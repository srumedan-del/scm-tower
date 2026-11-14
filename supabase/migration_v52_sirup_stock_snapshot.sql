-- v52: Snapshot stok SIRUP harian (diambil otomatis pukul 07.00 hari kerja oleh scripts/sirup-opname).
-- Snapshot tidak membuat sesi opname; sesi dibuat pengguna dari menu Stock Opname → Buat Opname.
create table if not exists sirup_stock_snapshot (
  id bigserial primary key,
  snapshot_date date not null unique,
  taken_at timestamptz not null default now(),
  total_rows integer not null default 0,
  source_note text,
  -- Baris yang sudah disaring (Dialyzer + Blood Tubing Set, bincode MDN-PAR-CON), format sama dengan stock_opname_line.
  lines jsonb not null default '[]'::jsonb
);

alter table sirup_stock_snapshot enable row level security;
