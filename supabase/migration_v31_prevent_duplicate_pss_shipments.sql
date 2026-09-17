-- One PSS may only have one shipment-tracking record.
-- This protects against duplicate inserts even when two users submit simultaneously.
CREATE UNIQUE INDEX IF NOT EXISTS shipment_tracking_unique_pss_idx
  ON public.shipment_tracking (pss_no)
  WHERE source_type = 'PSS' AND pss_no IS NOT NULL;
