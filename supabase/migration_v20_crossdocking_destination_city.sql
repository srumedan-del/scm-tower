-- Crossdocking needs a compact destination for operations and shipment-cost pricing.
-- Run this in Supabase SQL Editor after migration_v19.

ALTER TABLE public.crossdocking_header
  ADD COLUMN IF NOT EXISTS destination_city text;

-- Populate existing records from the customer master where available.
UPDATE public.crossdocking_header cd
SET destination_city = c.city
FROM public.customers c
WHERE cd.destination_city IS NULL
  AND cd.customer_code IS NOT NULL
  AND c.customer_code = cd.customer_code
  AND c.city IS NOT NULL;

CREATE INDEX IF NOT EXISTS crossdocking_header_destination_city_idx
  ON public.crossdocking_header (destination_city)
  WHERE destination_city IS NOT NULL;

COMMENT ON COLUMN public.crossdocking_header.destination_city IS
  'Kota tujuan Crossdocking; dipakai sebagai referensi Shipment Tracking dan tarif Indah Logistik.';
