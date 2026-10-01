-- Receiving transport metadata: land/air vendor and container reference.
-- Run once in the Supabase SQL editor.

ALTER TABLE public.receiving_header
  ADD COLUMN IF NOT EXISTS transport_mode text,
  ADD COLUMN IF NOT EXISTS land_vendor_code text,
  ADD COLUMN IF NOT EXISTS air_vendor_code text,
  ADD COLUMN IF NOT EXISTS container_no text;

ALTER TABLE public.receiving_header
  DROP CONSTRAINT IF EXISTS receiving_header_transport_mode_check;

ALTER TABLE public.receiving_header
  ADD CONSTRAINT receiving_header_transport_mode_check
  CHECK (transport_mode IS NULL OR transport_mode IN ('LAND', 'AIR', 'MULTIMODAL'));

COMMENT ON COLUMN public.receiving_header.transport_mode IS
  'Inbound transport mode: LAND, AIR, or MULTIMODAL.';
COMMENT ON COLUMN public.receiving_header.land_vendor_code IS
  'Vendor used for land/sea leg. Kept as text to support existing shipping agent codes.';
COMMENT ON COLUMN public.receiving_header.air_vendor_code IS
  'Vendor used for air leg, when different from the land vendor.';
COMMENT ON COLUMN public.receiving_header.container_no IS
  'Container or airway shipment reference associated with the PTR.';

CREATE INDEX IF NOT EXISTS receiving_header_container_no_idx
  ON public.receiving_header (container_no)
  WHERE container_no IS NOT NULL;
