-- Part 2a: crossdocking sequence, header, detail
-- Jalankan ini dulu, cek sukses.

CREATE SEQUENCE IF NOT EXISTS public.crossdocking_seq START 1;

CREATE TABLE IF NOT EXISTS public.crossdocking_header (
  id                     bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  crossdocking_no        text NOT NULL UNIQUE
                         DEFAULT ('CD-' || to_char(now(),'YYMM') || '-' || lpad(nextval('public.crossdocking_seq')::text,4,'0')),
  customer_code          text REFERENCES public.customers(customer_code) ON UPDATE CASCADE,
  customer_name          text,
  destination_address    text,
  hq_reference_no        text,
  received_from_hq_date  date NOT NULL,
  promised_delivery_date date NOT NULL,
  status                 text NOT NULL DEFAULT 'Draft'
                         CHECK (status IN ('Draft','Ready','Dispatched','Delivered')),
  notes                  text,
  created_by             text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS crossdocking_header_status_idx ON public.crossdocking_header (status);
CREATE INDEX IF NOT EXISTS crossdocking_header_date_idx   ON public.crossdocking_header (promised_delivery_date DESC);

DROP TRIGGER IF EXISTS crossdocking_header_updated_at ON public.crossdocking_header;
CREATE TRIGGER crossdocking_header_updated_at
  BEFORE UPDATE ON public.crossdocking_header
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.crossdocking_header ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated read" ON public.crossdocking_header;
CREATE POLICY "authenticated read" ON public.crossdocking_header
  FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.crossdocking_detail (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  crossdocking_id bigint NOT NULL REFERENCES public.crossdocking_header(id) ON DELETE CASCADE,
  item_no         text,
  description     text,
  quantity        numeric NOT NULL DEFAULT 0,
  uom             text,
  lot_no          text,
  expiration_date date,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS crossdocking_detail_header_idx ON public.crossdocking_detail (crossdocking_id);

ALTER TABLE public.crossdocking_detail ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated read" ON public.crossdocking_detail;
CREATE POLICY "authenticated read" ON public.crossdocking_detail
  FOR SELECT TO authenticated USING (true);
