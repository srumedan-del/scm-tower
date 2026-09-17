-- Dedicated customer master for Crossdocking.
-- Each successful insert or update of a Crossdocking header refreshes this list.

CREATE TABLE IF NOT EXISTS public.crossdocking_customer (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_name text NOT NULL,
  destination_city text,
  destination_address text,
  first_crossdocking_at timestamptz NOT NULL DEFAULT now(),
  last_crossdocking_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (customer_name, destination_city)
);

CREATE OR REPLACE FUNCTION public.sync_crossdocking_customer()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NULLIF(trim(NEW.customer_name), '') IS NOT NULL THEN
    INSERT INTO public.crossdocking_customer (
      customer_name, destination_city, destination_address, last_crossdocking_at
    ) VALUES (
      trim(NEW.customer_name), NULLIF(trim(NEW.destination_city), ''),
      NULLIF(trim(NEW.destination_address), ''), now()
    )
    ON CONFLICT (customer_name, destination_city) DO UPDATE SET
      destination_address = COALESCE(EXCLUDED.destination_address, public.crossdocking_customer.destination_address),
      last_crossdocking_at = now(),
      updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS crossdocking_customer_sync ON public.crossdocking_header;
CREATE TRIGGER crossdocking_customer_sync
AFTER INSERT OR UPDATE OF customer_name, destination_city, destination_address
ON public.crossdocking_header
FOR EACH ROW EXECUTE FUNCTION public.sync_crossdocking_customer();

-- Seed the dedicated master from Crossdocking records that already exist.
INSERT INTO public.crossdocking_customer (
  customer_name, destination_city, destination_address, first_crossdocking_at, last_crossdocking_at
)
SELECT
  trim(customer_name), NULLIF(trim(destination_city), ''),
  NULLIF(trim(destination_address), ''), min(created_at), max(updated_at)
FROM public.crossdocking_header
WHERE NULLIF(trim(customer_name), '') IS NOT NULL
GROUP BY trim(customer_name), NULLIF(trim(destination_city), ''), NULLIF(trim(destination_address), '')
ON CONFLICT (customer_name, destination_city) DO UPDATE SET
  destination_address = COALESCE(EXCLUDED.destination_address, public.crossdocking_customer.destination_address),
  last_crossdocking_at = GREATEST(public.crossdocking_customer.last_crossdocking_at, EXCLUDED.last_crossdocking_at),
  updated_at = now();

CREATE INDEX IF NOT EXISTS crossdocking_customer_name_idx
  ON public.crossdocking_customer (customer_name);
