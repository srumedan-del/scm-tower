-- Crossdocking is always classified as Luar Kota (LK) for transport planning.

UPDATE public.shipment_tracking
SET dk_lk = 'LK', updated_at = now()
WHERE source_type = 'Crossdocking'
  AND dk_lk IS DISTINCT FROM 'LK';

CREATE OR REPLACE FUNCTION public.enforce_crossdocking_lk()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.source_type = 'Crossdocking' THEN
    NEW.dk_lk := 'LK';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS shipment_tracking_crossdocking_lk ON public.shipment_tracking;
CREATE TRIGGER shipment_tracking_crossdocking_lk
BEFORE INSERT OR UPDATE OF source_type, dk_lk ON public.shipment_tracking
FOR EACH ROW EXECUTE FUNCTION public.enforce_crossdocking_lk();
