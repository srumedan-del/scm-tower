-- migration_v39_close_pre_november.sql
-- Menutup shipment lama (dokumen sebelum 1 November 2026) yang masih terbuka.
-- Shipment ini tidak punya waktu terkirim maupun POD, jadi TIDAK ditandai
-- Delivered (itu akan memalsukan OTD). Statusnya menjadi 'Closed' dan
-- status asalnya disimpan agar bisa dibuka kembali bila ada backlog.
--
-- Jalankan bagian PRATINJAU dulu, lalu seluruh blok BEGIN ... COMMIT.

-- ── PRATINJAU (baca saja) ───────────────────────────────────────────────────
-- SELECT status, COUNT(*), MIN(document_date), MAX(document_date)
-- FROM public.shipment_tracking
-- WHERE document_date < DATE '2026-11-01'
--   AND status IN ('Draft', 'Dispatched', 'In Transit')
-- GROUP BY status;

BEGIN;

-- 1. Status Closed: ditutup secara administratif, bukan hasil pengiriman.
ALTER TABLE public.shipment_tracking DROP CONSTRAINT IF EXISTS shipment_tracking_status_check;
ALTER TABLE public.shipment_tracking
  ADD CONSTRAINT shipment_tracking_status_check
  CHECK (status IN ('Draft', 'Dispatched', 'In Transit', 'Delivered', 'Failed Delivery', 'Closed'));

ALTER TABLE public.shipment_tracking
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_reason text,
  ADD COLUMN IF NOT EXISTS status_before_close text;

-- 2. Trigger Retail (v25) dulu memaksa semua status selain Delivered kembali
--    ke In Transit. Itu juga menimpa Failed Delivery dari v38. Status akhir kini dihormati.
CREATE OR REPLACE FUNCTION public.enforce_retail_resi_in_transit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.cost_model = 'Retail'
     AND NULLIF(trim(NEW.no_resi), '') IS NOT NULL
     AND NEW.status NOT IN ('Delivered', 'Failed Delivery', 'Closed') THEN
    NEW.status := 'In Transit';
  END IF;
  RETURN NEW;
END;
$$;

-- 3. Penutupan.
UPDATE public.shipment_tracking
SET status_before_close = status,
    status = 'Closed',
    closed_at = now(),
    closed_reason = 'Penutupan data sebelum 1 November 2026'
WHERE document_date < DATE '2026-11-01'
  AND status IN ('Draft', 'Dispatched', 'In Transit');

COMMIT;

-- ── PERIKSA SETELAH JALAN ───────────────────────────────────────────────────
-- SELECT status, COUNT(*) FROM public.shipment_tracking GROUP BY status;

-- ── MEMBUKA KEMBALI (backlog) ───────────────────────────────────────────────
-- Ganti daftar id atau pss_no sesuai shipment yang ternyata masih berjalan.
-- UPDATE public.shipment_tracking
-- SET status = COALESCE(status_before_close, 'In Transit'),
--     closed_at = NULL, closed_reason = NULL, status_before_close = NULL
-- WHERE status = 'Closed' AND pss_no IN ('PSS-...');
