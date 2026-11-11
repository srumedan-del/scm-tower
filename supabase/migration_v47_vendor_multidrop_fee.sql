-- ============================================================================
-- MIGRATION v47: Biaya multidrop per vendor trucking.
-- Satu Trip charter = satu tarif (tujuan termahal). Setiap titik antar
-- tambahan dikenai biaya multidrop:
--   - dalam kota  : titik tambahan di kota yang sama dengan tujuan utama
--   - luar kota   : titik tambahan di kota lain
-- ASSA (SPH 199/ASSA/SALES-HO/V/2026): dalam kota 200.000, luar kota 500.000.
-- AMAN dijalankan ulang.
-- ============================================================================

ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS multidrop_fee_in_city numeric,
  ADD COLUMN IF NOT EXISTS multidrop_fee_out_city numeric;

COMMENT ON COLUMN public.vendors.multidrop_fee_in_city IS 'Biaya per titik antar tambahan di kota yang sama (Rp).';
COMMENT ON COLUMN public.vendors.multidrop_fee_out_city IS 'Biaya per titik antar tambahan di kota lain (Rp).';

UPDATE public.vendors
SET multidrop_fee_in_city = 200000, multidrop_fee_out_city = 500000
WHERE vendor_name = 'PT. ADI SARANA ARMADA TBK - MEDAN'
  AND multidrop_fee_in_city IS NULL AND multidrop_fee_out_city IS NULL;
