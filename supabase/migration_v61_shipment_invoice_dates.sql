-- v61: tanggal invoice vendor dan tanggal invoice diterima (Input Biaya Shipment, model Trucking/Retail).
alter table public.shipment_tracking
  add column if not exists invoice_date date,
  add column if not exists invoice_received_date date;

comment on column public.shipment_tracking.invoice_date is 'Tanggal yang tertera di invoice vendor';
comment on column public.shipment_tracking.invoice_received_date is 'Tanggal invoice vendor diterima SRU';
