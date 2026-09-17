-- Staging PTS untuk Crossdocking.
-- PTS diunggah terlebih dahulu; customer dan alamat tujuan dapat ditentukan kemudian.

CREATE TABLE IF NOT EXISTS public.crossdocking_pts (
  id                    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  pts_no                text NOT NULL UNIQUE,
  document_date         date,
  document_created_at   timestamptz,
  transfer_order_no     text,
  customer_name         text,
  destination_city      text,
  destination_address   text,
  status                text NOT NULL DEFAULT 'Menunggu Tujuan'
                        CHECK (status IN ('Menunggu Tujuan', 'Crossdocking Dibuat')),
  crossdocking_id       bigint REFERENCES public.crossdocking_header(id) ON DELETE SET NULL,
  source_file_name      text,
  uploaded_at           timestamptz NOT NULL DEFAULT now(),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS crossdocking_pts_status_idx
  ON public.crossdocking_pts (status);
CREATE INDEX IF NOT EXISTS crossdocking_pts_uploaded_at_idx
  ON public.crossdocking_pts (uploaded_at DESC);

CREATE TABLE IF NOT EXISTS public.crossdocking_pts_detail (
  id                    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  crossdocking_pts_id  bigint NOT NULL REFERENCES public.crossdocking_pts(id) ON DELETE CASCADE,
  nav_entry_no          bigint,
  document_line_no      integer,
  item_no               text,
  variant_code          text,
  description           text,
  quantity              numeric NOT NULL DEFAULT 0,
  lot_no                text,
  expiration_date       date,
  source_location_code  text,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS crossdocking_pts_detail_pts_idx
  ON public.crossdocking_pts_detail (crossdocking_pts_id);

DROP TRIGGER IF EXISTS crossdocking_pts_updated_at ON public.crossdocking_pts;
CREATE TRIGGER crossdocking_pts_updated_at
  BEFORE UPDATE ON public.crossdocking_pts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.crossdocking_pts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated read" ON public.crossdocking_pts;
CREATE POLICY "authenticated read" ON public.crossdocking_pts
  FOR SELECT TO authenticated USING (true);

COMMENT ON TABLE public.crossdocking_pts IS
  'Header PTS hasil unggahan NAV sebelum customer dan alamat kirim ditentukan.';
COMMENT ON TABLE public.crossdocking_pts_detail IS
  'Detail item, lot, kedaluwarsa, dan quantity dari NAV Item Ledger Entry untuk setiap PTS.';
