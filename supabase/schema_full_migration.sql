-- ============================================================================
-- SCM Control Tower — FULL MIGRATION (TMS v1.3 + v1.5)
-- Tanggal: September 2026
--
-- GUNAKAN FILE INI jika belum pernah menjalankan schema_tms.sql sebelumnya.
-- File ini menggabungkan schema_tms.sql + schema_v15.sql dalam urutan yang benar.
--
-- AMAN dijalankan: semua DDL pakai CREATE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS.
-- Tidak menghapus tabel, kolom, atau data yang sudah ada.
--
-- Prasyarat (tabel yang harus sudah ada sebelum menjalankan ini):
--   customers, master_sku, routes, warehouses, transport_fleet,
--   outbound_header, receiving_header, issue_log, shipments
-- ============================================================================


-- ============================================================================
-- BAGIAN 1: FUNGSI set_updated_at (diperlukan untuk trigger)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


-- ============================================================================
-- BAGIAN 2: MASTER DRIVER
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.master_driver (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  driver_code   text   NOT NULL UNIQUE,
  driver_name   text   NOT NULL,
  role          text   NOT NULL DEFAULT 'Driver'
                CHECK (role IN ('Driver', 'Helper')),
  sim_no        text,
  phone         text,
  is_active     boolean NOT NULL DEFAULT true,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS master_driver_active_idx
  ON public.master_driver (is_active);

-- Jika tabel sudah ada tapi belum punya kolom role, tambahkan
ALTER TABLE public.master_driver
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'Driver'
    CHECK (role IN ('Driver', 'Helper'));

DROP TRIGGER IF EXISTS master_driver_updated_at ON public.master_driver;
CREATE TRIGGER master_driver_updated_at
  BEFORE UPDATE ON public.master_driver
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.master_driver ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated read" ON public.master_driver;
CREATE POLICY "authenticated read" ON public.master_driver
  FOR SELECT TO authenticated USING (true);

COMMENT ON TABLE  public.master_driver      IS 'Driver & Helper internal SRU. role: Driver | Helper.';
COMMENT ON COLUMN public.master_driver.role IS 'Driver = pengemudi utama, Helper = pembantu/kru.';


-- ============================================================================
-- BAGIAN 3: MASTER TRANSPORTER
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.master_transporter (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  transporter_code text   NOT NULL UNIQUE,
  name             text   NOT NULL,
  type             text   NOT NULL DEFAULT 'Eksternal'
                   CHECK (type IN ('Internal', 'Eksternal')),
  service_model    text
                   CHECK (service_model IN ('Retail', 'Trucking', NULL)),
  pic_name         text,
  pic_phone        text,
  pic_email        text,
  is_active        boolean NOT NULL DEFAULT true,
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS master_transporter_updated_at ON public.master_transporter;
CREATE TRIGGER master_transporter_updated_at
  BEFORE UPDATE ON public.master_transporter
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.master_transporter ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated read" ON public.master_transporter;
CREATE POLICY "authenticated read" ON public.master_transporter
  FOR SELECT TO authenticated USING (true);

-- Seed data awal (skip jika sudah ada)
INSERT INTO public.master_transporter (transporter_code, name, type, service_model, notes)
VALUES
  ('TRANS-INT-SRU',  'Internal — SRU Medan',    'Internal',  NULL,       '2 unit truck milik cabang'),
  ('TRANS-EXT-001',  'Transporter Eksternal 1',  'Eksternal', 'Retail',   'Isi nama vendor aktual'),
  ('TRANS-EXT-002',  'Transporter Eksternal 2',  'Eksternal', 'Trucking', 'Isi nama vendor aktual'),
  ('TRANS-EXT-003',  'Transporter Eksternal 3',  'Eksternal', 'Retail',   'Isi nama vendor aktual')
ON CONFLICT (transporter_code) DO NOTHING;


-- ============================================================================
-- BAGIAN 4: ALTER transport_fleet — tambah kolom kapasitas jika belum ada
-- Setiap kolom di-handle dalam DO block terpisah untuk isolasi error.
-- ============================================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='transport_fleet' AND column_name='capacity_kg') THEN
    ALTER TABLE public.transport_fleet ADD COLUMN capacity_kg numeric;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='transport_fleet' AND column_name='capacity_cbm') THEN
    ALTER TABLE public.transport_fleet ADD COLUMN capacity_cbm numeric;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='transport_fleet' AND column_name='brand') THEN
    ALTER TABLE public.transport_fleet ADD COLUMN brand text;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='transport_fleet' AND column_name='year') THEN
    ALTER TABLE public.transport_fleet ADD COLUMN year integer;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='transport_fleet' AND column_name='is_active') THEN
    ALTER TABLE public.transport_fleet ADD COLUMN is_active boolean DEFAULT true;
  END IF;
END $$;


-- ============================================================================
-- BAGIAN 5: CROSSDOCKING SEQUENCE & HEADER
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS public.crossdocking_seq START 1;

CREATE TABLE IF NOT EXISTS public.crossdocking_header (
  id                    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  crossdocking_no       text   NOT NULL UNIQUE
                        DEFAULT ('CD-' || to_char(now(), 'YYMM') || '-' ||
                                 lpad(nextval('public.crossdocking_seq')::text, 4, '0')),
  customer_code         text   REFERENCES public.customers(customer_code) ON UPDATE CASCADE,
  customer_name         text,
  destination_address   text,
  hq_reference_no       text,
  received_from_hq_date date   NOT NULL,
  promised_delivery_date date  NOT NULL,
  status                text   NOT NULL DEFAULT 'Draft'
                        CHECK (status IN ('Draft', 'Ready', 'Dispatched', 'Delivered')),
  notes                 text,
  created_by            text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS crossdocking_header_status_idx
  ON public.crossdocking_header (status);
CREATE INDEX IF NOT EXISTS crossdocking_header_date_idx
  ON public.crossdocking_header (promised_delivery_date DESC);

DROP TRIGGER IF EXISTS crossdocking_header_updated_at ON public.crossdocking_header;
CREATE TRIGGER crossdocking_header_updated_at
  BEFORE UPDATE ON public.crossdocking_header
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.crossdocking_header ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated read" ON public.crossdocking_header;
CREATE POLICY "authenticated read" ON public.crossdocking_header
  FOR SELECT TO authenticated USING (true);


-- ============================================================================
-- BAGIAN 6: CROSSDOCKING DETAIL
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.crossdocking_detail (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  crossdocking_id bigint NOT NULL
                  REFERENCES public.crossdocking_header(id) ON DELETE CASCADE,
  item_no         text,
  description     text,
  quantity        numeric NOT NULL DEFAULT 0,
  uom             text,
  lot_no          text,
  expiration_date date,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS crossdocking_detail_header_idx
  ON public.crossdocking_detail (crossdocking_id);

ALTER TABLE public.crossdocking_detail ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated read" ON public.crossdocking_detail;
CREATE POLICY "authenticated read" ON public.crossdocking_detail
  FOR SELECT TO authenticated USING (true);


-- ============================================================================
-- BAGIAN 7: SHIPMENT TRACKING
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.shipment_tracking (
  id                    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  -- Source
  source_type           text   NOT NULL DEFAULT 'PSS'
                        CHECK (source_type IN ('PSS', 'Crossdocking')),
  pss_no                text,
  crossdocking_id       bigint
                        REFERENCES public.crossdocking_header(id) ON DELETE SET NULL,
  outbound_header_id    bigint,

  -- Trip grouping
  trip_id               text,

  -- Transporter & armada
  transporter_id        bigint
                        REFERENCES public.master_transporter(id) ON DELETE RESTRICT,
  vehicle_id            bigint
                        REFERENCES public.transport_fleet(id) ON DELETE SET NULL,
  driver_id             bigint
                        REFERENCES public.master_driver(id) ON DELETE SET NULL,
  helper_id             bigint
                        REFERENCES public.master_driver(id) ON DELETE SET NULL,
  route_id              bigint
                        REFERENCES public.routes(id) ON DELETE SET NULL,

  -- Customer tujuan
  customer_code         text,
  customer_name         text,
  destination_address   text,
  destination_city      text,
  dk_lk                 text CHECK (dk_lk IN ('DK', 'LK', NULL)),

  -- Dates
  document_date         date,
  promised_delivery_date date,

  -- Status & timeline
  status                text   NOT NULL DEFAULT 'Draft'
                        CHECK (status IN ('Draft', 'Dispatched', 'In Transit', 'Delivered')),
  dispatch_time         timestamptz,
  delivery_time         timestamptz,
  is_on_time            boolean GENERATED ALWAYS AS (
                          CASE
                            WHEN delivery_time IS NULL OR promised_delivery_date IS NULL THEN NULL
                            WHEN delivery_time::date <= promised_delivery_date THEN true
                            ELSE false
                          END
                        ) STORED,

  -- Biaya & muatan
  weight_kg             numeric,
  trip_cost             numeric,   -- kolom lama, tetap ada
  cost_model            text CHECK (cost_model IN ('Internal', 'Retail', 'Trucking', NULL)),

  -- No. Payment Voucher
  payment_voucher_no    text,

  -- Komponen biaya Internal
  bbm_liter             numeric,
  bbm_rupiah            numeric,
  bongkar_muat_cost     numeric,
  hotel_cost            numeric,
  uang_makan_driver     numeric,
  uang_makan_helper     numeric,
  toll_cost             numeric,
  parkir_cost           numeric,
  kirim_paket_cost      numeric,

  -- Biaya Eksternal
  invoice_no_eksternal  text,
  total_biaya_eksternal numeric,

  -- Invoice Value
  invoice_value         numeric,

  -- GENERATED: total_biaya
  total_biaya           numeric GENERATED ALWAYS AS (
                          CASE
                            WHEN cost_model = 'Internal' OR cost_model IS NULL THEN
                              COALESCE(bbm_rupiah, 0) + COALESCE(bongkar_muat_cost, 0)
                              + COALESCE(hotel_cost, 0) + COALESCE(uang_makan_driver, 0)
                              + COALESCE(uang_makan_helper, 0) + COALESCE(toll_cost, 0)
                              + COALESCE(parkir_cost, 0) + COALESCE(kirim_paket_cost, 0)
                            ELSE
                              COALESCE(total_biaya_eksternal, 0)
                          END
                        ) STORED,

  -- GENERATED: cost_ratio
  cost_ratio            numeric GENERATED ALWAYS AS (
                          CASE
                            WHEN invoice_value IS NOT NULL AND invoice_value > 0 THEN
                              CASE
                                WHEN cost_model = 'Internal' OR cost_model IS NULL THEN
                                  ROUND((
                                    COALESCE(bbm_rupiah, 0) + COALESCE(bongkar_muat_cost, 0)
                                    + COALESCE(hotel_cost, 0) + COALESCE(uang_makan_driver, 0)
                                    + COALESCE(uang_makan_helper, 0) + COALESCE(toll_cost, 0)
                                    + COALESCE(parkir_cost, 0) + COALESCE(kirim_paket_cost, 0)
                                  ) / invoice_value * 100, 2)
                                ELSE
                                  ROUND(COALESCE(total_biaya_eksternal, 0) / invoice_value * 100, 2)
                              END
                            ELSE NULL
                          END
                        ) STORED,

  -- Metadata
  notes                 text,
  created_by            text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shipment_tracking_status_idx
  ON public.shipment_tracking (status);
CREATE INDEX IF NOT EXISTS shipment_tracking_pss_idx
  ON public.shipment_tracking (pss_no) WHERE pss_no IS NOT NULL;
CREATE INDEX IF NOT EXISTS shipment_tracking_trip_idx
  ON public.shipment_tracking (trip_id) WHERE trip_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS shipment_tracking_date_idx
  ON public.shipment_tracking (promised_delivery_date DESC);

DROP TRIGGER IF EXISTS shipment_tracking_updated_at ON public.shipment_tracking;
CREATE TRIGGER shipment_tracking_updated_at
  BEFORE UPDATE ON public.shipment_tracking
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.shipment_tracking ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated read" ON public.shipment_tracking;
CREATE POLICY "authenticated read" ON public.shipment_tracking
  FOR SELECT TO authenticated USING (true);


-- ============================================================================
-- BAGIAN 8: DELIVERY POD
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.delivery_pod (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tracking_id   bigint NOT NULL
                REFERENCES public.shipment_tracking(id) ON DELETE CASCADE,
  receiver_name text   NOT NULL,
  received_at   timestamptz NOT NULL DEFAULT now(),
  photo_url     text,
  signature_url text,
  notes         text,
  input_by      text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tracking_id)
);

ALTER TABLE public.delivery_pod ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated read" ON public.delivery_pod;
CREATE POLICY "authenticated read" ON public.delivery_pod
  FOR SELECT TO authenticated USING (true);


-- ============================================================================
-- BAGIAN 9: ALTER TABEL YANG SUDAH ADA (v1.5)
-- ============================================================================

-- 9a. customers — tambah is_hd_customer
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS is_hd_customer boolean NOT NULL DEFAULT false;

-- Auto-set is_hd_customer = true jika machine_count > 0
UPDATE public.customers
  SET is_hd_customer = true
  WHERE (machine_count IS NOT NULL AND machine_count > 0)
    AND is_hd_customer = false;

-- 9b. outbound_header — tambah psi_no
ALTER TABLE public.outbound_header
  ADD COLUMN IF NOT EXISTS psi_no text;

CREATE INDEX IF NOT EXISTS outbound_header_psi_no_idx
  ON public.outbound_header (psi_no) WHERE psi_no IS NOT NULL;

-- 9c. shipment_tracking — tambah kolom v1.5 yang mungkin belum ada
--     (jika tabel baru dibuat di atas, kolom ini sudah ada — IF NOT EXISTS aman)
ALTER TABLE public.shipment_tracking
  ADD COLUMN IF NOT EXISTS helper_id bigint
    REFERENCES public.master_driver(id) ON DELETE SET NULL;
ALTER TABLE public.shipment_tracking
  ADD COLUMN IF NOT EXISTS dk_lk text CHECK (dk_lk IN ('DK', 'LK', NULL));
ALTER TABLE public.shipment_tracking
  ADD COLUMN IF NOT EXISTS payment_voucher_no text;
ALTER TABLE public.shipment_tracking
  ADD COLUMN IF NOT EXISTS bbm_liter numeric;
ALTER TABLE public.shipment_tracking
  ADD COLUMN IF NOT EXISTS bbm_rupiah numeric;
ALTER TABLE public.shipment_tracking
  ADD COLUMN IF NOT EXISTS bongkar_muat_cost numeric;
ALTER TABLE public.shipment_tracking
  ADD COLUMN IF NOT EXISTS hotel_cost numeric;
ALTER TABLE public.shipment_tracking
  ADD COLUMN IF NOT EXISTS uang_makan_driver numeric;
ALTER TABLE public.shipment_tracking
  ADD COLUMN IF NOT EXISTS uang_makan_helper numeric;
ALTER TABLE public.shipment_tracking
  ADD COLUMN IF NOT EXISTS toll_cost numeric;
ALTER TABLE public.shipment_tracking
  ADD COLUMN IF NOT EXISTS parkir_cost numeric;
ALTER TABLE public.shipment_tracking
  ADD COLUMN IF NOT EXISTS kirim_paket_cost numeric;
ALTER TABLE public.shipment_tracking
  ADD COLUMN IF NOT EXISTS invoice_no_eksternal text;
ALTER TABLE public.shipment_tracking
  ADD COLUMN IF NOT EXISTS total_biaya_eksternal numeric;
ALTER TABLE public.shipment_tracking
  ADD COLUMN IF NOT EXISTS invoice_value numeric;

-- GENERATED columns: hanya tambahkan jika belum ada
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'shipment_tracking' AND column_name = 'total_biaya'
  ) THEN
    ALTER TABLE public.shipment_tracking
      ADD COLUMN total_biaya numeric GENERATED ALWAYS AS (
        CASE
          WHEN cost_model = 'Internal' OR cost_model IS NULL THEN
            COALESCE(bbm_rupiah, 0) + COALESCE(bongkar_muat_cost, 0)
            + COALESCE(hotel_cost, 0) + COALESCE(uang_makan_driver, 0)
            + COALESCE(uang_makan_helper, 0) + COALESCE(toll_cost, 0)
            + COALESCE(parkir_cost, 0) + COALESCE(kirim_paket_cost, 0)
          ELSE COALESCE(total_biaya_eksternal, 0)
        END
      ) STORED;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'shipment_tracking' AND column_name = 'cost_ratio'
  ) THEN
    ALTER TABLE public.shipment_tracking
      ADD COLUMN cost_ratio numeric GENERATED ALWAYS AS (
        CASE
          WHEN invoice_value IS NOT NULL AND invoice_value > 0 THEN
            CASE
              WHEN cost_model = 'Internal' OR cost_model IS NULL THEN
                ROUND((
                  COALESCE(bbm_rupiah, 0) + COALESCE(bongkar_muat_cost, 0)
                  + COALESCE(hotel_cost, 0) + COALESCE(uang_makan_driver, 0)
                  + COALESCE(uang_makan_helper, 0) + COALESCE(toll_cost, 0)
                  + COALESCE(parkir_cost, 0) + COALESCE(kirim_paket_cost, 0)
                ) / invoice_value * 100, 2)
              ELSE ROUND(COALESCE(total_biaya_eksternal, 0) / invoice_value * 100, 2)
            END
          ELSE NULL
        END
      ) STORED;
  END IF;
END $$;

-- master_driver — tambah role jika belum ada (untuk DB yang punya tabel lama tanpa role)
ALTER TABLE public.master_driver
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'Driver'
    CHECK (role IN ('Driver', 'Helper'));


-- ============================================================================
-- BAGIAN 10: HD STOCK MONITORING (baru v1.5)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.hd_stock_monitoring (
  id                            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id                   bigint NOT NULL
                                REFERENCES public.customers(id) ON DELETE CASCADE,
  snapshot_date                 date   NOT NULL DEFAULT CURRENT_DATE,
  treatment_per_day_per_machine integer NOT NULL DEFAULT 2,
  working_days_per_month        integer NOT NULL DEFAULT 25,
  safety_stock_days             integer NOT NULL DEFAULT 6,
  rop_days                      integer NOT NULL DEFAULT 8,
  lead_time_reorder_days        integer NOT NULL DEFAULT 9,
  last_known_stock_date         date,
  last_known_stock_qty          numeric NOT NULL DEFAULT 0,
  last_shipment_date            date,
  last_shipment_qty             numeric NOT NULL DEFAULT 0,
  notes                         text,
  created_at                    timestamptz NOT NULL DEFAULT now(),
  updated_at                    timestamptz NOT NULL DEFAULT now(),

  -- GENERATED columns
  daily_usage numeric GENERATED ALWAYS AS (
    (SELECT machine_count FROM public.customers c WHERE c.id = customer_id)
    * treatment_per_day_per_machine
  ) STORED,
  monthly_need numeric GENERATED ALWAYS AS (
    (SELECT machine_count FROM public.customers c WHERE c.id = customer_id)
    * treatment_per_day_per_machine * working_days_per_month
  ) STORED,
  safety_stock_qty numeric GENERATED ALWAYS AS (
    (SELECT machine_count FROM public.customers c WHERE c.id = customer_id)
    * treatment_per_day_per_machine * safety_stock_days
  ) STORED,
  rop_qty numeric GENERATED ALWAYS AS (
    (SELECT machine_count FROM public.customers c WHERE c.id = customer_id)
    * treatment_per_day_per_machine * rop_days
  ) STORED,
  estimated_stock numeric GENERATED ALWAYS AS (
    last_known_stock_qty + last_shipment_qty
  ) STORED,
  doi_days numeric GENERATED ALWAYS AS (
    CASE
      WHEN (SELECT machine_count FROM public.customers c WHERE c.id = customer_id) > 0
        AND treatment_per_day_per_machine > 0
      THEN (last_known_stock_qty + last_shipment_qty)
           / ((SELECT machine_count FROM public.customers c WHERE c.id = customer_id)
              * treatment_per_day_per_machine)
      ELSE NULL
    END
  ) STORED,
  estimated_stockout_date date GENERATED ALWAYS AS (
    CASE
      WHEN last_shipment_date IS NOT NULL
        AND (SELECT machine_count FROM public.customers c WHERE c.id = customer_id) > 0
        AND treatment_per_day_per_machine > 0
      THEN last_shipment_date + INTERVAL '1 day' * FLOOR(
             (last_known_stock_qty + last_shipment_qty)
             / ((SELECT machine_count FROM public.customers c WHERE c.id = customer_id)
                * treatment_per_day_per_machine)
           )
      ELSE NULL
    END
  ) STORED,
  available_stock numeric GENERATED ALWAYS AS (
    (last_known_stock_qty + last_shipment_qty)
    - ((SELECT machine_count FROM public.customers c WHERE c.id = customer_id)
       * treatment_per_day_per_machine * rop_days)
  ) STORED,
  available_days numeric GENERATED ALWAYS AS (
    CASE
      WHEN (SELECT machine_count FROM public.customers c WHERE c.id = customer_id) > 0
        AND treatment_per_day_per_machine > 0
      THEN (
        (last_known_stock_qty + last_shipment_qty)
        - ((SELECT machine_count FROM public.customers c WHERE c.id = customer_id)
           * treatment_per_day_per_machine * rop_days)
      ) / ((SELECT machine_count FROM public.customers c WHERE c.id = customer_id)
           * treatment_per_day_per_machine)
      ELSE NULL
    END
  ) STORED,
  fu_po_date date GENERATED ALWAYS AS (
    CASE
      WHEN last_shipment_date IS NOT NULL
        AND (SELECT machine_count FROM public.customers c WHERE c.id = customer_id) > 0
        AND treatment_per_day_per_machine > 0
      THEN (
        last_shipment_date + INTERVAL '1 day' * FLOOR(
          (last_known_stock_qty + last_shipment_qty)
          / ((SELECT machine_count FROM public.customers c WHERE c.id = customer_id)
             * treatment_per_day_per_machine)
        )
      ) - INTERVAL '1 day' * lead_time_reorder_days
      ELSE NULL
    END
  ) STORED
);

CREATE INDEX IF NOT EXISTS hd_stock_monitoring_customer_idx
  ON public.hd_stock_monitoring (customer_id);
CREATE INDEX IF NOT EXISTS hd_stock_monitoring_snapshot_date_idx
  ON public.hd_stock_monitoring (snapshot_date DESC);
CREATE INDEX IF NOT EXISTS hd_stock_monitoring_fu_po_idx
  ON public.hd_stock_monitoring (fu_po_date) WHERE fu_po_date IS NOT NULL;

DROP TRIGGER IF EXISTS hd_stock_monitoring_updated_at ON public.hd_stock_monitoring;
CREATE TRIGGER hd_stock_monitoring_updated_at
  BEFORE UPDATE ON public.hd_stock_monitoring
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.hd_stock_monitoring ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated read" ON public.hd_stock_monitoring;
CREATE POLICY "authenticated read" ON public.hd_stock_monitoring
  FOR SELECT TO authenticated USING (true);


-- ============================================================================
-- BAGIAN 11: BUDGET REQUEST (baru v1.5)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.budget_request (
  id                     bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  period                 text   NOT NULL UNIQUE,
  lk_amount_projected    numeric,
  dk_amount_projected    numeric,
  total_projected        numeric GENERATED ALWAYS AS (
                           COALESCE(lk_amount_projected, 0)
                           + COALESCE(dk_amount_projected, 0)
                         ) STORED,
  buffer_amount          numeric,
  subtotal               numeric GENERATED ALWAYS AS (
                           COALESCE(lk_amount_projected, 0)
                           + COALESCE(dk_amount_projected, 0)
                           + COALESCE(buffer_amount, 0)
                         ) STORED,
  rounded_request_amount numeric,
  bank_name              text,
  bank_account_no        text,
  bank_account_holder    text,
  notes                  text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS budget_request_period_idx
  ON public.budget_request (period DESC);

DROP TRIGGER IF EXISTS budget_request_updated_at ON public.budget_request;
CREATE TRIGGER budget_request_updated_at
  BEFORE UPDATE ON public.budget_request
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.budget_request ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated read" ON public.budget_request;
CREATE POLICY "authenticated read" ON public.budget_request
  FOR SELECT TO authenticated USING (true);


-- ============================================================================
-- BAGIAN 12: BUDGET APPROVAL LOG (baru v1.5)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.budget_approval_log (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  budget_request_id bigint NOT NULL
                    REFERENCES public.budget_request(id) ON DELETE CASCADE,
  approver_name     text   NOT NULL,
  sequence_no       integer NOT NULL DEFAULT 1,
  status            text   NOT NULL DEFAULT 'Pending'
                    CHECK (status IN ('Pending', 'Approved')),
  approved_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS budget_approval_log_request_idx
  ON public.budget_approval_log (budget_request_id);

ALTER TABLE public.budget_approval_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated read" ON public.budget_approval_log;
CREATE POLICY "authenticated read" ON public.budget_approval_log
  FOR SELECT TO authenticated USING (true);


-- ============================================================================
-- BAGIAN 13: VIEW vw_shipment_tms (replace — versi lengkap v1.5)
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
  st.dk_lk,
  st.document_date,
  st.promised_delivery_date,
  st.dispatch_time,
  st.delivery_time,
  st.is_on_time,
  st.weight_kg,
  st.cost_model,
  st.payment_voucher_no,
  st.bbm_liter,
  st.bbm_rupiah,
  st.bongkar_muat_cost,
  st.hotel_cost,
  st.uang_makan_driver,
  st.uang_makan_helper,
  st.toll_cost,
  st.parkir_cost,
  st.kirim_paket_cost,
  st.invoice_no_eksternal,
  st.total_biaya_eksternal,
  st.invoice_value,
  st.total_biaya,
  st.cost_ratio,
  st.trip_cost,
  tr.name          AS transporter_name,
  tr.type          AS transporter_type,
  tr.service_model AS transporter_service_model,
  tf.vehicle_no,
  tf.vehicle_type,
  md.driver_name,
  md.phone         AS driver_phone,
  mh.driver_name   AS helper_name,
  mh.phone         AS helper_phone,
  r.route_code,
  r.origin         AS route_origin,
  r.destination    AS route_destination,
  st.notes,
  st.created_at,
  st.updated_at
FROM public.shipment_tracking st
LEFT JOIN public.master_transporter tr ON tr.id = st.transporter_id
LEFT JOIN public.transport_fleet    tf ON tf.id = st.vehicle_id
LEFT JOIN public.master_driver      md ON md.id = st.driver_id
LEFT JOIN public.master_driver      mh ON mh.id = st.helper_id
LEFT JOIN public.routes              r ON r.id  = st.route_id;


-- ============================================================================
-- SELESAI
-- Tabel yang dibuat/diubah:
--   master_driver         (CREATE + ADD COLUMN role)
--   master_transporter    (CREATE + seed 4 baris)
--   transport_fleet       (ALTER — tambah capacity, brand, year, is_active)
--   crossdocking_header   (CREATE)
--   crossdocking_detail   (CREATE)
--   shipment_tracking     (CREATE — sudah include semua kolom v1.5)
--   delivery_pod          (CREATE)
--   customers             (ALTER — tambah is_hd_customer)
--   outbound_header       (ALTER — tambah psi_no)
--   hd_stock_monitoring   (CREATE)
--   budget_request        (CREATE)
--   budget_approval_log   (CREATE)
--   vw_shipment_tms       (REPLACE — versi lengkap)
-- ============================================================================
