-- ============================================================================
-- MIGRATION v43
-- 1. PTS boleh berstatus 'Realokasi' (dipindah MDN-PAR ke JKT-JP12, tanpa
--    crossdocking dan tanpa biaya).
-- 2. Crossdocking Header boleh berstatus 'In Transit' (shipment sudah punya
--    PSS dan Trip, atau sudah diserahkan ke vendor retail).
-- AMAN dijalankan ulang.
-- ============================================================================

ALTER TABLE public.crossdocking_pts
  DROP CONSTRAINT IF EXISTS crossdocking_pts_status_check;
ALTER TABLE public.crossdocking_pts
  ADD CONSTRAINT crossdocking_pts_status_check
    CHECK (status IN ('Menunggu Crossdocking', 'Terhubung Crossdocking', 'Realokasi'));

UPDATE public.crossdocking_pts
SET status = 'Realokasi', updated_at = now()
WHERE pts_no IN ('PTS-2611-0423', 'PTS-2611-0424')
  AND crossdocking_id IS NULL;

ALTER TABLE public.crossdocking_header
  DROP CONSTRAINT IF EXISTS crossdocking_header_status_check;
ALTER TABLE public.crossdocking_header
  ADD CONSTRAINT crossdocking_header_status_check
    CHECK (status IN ('Draft', 'Ready', 'Dispatched', 'In Transit', 'Delivered'));

-- Backfill: crossdocking yang shipment-nya sudah In Transit
UPDATE public.crossdocking_header cd
SET status = 'In Transit', updated_at = now()
WHERE cd.status IN ('Draft', 'Ready', 'Dispatched')
  AND cd.id IN (
    SELECT crossdocking_id FROM public.shipment_tracking
    WHERE crossdocking_id IS NOT NULL AND status = 'In Transit'
  );
