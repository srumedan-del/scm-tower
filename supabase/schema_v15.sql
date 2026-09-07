-- ============================================================================
-- SCM Control Tower — Schema Migration v1.5
-- Tanggal: September 2026
--
-- AMAN dijalankan: semua DDL menggunakan IF NOT EXISTS / DO NOTHING.
-- Tidak menghapus tabel, kolom, atau data yang sudah ada.
--
-- Jalankan di Supabase SQL Editor (sekali saja).
--
-- Perubahan yang dicakup:
--   1. ALTER master_driver      — tambah kolom `role`
--   2. ALTER customers          — tambah `is_hd_customer`
--   3. ALTER outbound_header    — tambah `psi_no`
--   4. ALTER shipment_tracking  — tambah helper_id, dk_lk, biaya rinci,
--                                  invoice_value, dan GENERATED total_biaya & cost_ratio
--   5. CREATE hd_stock_monitoring — baru (modul 4.4.1)
--   6. CREATE budget_request      — baru (modul 4.5.5)
--   7. CREATE budget_approval_log — baru (modul 4.5.5)
--   8. UPDATE vw_shipment_tms     — tambah helper_name & dk_lk
-- ============================================================================


-- ============================================================================
-- 1. master_driver — tambah kolom role (Driver | Helper)
-- ============================================================================
ALTER TABLE public.master_driver
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'Driver'
    CHECK (role IN ('Driver', 'Helper'));

COMMENT ON COLUMN public.master_driver.role IS
  'Driver = pengemudi utama, Helper = pembantu/kru. Dipakai untuk filter assign trip di TMS.';


-- ============================================================================
-- 2. customers — tambah is_hd_customer
--    (machine_count sudah ada — dipakai sebagai hd_machine_count)
-- ============================================================================
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS is_hd_customer boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.customers.is_hd_customer IS
  'True = customer HD (RS/klinik dialisis). Dipakai untuk filter modul hd_stock_monitoring.';
COMMENT ON COLUMN public.customers.machine_count IS
  'Jumlah mesin HD terpasang di customer (alias hd_machine_count per PRD v1.5).';

-- Update is_hd_customer = true untuk customer yang sudah punya machine_count > 0
UPDATE public.customers
  SET is_hd_customer = true
  WHERE machine_count > 0 AND is_hd_customer = false;


-- ============================================================================
-- 3. outbound_header — tambah psi_no (Posted Sales Invoice No.)
-- ============================================================================
ALTER TABLE public.outbound_header
  ADD COLUMN IF NOT EXISTS psi_no text;

CREATE INDEX IF NOT EXISTS outbound_header_psi_no_idx
  ON public.outbound_header (psi_no)
  WHERE psi_no IS NOT NULL;

COMMENT ON COLUMN public.outbound_header.psi_no IS
  'Nomor Posted Sales Invoice dari NAV. Basis pengambilan invoice_value untuk Cost Ratio.';


-- ============================================================================
-- 4. shipment_tracking — tambah kolom v1.5
--    helper_id, dk_lk, biaya rinci Internal & Eksternal,
--    invoice_value, GENERATED total_biaya & cost_ratio
-- ============================================================================

-- 4a. helper_id
ALTER TABLE public.shipment_tracking
  ADD COLUMN IF NOT EXISTS helper_id bigint
    REFERENCES public.master_driver(id) ON DELETE SET NULL;

-- 4b. dk_lk — Dalam Kota / Luar Kota (bisa di-copy dari customers.dk_lk, atau override)
ALTER TABLE public.shipment_tracking
  ADD COLUMN IF NOT EXISTS dk_lk text
    CHECK (dk_lk IN ('DK', 'LK', NULL));

-- 4c. No. Payment Voucher (berlaku semua model)
ALTER TABLE public.shipment_tracking
  ADD COLUMN IF NOT EXISTS payment_voucher_no text;

-- 4d. Komponen biaya Internal
ALTER TABLE public.shipment_tracking
  ADD COLUMN IF NOT EXISTS bbm_liter       numeric,
  ADD COLUMN IF NOT EXISTS bbm_rupiah      numeric,
  ADD COLUMN IF NOT EXISTS bongkar_muat_cost numeric,
  ADD COLUMN IF NOT EXISTS hotel_cost      numeric,
  ADD COLUMN IF NOT EXISTS uang_makan_driver numeric,
  ADD COLUMN IF NOT EXISTS uang_makan_helper numeric,
  ADD COLUMN IF NOT EXISTS toll_cost       numeric,
  ADD COLUMN IF NOT EXISTS parkir_cost     numeric,
  ADD COLUMN IF NOT EXISTS kirim_paket_cost numeric;

-- 4e. Biaya Eksternal
ALTER TABLE public.shipment_tracking
  ADD COLUMN IF NOT EXISTS invoice_no_eksternal   text,
  ADD COLUMN IF NOT EXISTS total_biaya_eksternal  numeric;

-- 4f. Invoice Value (basis Cost Ratio) — input manual atau tarik dari PSS/PSI
ALTER TABLE public.shipment_tracking
  ADD COLUMN IF NOT EXISTS invoice_value numeric;

-- 4g. GENERATED: total_biaya
--     Internal  → jumlah seluruh komponen biaya
--     Eksternal → total_biaya_eksternal
--     Fallback  → trip_cost (kolom lama)
-- Catatan: PostgreSQL GENERATED ALWAYS AS tidak bisa pakai CASE pada nullable
-- tanpa COALESCE, jadi kita hitung semua komponen + take max dengan eksternal
DO $$
BEGIN
  -- Cek apakah kolom total_biaya sudah ada sebagai GENERATED column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'shipment_tracking'
      AND column_name  = 'total_biaya'
  ) THEN
    ALTER TABLE public.shipment_tracking
      ADD COLUMN total_biaya numeric GENERATED ALWAYS AS (
        CASE
          WHEN cost_model = 'Internal' OR cost_model IS NULL THEN
            COALESCE(bbm_rupiah, 0)
            + COALESCE(bongkar_muat_cost, 0)
            + COALESCE(hotel_cost, 0)
            + COALESCE(uang_makan_driver, 0)
            + COALESCE(uang_makan_helper, 0)
            + COALESCE(toll_cost, 0)
            + COALESCE(parkir_cost, 0)
            + COALESCE(kirim_paket_cost, 0)
          ELSE
            COALESCE(total_biaya_eksternal, 0)
        END
      ) STORED;
  END IF;
END $$;

-- 4h. GENERATED: cost_ratio = total_biaya / invoice_value * 100
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'shipment_tracking'
      AND column_name  = 'cost_ratio'
  ) THEN
    ALTER TABLE public.shipment_tracking
      ADD COLUMN cost_ratio numeric GENERATED ALWAYS AS (
        CASE
          WHEN invoice_value IS NOT NULL AND invoice_value > 0
          THEN CASE
            WHEN cost_model = 'Internal' OR cost_model IS NULL THEN
              ROUND((
                COALESCE(bbm_rupiah, 0)
                + COALESCE(bongkar_muat_cost, 0)
                + COALESCE(hotel_cost, 0)
                + COALESCE(uang_makan_driver, 0)
                + COALESCE(uang_makan_helper, 0)
                + COALESCE(toll_cost, 0)
                + COALESCE(parkir_cost, 0)
                + COALESCE(kirim_paket_cost, 0)
              ) / invoice_value * 100, 2)
            ELSE
              ROUND(COALESCE(total_biaya_eksternal, 0) / invoice_value * 100, 2)
          END
          ELSE NULL
        END
      ) STORED;
  END IF;
END $$;

COMMENT ON COLUMN public.shipment_tracking.helper_id        IS 'FK ke master_driver (role=Helper). Hanya untuk transporter Internal.';
COMMENT ON COLUMN public.shipment_tracking.dk_lk            IS 'Dalam Kota / Luar Kota — di-copy dari customers.dk_lk atau diisi manual.';
COMMENT ON COLUMN public.shipment_tracking.total_biaya      IS 'GENERATED: total komponen biaya (Internal) atau total_biaya_eksternal (Eksternal).';
COMMENT ON COLUMN public.shipment_tracking.cost_ratio       IS 'GENERATED: total_biaya / invoice_value * 100 (%). Indikator efisiensi biaya kirim.';


-- ============================================================================
-- 5. hd_stock_monitoring — Monitoring stok consumable HD Set per customer
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.hd_stock_monitoring (
  id                              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id                     bigint NOT NULL
                                  REFERENCES public.customers(id) ON DELETE CASCADE,
  snapshot_date                   date   NOT NULL DEFAULT CURRENT_DATE,

  -- Konfigurasi asumsi (bisa disesuaikan per customer)
  treatment_per_day_per_machine   integer NOT NULL DEFAULT 2,
  working_days_per_month          integer NOT NULL DEFAULT 25,
  safety_stock_days               integer NOT NULL DEFAULT 6,
  rop_days                        integer NOT NULL DEFAULT 8,
  lead_time_reorder_days          integer NOT NULL DEFAULT 9,

  -- Input manual (dari lapangan / marketing)
  last_known_stock_date           date,
  last_known_stock_qty            numeric NOT NULL DEFAULT 0,
  last_shipment_date              date,
  last_shipment_qty               numeric NOT NULL DEFAULT 0,

  notes                           text,
  created_at                      timestamptz NOT NULL DEFAULT now(),
  updated_at                      timestamptz NOT NULL DEFAULT now(),

  -- GENERATED columns (kalkulasi otomatis)
  daily_usage numeric GENERATED ALWAYS AS (
    (SELECT machine_count FROM public.customers c WHERE c.id = customer_id)
    * treatment_per_day_per_machine
  ) STORED,

  monthly_need numeric GENERATED ALWAYS AS (
    (SELECT machine_count FROM public.customers c WHERE c.id = customer_id)
    * treatment_per_day_per_machine
    * working_days_per_month
  ) STORED,

  safety_stock_qty numeric GENERATED ALWAYS AS (
    (SELECT machine_count FROM public.customers c WHERE c.id = customer_id)
    * treatment_per_day_per_machine
    * safety_stock_days
  ) STORED,

  rop_qty numeric GENERATED ALWAYS AS (
    (SELECT machine_count FROM public.customers c WHERE c.id = customer_id)
    * treatment_per_day_per_machine
    * rop_days
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
    - (
        (SELECT machine_count FROM public.customers c WHERE c.id = customer_id)
        * treatment_per_day_per_machine
        * rop_days
      )
  ) STORED,

  available_days numeric GENERATED ALWAYS AS (
    CASE
      WHEN (SELECT machine_count FROM public.customers c WHERE c.id = customer_id) > 0
        AND treatment_per_day_per_machine > 0
      THEN (
             (last_known_stock_qty + last_shipment_qty)
             - (
                 (SELECT machine_count FROM public.customers c WHERE c.id = customer_id)
                 * treatment_per_day_per_machine
                 * rop_days
               )
           )
           / ((SELECT machine_count FROM public.customers c WHERE c.id = customer_id)
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

-- Note: UNIQUE per customer per snapshot_date jika ingin 1 snapshot per hari per customer
-- Di-comment karena mungkin perlu beberapa update dalam sehari
-- UNIQUE (customer_id, snapshot_date)

CREATE INDEX IF NOT EXISTS hd_stock_monitoring_customer_idx
  ON public.hd_stock_monitoring (customer_id);
CREATE INDEX IF NOT EXISTS hd_stock_monitoring_snapshot_date_idx
  ON public.hd_stock_monitoring (snapshot_date DESC);
CREATE INDEX IF NOT EXISTS hd_stock_monitoring_fu_po_idx
  ON public.hd_stock_monitoring (fu_po_date)
  WHERE fu_po_date IS NOT NULL;

-- Updated_at trigger
DROP TRIGGER IF EXISTS hd_stock_monitoring_updated_at ON public.hd_stock_monitoring;
CREATE TRIGGER hd_stock_monitoring_updated_at
  BEFORE UPDATE ON public.hd_stock_monitoring
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.hd_stock_monitoring ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated read" ON public.hd_stock_monitoring;
CREATE POLICY "authenticated read" ON public.hd_stock_monitoring
  FOR SELECT TO authenticated USING (true);

COMMENT ON TABLE public.hd_stock_monitoring IS
  'Monitoring stok consumable HD Set per customer HD. Snapshot per tanggal.
   GENERATED columns: daily_usage, monthly_need, safety_stock_qty, rop_qty,
   estimated_stock, doi_days, estimated_stockout_date, available_stock,
   available_days, fu_po_date.
   Lihat PRD v1.5 § 4.4.1.';


-- ============================================================================
-- 6. budget_request — Pengajuan Dana Biaya Kirim bulanan (Internal only)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.budget_request (
  id                        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  period                    text   NOT NULL UNIQUE,       -- format "YYYY-MM", mis. "2026-09"
  lk_amount_projected       numeric,                      -- proyeksi LK bulan ini
  dk_amount_projected       numeric,                      -- proyeksi DK bulan ini
  total_projected           numeric GENERATED ALWAYS AS (
                              COALESCE(lk_amount_projected, 0)
                              + COALESCE(dk_amount_projected, 0)
                            ) STORED,
  buffer_amount             numeric,                      -- buffer SCM (manual)
  subtotal                  numeric GENERATED ALWAYS AS (
                              COALESCE(lk_amount_projected, 0)
                              + COALESCE(dk_amount_projected, 0)
                              + COALESCE(buffer_amount, 0)
                            ) STORED,
  rounded_request_amount    numeric,                      -- nilai final setelah pembulatan
  bank_name                 text,
  bank_account_no           text,
  bank_account_holder       text,
  notes                     text,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
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

COMMENT ON TABLE public.budget_request IS
  'Pengajuan dana biaya kirim bulanan — khusus transporter Internal.
   Lihat PRD v1.5 § 4.5.5.';


-- ============================================================================
-- 7. budget_approval_log — Riwayat/checklist approval pengajuan dana
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.budget_approval_log (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  budget_request_id   bigint NOT NULL
                      REFERENCES public.budget_request(id) ON DELETE CASCADE,
  approver_name       text   NOT NULL,
  sequence_no         integer NOT NULL DEFAULT 1,
  status              text   NOT NULL DEFAULT 'Pending'
                      CHECK (status IN ('Pending', 'Approved')),
  approved_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS budget_approval_log_request_idx
  ON public.budget_approval_log (budget_request_id);

ALTER TABLE public.budget_approval_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated read" ON public.budget_approval_log;
CREATE POLICY "authenticated read" ON public.budget_approval_log
  FOR SELECT TO authenticated USING (true);

COMMENT ON TABLE public.budget_approval_log IS
  'Checklist approval per budget_request. Urutan approval via sequence_no.';


-- ============================================================================
-- 8. UPDATE vw_shipment_tms — tambah helper_name, dk_lk, dan kolom biaya baru
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
  -- Biaya Internal
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
  -- Biaya Eksternal
  st.invoice_no_eksternal,
  st.total_biaya_eksternal,
  -- Kalkulasi
  st.invoice_value,
  st.total_biaya,
  st.cost_ratio,
  st.trip_cost,       -- kolom lama, tetap ada untuk backward compat
  -- Transporter
  tr.name            AS transporter_name,
  tr.type            AS transporter_type,
  tr.service_model   AS transporter_service_model,
  -- Armada
  tf.vehicle_no,
  tf.vehicle_type,
  -- Driver & Helper
  md.driver_name,
  md.phone           AS driver_phone,
  mh.driver_name     AS helper_name,
  mh.phone           AS helper_phone,
  -- Rute
  r.route_code,
  r.origin           AS route_origin,
  r.destination      AS route_destination,
  st.notes,
  st.created_at,
  st.updated_at
FROM public.shipment_tracking st
LEFT JOIN public.master_transporter tr  ON tr.id = st.transporter_id
LEFT JOIN public.transport_fleet    tf  ON tf.id = st.vehicle_id
LEFT JOIN public.master_driver      md  ON md.id = st.driver_id
LEFT JOIN public.master_driver      mh  ON mh.id = st.helper_id
LEFT JOIN public.routes              r  ON r.id  = st.route_id;

COMMENT ON VIEW public.vw_shipment_tms IS
  'Shipment tracking dengan join lengkap ke transporter, vehicle, driver, helper, dan route.
   v1.5: tambah helper_name, dk_lk, kolom biaya rinci, total_biaya, cost_ratio.';


-- ============================================================================
-- SELESAI
-- ============================================================================
-- Ringkasan perubahan v1.5:
--
--   ALTER master_driver         → + role (Driver|Helper)
--   ALTER customers             → + is_hd_customer boolean
--   ALTER outbound_header       → + psi_no text
--   ALTER shipment_tracking     → + helper_id, dk_lk, payment_voucher_no,
--                                   bbm_liter/rupiah, bongkar_muat_cost,
--                                   hotel_cost, uang_makan_driver/helper,
--                                   toll_cost, parkir_cost, kirim_paket_cost,
--                                   invoice_no_eksternal, total_biaya_eksternal,
--                                   invoice_value,
--                                   GENERATED: total_biaya, cost_ratio
--   CREATE hd_stock_monitoring  → monitoring stok HD Set per customer (baru)
--   CREATE budget_request       → pengajuan dana bulanan Internal (baru)
--   CREATE budget_approval_log  → checklist approval pengajuan (baru)
--   REPLACE vw_shipment_tms     → tambah helper_name, dk_lk, biaya rinci
-- ============================================================================
