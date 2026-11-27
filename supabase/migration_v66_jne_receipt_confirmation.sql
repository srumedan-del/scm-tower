-- v66: JNE tidak mengembalikan dokumen POD ke SRU. Penerimaan dikonfirmasi lewat telepon ke
-- PIC penerima di customer; kontak PIC disimpan di Master Customer.

alter table public.customers
  add column if not exists pic_name text,
  add column if not exists pic_phone text;

alter table public.shipment_tracking
  add column if not exists receipt_received_date date,
  add column if not exists receipt_confirmed_with text,
  add column if not exists receipt_confirm_note text,
  add column if not exists receipt_confirmed_by text,
  add column if not exists receipt_confirmed_at timestamptz;

comment on column public.shipment_tracking.receipt_received_date is 'Tanggal barang diterima menurut konfirmasi telepon ke pelanggan (vendor tanpa POD, mis. JNE).';
comment on column public.shipment_tracking.receipt_confirmed_with is 'Nama orang di pelanggan yang mengonfirmasi penerimaan.';
comment on column public.shipment_tracking.receipt_confirmed_by is 'Email pengguna SCM Tower yang menelepon/mencatat konfirmasi.';
