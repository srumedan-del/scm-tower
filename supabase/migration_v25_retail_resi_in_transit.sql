-- A Retail shipment is In Transit as soon as it is handed to the vendor and
-- has a resi. It becomes Delivered only after customer receipt/POD is recorded.

UPDATE public.shipment_tracking
SET status = 'In Transit', updated_at = now()
WHERE cost_model = 'Retail'
  AND NULLIF(trim(no_resi), '') IS NOT NULL
  AND status <> 'Delivered';

CREATE OR REPLACE FUNCTION public.enforce_retail_resi_in_transit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.cost_model = 'Retail'
     AND NULLIF(trim(NEW.no_resi), '') IS NOT NULL
     AND NEW.status <> 'Delivered' THEN
    NEW.status := 'In Transit';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS shipment_tracking_retail_resi_in_transit ON public.shipment_tracking;
CREATE TRIGGER shipment_tracking_retail_resi_in_transit
BEFORE INSERT OR UPDATE OF cost_model, no_resi, status ON public.shipment_tracking
FOR EACH ROW EXECUTE FUNCTION public.enforce_retail_resi_in_transit();
