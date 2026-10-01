-- ============================================
-- Migrasi: Ubah transport_mode Inbound ke DARAT/LAUT/UDARA
-- Tambah kolom sea_vendor_code untuk moda laut
-- ============================================

-- 1. Ubah constraint transport_mode: LAND/AIR/MULTIMODAL → DARAT/LAUT/UDARA
ALTER TABLE public.receiving_header
  DROP CONSTRAINT IF EXISTS receiving_header_transport_mode_check;

ALTER TABLE public.receiving_header
  ADD CONSTRAINT receiving_header_transport_mode_check
  CHECK (transport_mode IS NULL OR transport_mode IN ('DARAT', 'LAUT', 'UDARA'));

COMMENT ON COLUMN public.receiving_header.transport_mode IS
  'Inbound transport mode: DARAT, LAUT, atau UDARA.';

-- 2. Tambah kolom sea_vendor_code untuk moda LAUT
ALTER TABLE public.receiving_header
  ADD COLUMN IF NOT EXISTS sea_vendor_code text;

COMMENT ON COLUMN public.receiving_header.sea_vendor_code IS
  'Kode vendor laut saat transport_mode = LAUT.';

-- 3. Backfill data lama: LAND → DARAT, AIR → UDARA, MULTIMODAL → DARAT
UPDATE public.receiving_header
  SET transport_mode = CASE transport_mode
    WHEN 'LAND'     THEN 'DARAT'
    WHEN 'AIR'      THEN 'UDARA'
    WHEN 'MULTIMODAL' THEN 'DARAT'
    ELSE transport_mode
  END
WHERE transport_mode IN ('LAND', 'AIR', 'MULTIMODAL');

-- 4. Index untuk pencarian berdasarkan transport_mode dan sea_vendor_code
CREATE INDEX IF NOT EXISTS receiving_header_transport_mode_idx
  ON public.receiving_header (transport_mode)
  WHERE transport_mode IS NOT NULL;

CREATE INDEX IF NOT EXISTS receiving_header_sea_vendor_code_idx
  ON public.receiving_header (sea_vendor_code)
  WHERE sea_vendor_code IS NOT NULL;