-- ============================================================================
-- MIGRATION v48: Catat kapan PTS Realokasi dikirim ke JKT-JP12.
-- Status tetap 'Realokasi'; realokasi_shipped_at terisi = sudah dikirim.
-- AMAN dijalankan ulang.
-- ============================================================================

ALTER TABLE public.crossdocking_pts
  ADD COLUMN IF NOT EXISTS realokasi_shipped_at timestamptz,
  ADD COLUMN IF NOT EXISTS realokasi_shipped_by text;

-- PTS-2611-0423 sudah dikirim ke JKT-JP12 (konfirmasi 12 Nov 2026)
UPDATE public.crossdocking_pts
SET realokasi_shipped_at = now(), realokasi_shipped_by = 'Konfirmasi admin', updated_at = now()
WHERE pts_no = 'PTS-2611-0423'
  AND status = 'Realokasi'
  AND realokasi_shipped_at IS NULL;
