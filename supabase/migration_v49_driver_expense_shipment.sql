-- ============================================================================
-- MIGRATION v49: Biaya driver per PSS (untuk TKBM / SPSI).
-- Biaya TKBM dicatat per PSS / surat jalan, jadi biaya mencatat shipment-nya.
-- AMAN dijalankan ulang.
-- ============================================================================

ALTER TABLE public.trip_adhoc_expenses
  ADD COLUMN IF NOT EXISTS shipment_id bigint REFERENCES public.shipment_tracking(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS trip_adhoc_expenses_shipment_idx
  ON public.trip_adhoc_expenses (shipment_id) WHERE shipment_id IS NOT NULL;
