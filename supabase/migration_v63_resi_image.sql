-- v63: gambar resi kiriman retail (satu gambar per PSS).
-- Path file di bucket privat pod-documents (resi/<tracking_id>/<uuid>.jpg); dibuka lewat signed URL.
alter table public.shipment_tracking
  add column if not exists resi_image_path text;
