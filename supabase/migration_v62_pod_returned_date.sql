-- v62: tanggal dokumen POD dari vendor ekspedisi diterima kembali di SRU.
-- Lama kembali = hari kerja dari serah barang + dokumen ke vendor (dispatch_time) sampai tanggal ini.
-- Target ideal = 2 x leadtime + 0,5 hari (leadtime rate card vendor, cadangan SLA DK 1 / LK 5).
alter table public.shipment_tracking
  add column if not exists pod_returned_date date;

comment on column public.shipment_tracking.pod_returned_date is 'Tanggal dokumen POD vendor diterima kembali di SRU';
