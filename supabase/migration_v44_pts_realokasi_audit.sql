-- ============================================================================
-- MIGRATION v44: Catat siapa dan kapan PTS ditandai Realokasi.
-- AMAN dijalankan ulang.
-- ============================================================================

ALTER TABLE public.crossdocking_pts
  ADD COLUMN IF NOT EXISTS realokasi_by text,
  ADD COLUMN IF NOT EXISTS realokasi_at timestamptz;

-- PTS yang sudah ditandai sebelum kolom ini ada
UPDATE public.crossdocking_pts
SET realokasi_at = updated_at
WHERE status = 'Realokasi' AND realokasi_at IS NULL;
