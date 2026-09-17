-- A rate card belongs to a Master Route. Origin and destination are retained
-- for backwards compatibility, while route_id becomes the authoritative link.

ALTER TABLE public.transport_rate_card
  ADD COLUMN IF NOT EXISTS route_id bigint REFERENCES public.routes(id) ON DELETE SET NULL;

-- Link existing rate cards to their matching Master Route when available.
UPDATE public.transport_rate_card rate_card
SET route_id = (
  SELECT route.id
  FROM public.routes route
  WHERE upper(trim(route.origin)) = upper(trim(rate_card.origin))
    AND upper(trim(route.destination)) = upper(trim(rate_card.destination))
  ORDER BY route.id
  LIMIT 1
)
WHERE rate_card.route_id IS NULL;

CREATE INDEX IF NOT EXISTS transport_rate_card_route_id_idx
  ON public.transport_rate_card (route_id);
