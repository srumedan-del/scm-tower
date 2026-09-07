-- ============================================================================
-- Part 2b v2: shipment_tracking (tabel SUDAH ADA dari schema_tms.sql lama)
-- Hanya tambahkan kolom baru v1.5 yang belum ada + delivery_pod
-- ============================================================================

-- Tambah kolom baru satu per satu (DO block = aman jika sudah ada)
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='shipment_tracking' AND column_name='helper_id') THEN
  ALTER TABLE public.shipment_tracking ADD COLUMN helper_id bigint REFERENCES public.master_driver(id) ON DELETE SET NULL;
END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='shipment_tracking' AND column_name='dk_lk') THEN
  ALTER TABLE public.shipment_tracking ADD COLUMN dk_lk text CHECK (dk_lk IN ('DK','LK',NULL));
END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='shipment_tracking' AND column_name='payment_voucher_no') THEN
  ALTER TABLE public.shipment_tracking ADD COLUMN payment_voucher_no text;
END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='shipment_tracking' AND column_name='bbm_liter') THEN
  ALTER TABLE public.shipment_tracking ADD COLUMN bbm_liter numeric;
END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='shipment_tracking' AND column_name='bbm_rupiah') THEN
  ALTER TABLE public.shipment_tracking ADD COLUMN bbm_rupiah numeric;
END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='shipment_tracking' AND column_name='bongkar_muat_cost') THEN
  ALTER TABLE public.shipment_tracking ADD COLUMN bongkar_muat_cost numeric;
END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='shipment_tracking' AND column_name='hotel_cost') THEN
  ALTER TABLE public.shipment_tracking ADD COLUMN hotel_cost numeric;
END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='shipment_tracking' AND column_name='uang_makan_driver') THEN
  ALTER TABLE public.shipment_tracking ADD COLUMN uang_makan_driver numeric;
END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='shipment_tracking' AND column_name='uang_makan_helper') THEN
  ALTER TABLE public.shipment_tracking ADD COLUMN uang_makan_helper numeric;
END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='shipment_tracking' AND column_name='toll_cost') THEN
  ALTER TABLE public.shipment_tracking ADD COLUMN toll_cost numeric;
END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='shipment_tracking' AND column_name='parkir_cost') THEN
  ALTER TABLE public.shipment_tracking ADD COLUMN parkir_cost numeric;
END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='shipment_tracking' AND column_name='kirim_paket_cost') THEN
  ALTER TABLE public.shipment_tracking ADD COLUMN kirim_paket_cost numeric;
END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='shipment_tracking' AND column_name='invoice_no_eksternal') THEN
  ALTER TABLE public.shipment_tracking ADD COLUMN invoice_no_eksternal text;
END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='shipment_tracking' AND column_name='total_biaya_eksternal') THEN
  ALTER TABLE public.shipment_tracking ADD COLUMN total_biaya_eksternal numeric;
END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='shipment_tracking' AND column_name='invoice_value') THEN
  ALTER TABLE public.shipment_tracking ADD COLUMN invoice_value numeric;
END IF; END $$;

-- GENERATED: total_biaya
-- Semua kolom komponen (bbm_rupiah, dll) harus sudah ada dulu di atas sebelum baris ini
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='shipment_tracking' AND column_name='total_biaya'
  ) THEN
    ALTER TABLE public.shipment_tracking
      ADD COLUMN total_biaya numeric GENERATED ALWAYS AS (
        CASE
          WHEN cost_model = 'Internal' OR cost_model IS NULL THEN
            COALESCE(bbm_rupiah,0) + COALESCE(bongkar_muat_cost,0)
            + COALESCE(hotel_cost,0) + COALESCE(uang_makan_driver,0)
            + COALESCE(uang_makan_helper,0) + COALESCE(toll_cost,0)
            + COALESCE(parkir_cost,0) + COALESCE(kirim_paket_cost,0)
          ELSE
            COALESCE(total_biaya_eksternal,0)
        END
      ) STORED;
  END IF;
END $$;

-- GENERATED: cost_ratio
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='shipment_tracking' AND column_name='cost_ratio'
  ) THEN
    ALTER TABLE public.shipment_tracking
      ADD COLUMN cost_ratio numeric GENERATED ALWAYS AS (
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
              ELSE
                ROUND(COALESCE(total_biaya_eksternal,0) / invoice_value * 100, 2)
            END
          ELSE NULL
        END
      ) STORED;
  END IF;
END $$;

-- Update vw_shipment_tms agar include kolom baru
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

-- delivery_pod
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
