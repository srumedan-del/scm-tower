-- ============================================================================
-- MIGRATION v36: Sync status crossdocking_header dari shipment_tracking
--
-- Masalah: crossdocking_header.status tidak terupdate saat shipment
-- dibuat/diupdate dari TMS panel. Shipment sudah 'In Transit' tapi
-- crossdocking_header masih 'Draft'/'Ready'.
--
-- Fix: Update crossdocking_header.status berdasarkan status shipment_tracking
-- tertinggi yang terhubung ke crossdocking tersebut.
--
-- Status mapping:
--   shipment Delivered  → crossdocking Delivered
--   shipment Dispatched atau In Transit → crossdocking Dispatched
--   shipment Draft (saja) → biarkan (tidak diubah)
--
-- AMAN dijalankan: hanya UPDATE, tidak DROP/CREATE tabel.
-- ============================================================================

-- Backfill: update crossdocking yang sudah punya shipment Delivered
UPDATE public.crossdocking_header cd
SET status = 'Delivered', updated_at = now()
WHERE cd.id IN (
  SELECT DISTINCT crossdocking_id
  FROM public.shipment_tracking
  WHERE source_type = 'Crossdocking'
    AND crossdocking_id IS NOT NULL
    AND status = 'Delivered'
)
AND cd.status <> 'Delivered';

-- Backfill: update crossdocking yang punya shipment Dispatched / In Transit
-- (kecuali yang sudah Delivered di langkah sebelumnya)
UPDATE public.crossdocking_header cd
SET status = 'Dispatched', updated_at = now()
WHERE cd.id IN (
  SELECT DISTINCT crossdocking_id
  FROM public.shipment_tracking
  WHERE source_type = 'Crossdocking'
    AND crossdocking_id IS NOT NULL
    AND status IN ('Dispatched', 'In Transit')
)
AND cd.status NOT IN ('Delivered', 'Dispatched');
