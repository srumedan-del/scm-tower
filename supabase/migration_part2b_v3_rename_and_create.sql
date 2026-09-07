-- ============================================================================
-- Part 2b v3: Tabel shipment_tracking lama adalah tabel BERBEDA (struktur lama)
-- Solusi: rename tabel lama → shipment_tracking_legacy, lalu buat yang baru
--
-- Data lama TIDAK HILANG — tersimpan di shipment_tracking_legacy
-- ============================================================================

-- Step 1: Rename tabel lama agar tidak konflik
ALTER TABLE IF EXISTS public.shipment_tracking
  RENAME TO shipment_tracking_legacy;

-- Step 2: Buat tabel shipment_tracking baru (struktur TMS v1.5)
CREATE TABLE public.shipment_tracking (
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
  is_on_time             boolean,   -- dihitung otomatis via trigger calc_shipment_biaya
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
  -- total_biaya dan cost_ratio dihitung otomatis via trigger (bukan GENERATED)
  -- karena CASE WHEN dengan nullable columns tidak selalu immutable di semua versi PostgreSQL
  total_biaya            numeric,
  cost_ratio             numeric,
  notes                  text,
  created_by             text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

-- Index
CREATE INDEX shipment_tracking_status_idx ON public.shipment_tracking (status);
CREATE INDEX shipment_tracking_pss_idx    ON public.shipment_tracking (pss_no)   WHERE pss_no IS NOT NULL;
CREATE INDEX shipment_tracking_trip_idx   ON public.shipment_tracking (trip_id)  WHERE trip_id IS NOT NULL;
CREATE INDEX shipment_tracking_date_idx   ON public.shipment_tracking (promised_delivery_date DESC);

-- Trigger updated_at
DROP TRIGGER IF EXISTS shipment_tracking_updated_at ON public.shipment_tracking;
CREATE TRIGGER shipment_tracking_updated_at
  BEFORE UPDATE ON public.shipment_tracking
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger kalkulasi total_biaya & cost_ratio otomatis
CREATE OR REPLACE FUNCTION public.calc_shipment_biaya()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Hitung is_on_time
  IF NEW.delivery_time IS NOT NULL AND NEW.promised_delivery_date IS NOT NULL THEN
    NEW.is_on_time := (NEW.delivery_time AT TIME ZONE 'UTC')::date <= NEW.promised_delivery_date;
  ELSE
    NEW.is_on_time := NULL;
  END IF;

  -- Hitung total_biaya
  IF NEW.cost_model = 'Internal' OR NEW.cost_model IS NULL THEN
    NEW.total_biaya :=
      COALESCE(NEW.bbm_rupiah,0) + COALESCE(NEW.bongkar_muat_cost,0)
      + COALESCE(NEW.hotel_cost,0) + COALESCE(NEW.uang_makan_driver,0)
      + COALESCE(NEW.uang_makan_helper,0) + COALESCE(NEW.toll_cost,0)
      + COALESCE(NEW.parkir_cost,0) + COALESCE(NEW.kirim_paket_cost,0);
  ELSE
    NEW.total_biaya := COALESCE(NEW.total_biaya_eksternal,0);
  END IF;

  -- Hitung cost_ratio
  IF NEW.invoice_value IS NOT NULL AND NEW.invoice_value > 0 THEN
    NEW.cost_ratio := ROUND(NEW.total_biaya / NEW.invoice_value * 100, 2);
  ELSE
    NEW.cost_ratio := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS shipment_tracking_calc_biaya ON public.shipment_tracking;
CREATE TRIGGER shipment_tracking_calc_biaya
  BEFORE INSERT OR UPDATE ON public.shipment_tracking
  FOR EACH ROW EXECUTE FUNCTION public.calc_shipment_biaya();

-- RLS
ALTER TABLE public.shipment_tracking ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated read" ON public.shipment_tracking;
CREATE POLICY "authenticated read" ON public.shipment_tracking
  FOR SELECT TO authenticated USING (true);

-- Step 3: delivery_pod
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

-- Step 4: Update vw_shipment_tms
CREATE OR REPLACE VIEW public.vw_shipment_tms AS
SELECT
  st.id, st.source_type, st.pss_no, st.crossdocking_id, st.trip_id, st.status,
  st.customer_code, st.customer_name, st.destination_city, st.dk_lk,
  st.document_date, st.promised_delivery_date, st.dispatch_time, st.delivery_time, st.is_on_time,
  st.weight_kg, st.cost_model, st.payment_voucher_no,
  st.bbm_liter, st.bbm_rupiah, st.bongkar_muat_cost, st.hotel_cost,
  st.uang_makan_driver, st.uang_makan_helper, st.toll_cost, st.parkir_cost, st.kirim_paket_cost,
  st.invoice_no_eksternal, st.total_biaya_eksternal,
  st.invoice_value, st.total_biaya, st.cost_ratio, st.trip_cost,
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
  st.notes, st.created_at, st.updated_at
FROM public.shipment_tracking st
LEFT JOIN public.master_transporter tr ON tr.id = st.transporter_id
LEFT JOIN public.transport_fleet    tf ON tf.id = st.vehicle_id
LEFT JOIN public.master_driver      md ON md.id = st.driver_id
LEFT JOIN public.master_driver      mh ON mh.id = st.helper_id
LEFT JOIN public.routes              r ON r.id  = st.route_id;

-- Selesai. Ringkasan:
-- - shipment_tracking (lama) → di-rename ke shipment_tracking_legacy (data aman)
-- - shipment_tracking (baru) → tabel TMS v1.5 dengan semua kolom yang benar
-- - delivery_pod → tabel baru untuk POD
-- - vw_shipment_tms → view diperbarui
