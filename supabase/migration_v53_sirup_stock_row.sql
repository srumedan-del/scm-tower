-- v53: Seluruh baris stok SIRUP (tanpa saring kategori/bincode) per snapshot harian.
-- Hanya 30 hari terakhir yang disimpan di sini (dibersihkan oleh scripts/sirup-opname);
-- arsip lengkap tersimpan sebagai CSV di PC lokal (D:\SIRUP-Stok).
create table if not exists sirup_stock_row (
  id bigserial primary key,
  snapshot_date date not null references sirup_stock_snapshot (snapshot_date) on delete cascade,
  kategori text,
  no_item text,
  nama_item text,
  serial_no text,
  lot_no text,
  expiration_date date,
  cabang text,
  loccode text,
  lokasi text,
  bincode text,
  rumah_sakit text,
  qty numeric not null default 0
);

create index if not exists sirup_stock_row_date_idx on sirup_stock_row (snapshot_date);
create index if not exists sirup_stock_row_item_idx on sirup_stock_row (snapshot_date, no_item);

alter table sirup_stock_row enable row level security;

alter table sirup_stock_snapshot add column if not exists cabang text;
alter table sirup_stock_snapshot add column if not exists loccode text;
alter table sirup_stock_snapshot add column if not exists local_file text;
