-- Prevent duplicate route pairs, ignoring upper/lower case and repeated spaces.
-- This trigger protects imports and direct database writes as well as the UI.

CREATE OR REPLACE FUNCTION public.prevent_duplicate_route()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  duplicate_code text;
BEGIN
  NEW.origin := upper(regexp_replace(trim(NEW.origin), '\s+', ' ', 'g'));
  NEW.destination := upper(regexp_replace(trim(NEW.destination), '\s+', ' ', 'g'));
  NEW.city := COALESCE(NULLIF(trim(NEW.city), ''), NEW.destination);

  SELECT route_code INTO duplicate_code
  FROM public.routes
  WHERE id IS DISTINCT FROM NEW.id
    AND upper(regexp_replace(trim(origin), '\s+', ' ', 'g')) = NEW.origin
    AND upper(regexp_replace(trim(destination), '\s+', ' ', 'g')) = NEW.destination
  LIMIT 1;

  IF duplicate_code IS NOT NULL THEN
    RAISE EXCEPTION 'Rute % → % sudah terdaftar (%).', NEW.origin, NEW.destination, duplicate_code
      USING ERRCODE = 'unique_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS routes_prevent_duplicate ON public.routes;
CREATE TRIGGER routes_prevent_duplicate
BEFORE INSERT OR UPDATE OF origin, destination ON public.routes
FOR EACH ROW EXECUTE FUNCTION public.prevent_duplicate_route();
