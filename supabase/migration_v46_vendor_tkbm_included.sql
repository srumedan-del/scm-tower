-- ============================================================================
-- MIGRATION v46: Penanda vendor trucking yang tarifnya sudah all-in TKBM.
-- RSA dan Raja Cepat Nusantara: all-in. ASSA: tarif + TKBM terpisah.
-- AMAN dijalankan ulang.
-- ============================================================================

ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS tkbm_included boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.vendors.tkbm_included IS
  'true = tarif trucking vendor sudah termasuk TKBM, sehingga TKBM tidak ditagih terpisah.';

UPDATE public.vendors
SET tkbm_included = true
WHERE vendor_name IN ('PT. RIANG SARANA ARTHA', 'PT. RAJA CEPAT NUSANTARA');
