-- =========================================================================
-- MIGRATION: ADAPTASI FITUR BIM OVERS KE SCM-TOWER
-- Jalankan query ini di Supabase SQL Editor (Ctrl + A -> Run)
-- =========================================================================

-- 1. Tabel Pencatatan UJP Adhoc (Biaya Darurat di Jalan: Tol, Parkir, Tambal Ban)
CREATE TABLE IF NOT EXISTS trip_adhoc_expenses (
  id BIGSERIAL PRIMARY KEY,
  trip_id TEXT NOT NULL,
  driver_id BIGINT REFERENCES master_driver(id),
  expense_type TEXT NOT NULL, -- 'Tol', 'Parkir', 'Tambal Ban', 'Retribusi', 'Lainnya'
  amount_rupiah INTEGER NOT NULL,
  notes TEXT,
  receipt_photo_url TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index untuk performa lookup per trip
CREATE INDEX IF NOT EXISTS idx_trip_adhoc_expenses_trip_id ON trip_adhoc_expenses(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_adhoc_expenses_driver_id ON trip_adhoc_expenses(driver_id);

-- 2. Penambahan Kolom pada shipment_tracking untuk Urutan & Alasan Gagal Kirim
ALTER TABLE shipment_tracking 
  ADD COLUMN IF NOT EXISTS delivery_sequence INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS failure_reason TEXT,
  ADD COLUMN IF NOT EXISTS failure_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS receiver_type TEXT;

-- 3. Penambahan Kolom pada shipment_pod_records untuk Tanda Tangan & Geofencing
ALTER TABLE shipment_pod_records
  ADD COLUMN IF NOT EXISTS signature_image_url TEXT,
  ADD COLUMN IF NOT EXISTS distance_meters NUMERIC,
  ADD COLUMN IF NOT EXISTS is_geofence_valid BOOLEAN DEFAULT TRUE;

-- Enable Row Level Security (RLS)
ALTER TABLE trip_adhoc_expenses ENABLE ROW LEVEL SECURITY;

-- Policy untuk membaca & menambah data
DROP POLICY IF EXISTS "Allow all for authenticated and service role on trip_adhoc_expenses" ON trip_adhoc_expenses;
CREATE POLICY "Allow all for authenticated and service role on trip_adhoc_expenses"
  ON trip_adhoc_expenses
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);
