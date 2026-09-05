-- ============================================================================
-- SCM Control Tower — TMS Schema (PRD v1.3)
-- Jalankan di Supabase SQL Editor
--
-- Tabel BARU yang dibuat:
--   master_driver, master_transporter
--   crossdocking_header, crossdocking_detail
--   shipment_tracking (TMS — menggantikan/melengkapi tabel shipments)
--   delivery_pod
--
-- Tabel LAMA yang di-ALTER (hanya ADD COLUMN IF NOT EXISTS — aman):
--   transport_fleet — tambah kapasitas
--
-- TIDAK menyentuh: outbound_header/detail, receiving_header/detail,
--   customers, master_sku, vendors, routes, warehouses, issue_log,
--   warehouse_checklist, shipments (tabel lama tetap ada)
-- ============================================================================


-- ============================================================================
-- 1. MASTER DRIVER
--    Driver internal milik SRU (armada sendiri)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.master_driver (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  driver_code   text   NOT NULL UNIQUE,           -- mis. DRV-001
  driver_name   text   NOT NULL,
  sim_no        text,                             -- nomor SIM
  phone         text,
  is_active     boolean NOT NULL DEFAULT true,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS master_driver_active_idx
  ON public.master_driver (is_active);

COMMENT ON TABLE public.master_driver IS
  'Driver/pengemudi internal SRU. Untuk 2 unit truck milik cabang.';


-- ============================================================================
-- 2. MASTER TRANSPORTER
--    Internal (SRU) + 3 transporter eksternal
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.master_transporter (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  transporter_code text  NOT NULL UNIQUE,         -- mis. TRANS-INT-SRU, TRANS-EXT-001
  name             text  NOT NULL,
  type             text  NOT NULL DEFAULT 'Eksternal'
                   CHECK (type IN ('Internal', 'Eksternal')),
  service_model    text
                   CHECK (service_model IN ('Retail', 'Trucking', NULL)),
                   -- NULL untuk Internal (biaya operasional aktual, bukan per tarif)
  pic_name         text,
  pic_phone        text,
  pic_email        text,
  is_active        boolean NOT NULL DEFAULT true,
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.master_transporter IS
  'Master transporter: 1 Internal (SRU) + 3 Eksternal.
   service_model: Retail (per kg/tujuan), Trucking (per trip/FTL), NULL (Internal).';

-- Seed data awal — bisa diedit via UI setelah tabel dibuat
INSERT INTO public.master_transporter (transporter_code, name, type, service_model, notes)
VALUES
  ('TRANS-INT-SRU',  'Internal — SRU Medan',  'Internal',  NULL,       '2 unit truck milik cabang'),
  ('TRANS-EXT-001',  'Transporter Eksternal 1', 'Eksternal', 'Retail',   'Isi nama vendor aktual'),
  ('TRANS-EXT-002',  'Transporter Eksternal 2', 'Eksternal', 'Trucking', 'Isi nama vendor aktual'),
  ('TRANS-EXT-003',  'Transporter Eksternal 3', 'Eksternal', 'Retail',   'Isi nama vendor aktual')
ON CONFLICT (transporter_code) DO NOTHING;


-- ============================================================================
-- 3. ALTER transport_fleet — tambah field yang belum ada
-- ============================================================================
ALTER TABLE public.transport_fleet
  ADD COLUMN IF NOT EXISTS capacity_kg    numeric,
  ADD COLUMN IF NOT EXISTS capacity_cbm   numeric,
  ADD COLUMN IF NOT EXISTS brand          text,
  ADD COLUMN IF NOT EXISTS year           integer,
  ADD COLUMN IF NOT EXISTS is_active      boolean NOT NULL DEFAULT true;


-- ============================================================================
-- 4. CROSSDOCKING HEADER
--    Shipment dari Kantor Pusat yang transit via Medan — input manual
-- ============================================================================

-- Buat sequence DULU sebelum tabel yang menggunakannya
CREATE SEQUENCE IF NOT EXISTS public.crossdocking_seq START 1;

CREATE TABLE IF NOT EXISTS public.crossdocking_header (
  id                    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  crossdocking_no       text   NOT NULL UNIQUE
                        DEFAULT ('CD-' || to_char(now(), 'YYMM') || '-' || lpad(nextval('public.crossdocking_seq')::text, 4, '0')),
  customer_code         text   REFERENCES public.customers(customer_code) ON UPDATE CASCADE,
  customer_name         text,                    -- diisi manual jika belum ada di master
  destination_address   text,
  hq_reference_no       text,                    -- nomor dokumen dari Kantor Pusat (bebas)
  received_from_hq_date date   NOT NULL,
  promised_delivery_date date  NOT NULL,
  status                text   NOT NULL DEFAULT 'Draft'
                        CHECK (status IN ('Draft', 'Ready', 'Dispatched', 'Delivered')),
  notes                 text,
  created_by            text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- (sequence sudah dibuat di atas)

CREATE INDEX IF NOT EXISTS crossdocking_header_status_idx
  ON public.crossdocking_header (status);
CREATE INDEX IF NOT EXISTS crossdocking_header_date_idx
  ON public.crossdocking_header (promised_delivery_date DESC);

COMMENT ON TABLE public.crossdocking_header IS
  'Header crossdocking dari Kantor Pusat via Medan. Input manual — tidak dari NAV.';


-- ============================================================================
-- 5. CROSSDOCKING DETAIL
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.crossdocking_detail (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  crossdocking_id   bigint NOT NULL
                    REFERENCES public.crossdocking_header(id) ON DELETE CASCADE,
  item_no           text,                    -- FK logis ke master_sku, tapi nullable
  description       text,
  quantity          numeric NOT NULL DEFAULT 0,
  uom               text,
  lot_no            text,
  expiration_date   date,
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS crossdocking_detail_header_idx
  ON public.crossdocking_detail (crossdocking_id);

COMMENT ON TABLE public.crossdocking_detail IS
  'Detail item crossdocking. item_no logis ke master_sku, input manual diperbolehkan.';


-- ============================================================================
-- 6. SHIPMENT TRACKING (TMS)
--    Tabel baru yang melengkapi tabel shipments (lama).
--    Mencatat proses fisik pengiriman dari PSS/Crossdocking sampai POD.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.shipment_tracking (
  id                    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  -- Source
  source_type           text   NOT NULL DEFAULT 'PSS'
                        CHECK (source_type IN ('PSS', 'Crossdocking')),
  pss_no                text,                    -- FK logis ke outbound_header.pss_no
  crossdocking_id       bigint
                        REFERENCES public.crossdocking_header(id) ON DELETE SET NULL,
  outbound_header_id    bigint,                  -- FK logis ke outbound_header.id

  -- Trip grouping (untuk multi-drop)
  trip_id               text,                   -- diisi saat assign ke trip, misal "TRIP-20260904-01"

  -- Transporter & armada
  transporter_id        bigint
                        REFERENCES public.master_transporter(id) ON DELETE RESTRICT,
  vehicle_id            bigint
                        REFERENCES public.transport_fleet(id) ON DELETE SET NULL,
  driver_id             bigint
                        REFERENCES public.master_driver(id) ON DELETE SET NULL,
  route_id              bigint
                        REFERENCES public.routes(id) ON DELETE SET NULL,

  -- Customer tujuan
  customer_code         text,
  customer_name         text,
  destination_address   text,
  destination_city      text,

  -- Dates dari NAV / Crossdocking
  document_date         date,
  promised_delivery_date date,

  -- Status & timeline aktual
  status                text   NOT NULL DEFAULT 'Draft'
                        CHECK (status IN ('Draft', 'Dispatched', 'In Transit', 'Delivered')),
  dispatch_time         timestamptz,             -- waktu aktual keluar gudang
  delivery_time         timestamptz,             -- waktu aktual sampai pelanggan
  is_on_time            boolean GENERATED ALWAYS AS (
                          CASE
                            WHEN delivery_time IS NULL OR promised_delivery_date IS NULL THEN NULL
                            WHEN delivery_time::date <= promised_delivery_date THEN true
                            ELSE false
                          END
                        ) STORED,

  -- Biaya & muatan
  weight_kg             numeric,                 -- berat kiriman (basis biaya Retail)
  trip_cost             numeric,                 -- biaya aktual per shipment/trip
  cost_model            text
                        CHECK (cost_model IN ('Internal', 'Retail', 'Trucking', NULL)),

  -- Metadata
  notes                 text,
  created_by            text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shipment_tracking_status_idx
  ON public.shipment_tracking (status);
CREATE INDEX IF NOT EXISTS shipment_tracking_pss_idx
  ON public.shipment_tracking (pss_no)
  WHERE pss_no IS NOT NULL;
CREATE INDEX IF NOT EXISTS shipment_tracking_trip_idx
  ON public.shipment_tracking (trip_id)
  WHERE trip_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS shipment_tracking_date_idx
  ON public.shipment_tracking (promised_delivery_date DESC);

COMMENT ON TABLE public.shipment_tracking IS
  'TMS: Tracking pengiriman aktual per shipment.
   source_type: PSS (dari outbound_header) atau Crossdocking (input manual).
   is_on_time: GENERATED dari delivery_time vs promised_delivery_date.
   Tabel lama shipments tetap ada untuk backward compat.';


-- ============================================================================
-- 7. DELIVERY POD
--    Bukti serah terima per shipment
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.delivery_pod (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tracking_id     bigint NOT NULL
                  REFERENCES public.shipment_tracking(id) ON DELETE CASCADE,
  receiver_name   text   NOT NULL,
  received_at     timestamptz NOT NULL DEFAULT now(),
  photo_url       text,                      -- URL ke Supabase Storage
  signature_url   text,                      -- tanda tangan digital (opsional)
  notes           text,
  input_by        text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tracking_id)                       -- satu shipment satu POD
);

COMMENT ON TABLE public.delivery_pod IS
  'Proof of Delivery per shipment_tracking. Satu shipment satu POD record.';


-- ============================================================================
-- 8. UPDATED_AT TRIGGERS
-- ============================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DO $$ DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'master_driver', 'master_transporter',
    'crossdocking_header', 'shipment_tracking'
  ]) LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS %I ON public.%I;
       CREATE TRIGGER %I BEFORE UPDATE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();',
      t || '_updated_at', t, t || '_updated_at', t
    );
  END LOOP;
END; $$;


-- ============================================================================
-- 9. RLS
-- ============================================================================
ALTER TABLE public.master_driver       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_transporter  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crossdocking_header ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crossdocking_detail ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipment_tracking   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_pod        ENABLE ROW LEVEL SECURITY;

-- Authenticated read semua
DO $$ DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'master_driver', 'master_transporter',
    'crossdocking_header', 'crossdocking_detail',
    'shipment_tracking', 'delivery_pod'
  ]) LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS "authenticated read" ON public.%I;
       CREATE POLICY "authenticated read" ON public.%I
       FOR SELECT TO authenticated USING (true);',
      t, t
    );
  END LOOP;
END; $$;
-- service_role bypass RLS otomatis — tidak perlu policy eksplisit


-- ============================================================================
-- 10. VIEW: vw_shipment_tms
--    Dashboard shipment tracking dengan info lengkap
-- ============================================================================
CREATE OR REPLACE VIEW public.vw_shipment_tms AS
SELECT
  st.id,
  st.source_type,
  st.pss_no,
  st.crossdocking_id,
  st.trip_id,
  st.status,
  st.customer_code,
  st.customer_name,
  st.destination_city,
  st.document_date,
  st.promised_delivery_date,
  st.dispatch_time,
  st.delivery_time,
  st.is_on_time,
  st.weight_kg,
  st.trip_cost,
  st.cost_model,
  tr.name          AS transporter_name,
  tr.type          AS transporter_type,
  tr.service_model AS transporter_service_model,
  tf.vehicle_no,
  tf.vehicle_type,
  md.driver_name,
  md.phone         AS driver_phone,
  r.route_code,
  r.origin         AS route_origin,
  r.destination    AS route_destination,
  st.notes,
  st.created_at
FROM public.shipment_tracking st
LEFT JOIN public.master_transporter tr ON tr.id = st.transporter_id
LEFT JOIN public.transport_fleet    tf ON tf.id = st.vehicle_id
LEFT JOIN public.master_driver      md ON md.id = st.driver_id
LEFT JOIN public.routes              r ON r.id  = st.route_id;

COMMENT ON VIEW public.vw_shipment_tms IS
  'Shipment tracking dengan join ke transporter, vehicle, driver, dan route.';


-- ============================================================================
-- SELESAI — ringkasan:
--   master_driver         — driver internal SRU
--   master_transporter    — 1 Internal + 3 Eksternal (Retail/Trucking)
--   crossdocking_header   — header crossdocking input manual
--   crossdocking_detail   — detail item crossdocking
--   shipment_tracking     — TMS tracking aktual (source: PSS / Crossdocking)
--   delivery_pod          — POD per shipment_tracking
--   ALTER transport_fleet — tambah capacity_kg, capacity_cbm, brand, year, is_active
--   vw_shipment_tms       — view gabungan untuk dashboard TMS
-- ============================================================================
