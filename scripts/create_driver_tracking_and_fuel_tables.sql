-- ============================================================================
-- SCM TOWER: Driver Real-Time Tracking, APK Authentication & Fuel Logging
-- Run this script in the Supabase SQL Editor
-- ============================================================================

-- 1. Tambah kolom kredensial (username & pin) pada master_driver
ALTER TABLE public.master_driver
  ADD COLUMN IF NOT EXISTS username text UNIQUE,
  ADD COLUMN IF NOT EXISTS pin text;

-- Inisialisasi username & default PIN (123456) untuk driver yang sudah ada
UPDATE public.master_driver
SET username = COALESCE(username, LOWER(driver_code)),
    pin = COALESCE(pin, '123456')
WHERE username IS NULL OR pin IS NULL;

-- 2. Buat tabel driver_location_logs untuk pencatatan pergerakan GPS per 50 meter
CREATE TABLE IF NOT EXISTS public.driver_location_logs (
  id bigserial PRIMARY KEY,
  trip_id text NOT NULL,
  driver_id integer REFERENCES public.master_driver(id) ON DELETE SET NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  speed_kmh double precision DEFAULT 0,
  distance_from_last_meters double precision DEFAULT 0,
  recorded_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_driver_location_trip ON public.driver_location_logs(trip_id);
CREATE INDEX IF NOT EXISTS idx_driver_location_time ON public.driver_location_logs(recorded_at DESC);

-- 3. Buat tabel trip_fuel_logs untuk pencatatan pengisian BBM & foto audit struk/odometer
CREATE TABLE IF NOT EXISTS public.trip_fuel_logs (
  id bigserial PRIMARY KEY,
  trip_id text NOT NULL,
  driver_id integer REFERENCES public.master_driver(id) ON DELETE SET NULL,
  spbu_name_location text,
  spbu_latitude double precision,
  spbu_longitude double precision,
  fuel_type text DEFAULT 'Bio Solar',
  liters numeric(10,2) NOT NULL DEFAULT 0,
  amount_rupiah bigint NOT NULL DEFAULT 0,
  odometer_before integer,
  odometer_after integer,
  photo_odometer_before_url text,
  photo_odometer_after_url text,
  photo_receipt_url text,
  logged_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_fuel_logs_trip ON public.trip_fuel_logs(trip_id);

-- 4. Buat tabel shipment_pod_records untuk bukti serah terima digital (ePOD)
CREATE TABLE IF NOT EXISTS public.shipment_pod_records (
  id bigserial PRIMARY KEY,
  shipment_tracking_id bigint REFERENCES public.shipment_tracking(id) ON DELETE CASCADE,
  pss_no text,
  arrival_time timestamptz,
  completion_time timestamptz DEFAULT timezone('utc'::text, now()),
  recipient_name text NOT NULL,
  recipient_signature_url text,
  document_photo_url text,
  arrival_lat double precision,
  arrival_lng double precision,
  geofence_verified boolean DEFAULT false,
  notes text,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pod_shipment ON public.shipment_pod_records(shipment_tracking_id);

-- 5. Berikan hak akses service_role & authenticated
GRANT ALL ON public.driver_location_logs TO authenticated, service_role, anon;
GRANT ALL ON public.trip_fuel_logs TO authenticated, service_role, anon;
GRANT ALL ON public.shipment_pod_records TO authenticated, service_role, anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role, anon;

-- Selesai
