-- Part 2b: shipment_tracking + delivery_pod
-- Jalankan SETELAH Part 2a sukses.
--
-- PENTING: Jika tabel shipment_tracking SUDAH ADA dari schema_tms.sql lama,
-- blok CREATE TABLE IF NOT EXISTS akan skip — tapi kolom baru (helper_id, biaya, dll)
-- tetap ditambahkan via DO blocks di bawah.
-- Jika tabel BELUM ADA, CREATE TABLE akan membuat tabel baru dengan semua kolom sekaligus.

-- ── Buat tabel baru jika belum ada ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.shipment_tracking (
  id                     bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_type            text NOT NULL DEFAULT 'PSS'
                         CHECK (source_type IN ('PSS','Crossdocking')),
  pss_no                 text,
  crossdocking_id        bigint REFERENCES public.crossdocking_header(id) ON DELETE SET NULL,
  outbound_header_id     bigint,
  trip_id                text,
  transporter_id         bigint REFERENCES public.master_transporter(id) ON DELETE RESTRICT,
  vehicle_id             bigint REFERENCES public.transport_fleet(id) ON DELETE SET NULL,
  driver_id              bigint REFERENCES public.master_driver(id) ON DELETE SET NULL,
  helper_id              bigint REFERENCES public.master_driver(id) ON DELETE SET NULL,
  route_id               bigint REFERENCES public.routes(id) ON DELETE SET NULL,
  customer_code          text,
  customer_name          text,
  destination_address    text,
  destination_city       text,
  dk_lk                  text CHECK (dk_lk IN ('DK','LK',NULL)),
  document_date          date,
  promised_delivery_date date,
  status                 text NOT NULL DEFAULT 'Draft'
                         CHECK (status IN ('Draft','Dispatched','In Transit','Delivered')),
  dispatch_time          timestamptz,
  delivery_time          timestamptz,
  is_on_time             boolean GENERATED ALWAYS AS (
                           CASE
                             WHEN delivery_time IS NULL OR promised_delivery_date IS NULL THEN NULL
                             WHEN delivery_time::date <= promised_delivery_date THEN true
                             ELSE false
                           END
                         ) STORED,
  weight_kg              numeric,
  trip_cost              numeric,
  cost_model             text CHECK (cost_model IN ('Internal','Retail','Trucking',NULL)),
  payment_voucher_no     text,
  bbm_liter              numeric,
  bbm_rupiah             numeric,
  bongkar_muat_cost      numeric,
  hotel_cost             numeric,
  uang_makan_driver      numeric,
  uang_makan_helper      numeric,
  toll_cost              numeric,
  parkir_cost            numeric,
  kirim_paket_cost       numeric,
  invoice_no_eksternal   text,
  total_biaya_eksternal  numeric,
  invoice_value          numeric,
  total_biaya            numeric GENERATED ALWAYS AS (
                           CASE
                             WHEN cost_model = 'Internal' OR cost_model IS NULL THEN
                               COALESCE(bbm_rupiah,0) + COALESCE(bongkar_muat_cost,0)
                               + COALESCE(hotel_cost,0) + COALESCE(uang_makan_driver,0)
                               + COALESCE(uang_makan_helper,0) + COALESCE(toll_cost,0)
                               + COALESCE(parkir_cost,0) + COALESCE(kirim_paket_cost,0)
                             ELSE COALESCE(total_biaya_eksternal,0)
                           END
                         ) STORED,
  cost_ratio             numeric GENERATED ALWAYS AS (
                           CASE
                             WHEN invoice_value IS NOT NULL AND invoice_value > 0 THEN
                               CASE
                                 WHEN cost_model = 'Internal' OR cost_model IS NULL THEN
                                   ROUND((
                                     COALESCE(bbm_rupiah,0) + COALESCE(bongkar_muat_cost,0)
                                     + COALESCE(hotel_cost,0) + COALESCE(uang_makan_driver,0)
                                     + COALESCE(uang_makan_helper,0) + COALESCE(toll_cost,0)
                                     + COALESCE(parkir_cost,0) + COALESCE(kirim_paket_cost,0)
                                   ) / invoice_value * 100, 2)
                                 ELSE ROUND(COALESCE(total_biaya_eksternal,0) / invoice_value * 100, 2)
                               END
                             ELSE NULL
                           END
                         ) STORED,
  notes                  text,
  created_by             text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shipment_tracking_status_idx ON public.shipment_tracking (status);
CREATE INDEX IF NOT EXISTS shipment_tracking_pss_idx    ON public.shipment_tracking (pss_no)   WHERE pss_no IS NOT NULL;
CREATE INDEX IF NOT EXISTS shipment_tracking_trip_idx   ON public.shipment_tracking (trip_id)  WHERE trip_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS shipment_tracking_date_idx   ON public.shipment_tracking (promised_delivery_date DESC);

DROP TRIGGER IF EXISTS shipment_tracking_updated_at ON public.shipment_tracking;
CREATE TRIGGER shipment_tracking_updated_at
  BEFORE UPDATE ON public.shipment_tracking
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.shipment_tracking ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated read" ON public.shipment_tracking;
CREATE POLICY "authenticated read" ON public.shipment_tracking
  FOR SELECT TO authenticated USING (true);


-- ── Tambah kolom v1.5 jika tabel sudah ada tapi belum punya kolom baru ────
-- (DO blocks — tidak error jika kolom sudah ada dari CREATE TABLE di atas)
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='shipment_tracking' AND column_name='helper_id')           THEN ALTER TABLE public.shipment_tracking ADD COLUMN helper_id bigint REFERENCES public.master_driver(id) ON DELETE SET NULL; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='shipment_tracking' AND column_name='dk_lk')               THEN ALTER TABLE public.shipment_tracking ADD COLUMN dk_lk text CHECK (dk_lk IN ('DK','LK',NULL)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='shipment_tracking' AND column_name='payment_voucher_no')   THEN ALTER TABLE public.shipment_tracking ADD COLUMN payment_voucher_no text; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='shipment_tracking' AND column_name='bbm_liter')           THEN ALTER TABLE public.shipment_tracking ADD COLUMN bbm_liter numeric; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='shipment_tracking' AND column_name='bbm_rupiah')          THEN ALTER TABLE public.shipment_tracking ADD COLUMN bbm_rupiah numeric; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='shipment_tracking' AND column_name='bongkar_muat_cost')   THEN ALTER TABLE public.shipment_tracking ADD COLUMN bongkar_muat_cost numeric; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='shipment_tracking' AND column_name='hotel_cost')          THEN ALTER TABLE public.shipment_tracking ADD COLUMN hotel_cost numeric; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='shipment_tracking' AND column_name='uang_makan_driver')   THEN ALTER TABLE public.shipment_tracking ADD COLUMN uang_makan_driver numeric; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='shipment_tracking' AND column_name='uang_makan_helper')   THEN ALTER TABLE public.shipment_tracking ADD COLUMN uang_makan_helper numeric; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='shipment_tracking' AND column_name='toll_cost')           THEN ALTER TABLE public.shipment_tracking ADD COLUMN toll_cost numeric; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='shipment_tracking' AND column_name='parkir_cost')         THEN ALTER TABLE public.shipment_tracking ADD COLUMN parkir_cost numeric; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='shipment_tracking' AND column_name='kirim_paket_cost')    THEN ALTER TABLE public.shipment_tracking ADD COLUMN kirim_paket_cost numeric; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='shipment_tracking' AND column_name='invoice_no_eksternal') THEN ALTER TABLE public.shipment_tracking ADD COLUMN invoice_no_eksternal text; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='shipment_tracking' AND column_name='total_biaya_eksternal') THEN ALTER TABLE public.shipment_tracking ADD COLUMN total_biaya_eksternal numeric; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='shipment_tracking' AND column_name='invoice_value')       THEN ALTER TABLE public.shipment_tracking ADD COLUMN invoice_value numeric; END IF; END $$;

-- GENERATED columns — hanya bisa ditambah jika belum ada (tidak bisa IF NOT EXISTS langsung)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='shipment_tracking' AND column_name='total_biaya') THEN
    ALTER TABLE public.shipment_tracking ADD COLUMN total_biaya numeric GENERATED ALWAYS AS (
      CASE WHEN cost_model='Internal' OR cost_model IS NULL
           THEN COALESCE(bbm_rupiah,0)+COALESCE(bongkar_muat_cost,0)+COALESCE(hotel_cost,0)
                +COALESCE(uang_makan_driver,0)+COALESCE(uang_makan_helper,0)
                +COALESCE(toll_cost,0)+COALESCE(parkir_cost,0)+COALESCE(kirim_paket_cost,0)
           ELSE COALESCE(total_biaya_eksternal,0) END
    ) STORED;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='shipment_tracking' AND column_name='cost_ratio') THEN
    ALTER TABLE public.shipment_tracking ADD COLUMN cost_ratio numeric GENERATED ALWAYS AS (
      CASE WHEN invoice_value IS NOT NULL AND invoice_value>0 THEN
        CASE WHEN cost_model='Internal' OR cost_model IS NULL
             THEN ROUND((COALESCE(bbm_rupiah,0)+COALESCE(bongkar_muat_cost,0)+COALESCE(hotel_cost,0)
                         +COALESCE(uang_makan_driver,0)+COALESCE(uang_makan_helper,0)
                         +COALESCE(toll_cost,0)+COALESCE(parkir_cost,0)+COALESCE(kirim_paket_cost,0)
                        )/invoice_value*100,2)
             ELSE ROUND(COALESCE(total_biaya_eksternal,0)/invoice_value*100,2)
        END ELSE NULL END
    ) STORED;
  END IF;
END $$;


-- ── delivery_pod ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.delivery_pod (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tracking_id   bigint NOT NULL REFERENCES public.shipment_tracking(id) ON DELETE CASCADE,
  receiver_name text NOT NULL,
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
