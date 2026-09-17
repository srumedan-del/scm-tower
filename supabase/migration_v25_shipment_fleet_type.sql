-- ============================================================================
-- MIGRATION v25: Tambah kolom fleet_type & cost_model ke tabel shipments
-- Tujuan: Pemisahan armada Internal vs Eksternal di Shipment
--
-- fleet_type: 'Internal' (kendaraan milik SRU) | 'Eksternal' (sewa/vendor)
-- cost_model: 'Internal' | 'Retail' | 'Trucking' | NULL
--
-- AMAN dijalankan: ADD COLUMN IF NOT EXISTS
-- ============================================================================

-- Tambah kolom fleet_type
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='shipments' AND column_name='fleet_type') THEN
    ALTER TABLE public.shipments ADD COLUMN fleet_type text CHECK (fleet_type IN ('Internal', 'Eksternal'));
  END IF;
END $$;

-- Tambah kolom cost_model
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='shipments' AND column_name='cost_model') THEN
    ALTER TABLE public.shipments ADD COLUMN cost_model text CHECK (cost_model IN ('Internal', 'Retail', 'Trucking', NULL));
  END IF;
END $$;

-- Update cost_model berdasarkan fleet_type yang sudah ada
-- (hanya jika fleet_type sudah terisi tapi cost_model masih kosong)
UPDATE public.shipments
SET cost_model = CASE
  WHEN fleet_type = 'Internal' THEN 'Internal'
  WHEN fleet_type = 'Eksternal' THEN 'Trucking'
  ELSE NULL
END
WHERE fleet_type IS NOT NULL AND cost_model IS NULL;

COMMENT ON COLUMN public.shipments.fleet_type IS
  'Jenis armada: Internal (kendaraan milik SRU) atau Eksternal (sewa/vendor).';
COMMENT ON COLUMN public.shipments.cost_model IS
  'Model biaya: Internal (operasional detail), Retail (per resi), atau Trucking (per trip/FTL).';
