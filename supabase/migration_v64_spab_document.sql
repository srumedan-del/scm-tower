-- v64: Surat Perintah Ambil Barang (SPAB), satu dokumen per PSS.
-- Nomor: <seq 5 digit>/SPAB/SRU/<bulan romawi>/<tahun>; seq unik per tahun.
create table if not exists public.spab_document (
  id               bigserial primary key,
  spab_no          text not null unique,
  seq              integer not null,
  year             integer not null,
  spab_date        date not null,
  tracking_id      bigint references public.shipment_tracking(id) on delete set null,
  pss_no           text,
  trip_id          text,
  customer_name    text,
  customer_address text,
  recipient        text,
  vehicle_no       text,
  driver_name      text,
  fleet_type       text,
  pickup_date      date,
  signer           text,
  notes            text,
  created_by       text,
  created_at       timestamptz not null default now(),
  unique (year, seq)
);

create index if not exists spab_document_pss_idx on public.spab_document (pss_no);
create index if not exists spab_document_tracking_idx on public.spab_document (tracking_id);

alter table public.spab_document enable row level security;
