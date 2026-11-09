-- migration_v38_driver_app.sql
-- Fondasi aplikasi driver Android (dan portal /driver).
-- Bersifat aditif, aman dijalankan ulang. Jalankan di Supabase SQL Editor
-- SEBELUM men-deploy kode yang memakai kolom-kolom ini.

BEGIN;

-- 1. Status gagal kirim. Constraint lama hanya mengizinkan empat status.
DO $$
DECLARE
  c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.shipment_tracking'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%In Transit%'
  LOOP
    EXECUTE format('ALTER TABLE public.shipment_tracking DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.shipment_tracking
  ADD CONSTRAINT shipment_tracking_status_check
  CHECK (status IN ('Draft', 'Dispatched', 'In Transit', 'Delivered', 'Failed Delivery'));

-- 2. Estimasi dipisah dari biaya aktual agar realisasi tidak tercampur.
ALTER TABLE public.shipment_tracking
  ADD COLUMN IF NOT EXISTS estimated_bbm_rupiah numeric,
  ADD COLUMN IF NOT EXISTS estimated_overhead_rupiah numeric,
  ADD COLUMN IF NOT EXISTS failed_at timestamptz,
  ADD COLUMN IF NOT EXISTS failure_reason text,
  ADD COLUMN IF NOT EXISTS failure_photo_url text,
  ADD COLUMN IF NOT EXISTS receiver_type text,
  ADD COLUMN IF NOT EXISTS delivery_sequence integer;

-- 3. delivery_pod menjadi satu-satunya sumber POD (admin dan driver).
ALTER TABLE public.delivery_pod
  ADD COLUMN IF NOT EXISTS receiver_type text,
  ADD COLUMN IF NOT EXISTS distance_meters numeric,
  ADD COLUMN IF NOT EXISTS arrival_lat double precision,
  ADD COLUMN IF NOT EXISTS arrival_lng double precision,
  ADD COLUMN IF NOT EXISTS client_ref text;

-- 4. Trip aktif untuk armada internal: vendor tidak wajib, odometer tersimpan.
ALTER TABLE public.trip ALTER COLUMN vendor_id DROP NOT NULL;

ALTER TABLE public.trip
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS odometer_start integer,
  ADD COLUMN IF NOT EXISTS odometer_end integer;

-- 5. Kirim ulang dari antrean offline tidak boleh menggandakan data.
ALTER TABLE public.trip_fuel_logs ADD COLUMN IF NOT EXISTS client_ref text;
ALTER TABLE public.trip_adhoc_expenses ADD COLUMN IF NOT EXISTS client_ref text;

CREATE UNIQUE INDEX IF NOT EXISTS delivery_pod_client_ref_key
  ON public.delivery_pod (client_ref) WHERE client_ref IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS trip_fuel_logs_client_ref_key
  ON public.trip_fuel_logs (client_ref) WHERE client_ref IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS trip_adhoc_expenses_client_ref_key
  ON public.trip_adhoc_expenses (client_ref) WHERE client_ref IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS driver_location_logs_point_key
  ON public.driver_location_logs (trip_id, driver_id, recorded_at);

COMMIT;
