-- Samakan asumsi kebutuhan HD menjadi 25 hari kerja per bulan.
-- DEFAULT berlaku untuk data baru; UPDATE menyesuaikan data yang sudah ada.
ALTER TABLE public.hd_stock_monitoring
  ALTER COLUMN working_days_per_month SET DEFAULT 25;

UPDATE public.hd_stock_monitoring
SET working_days_per_month = 25
WHERE working_days_per_month IS DISTINCT FROM 25;
