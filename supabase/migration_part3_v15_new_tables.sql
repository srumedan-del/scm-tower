-- ============================================================================
-- PART 3: Tabel baru v1.5 + ALTER tabel lama
-- Jalankan SETELAH part1 dan part2 sukses.
-- ============================================================================

-- ALTER customers — tambah is_hd_customer
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS is_hd_customer boolean NOT NULL DEFAULT false;
UPDATE public.customers SET is_hd_customer = true
  WHERE machine_count IS NOT NULL AND machine_count > 0 AND is_hd_customer = false;

-- ALTER outbound_header — tambah psi_no
ALTER TABLE public.outbound_header ADD COLUMN IF NOT EXISTS psi_no text;
CREATE INDEX IF NOT EXISTS outbound_header_psi_no_idx ON public.outbound_header (psi_no) WHERE psi_no IS NOT NULL;

-- hd_stock_monitoring
CREATE TABLE IF NOT EXISTS public.hd_stock_monitoring (
  id                            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id                   bigint NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
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
  daily_usage numeric GENERATED ALWAYS AS (
    (SELECT machine_count FROM public.customers c WHERE c.id = customer_id) * treatment_per_day_per_machine
  ) STORED,
  monthly_need numeric GENERATED ALWAYS AS (
    (SELECT machine_count FROM public.customers c WHERE c.id = customer_id) * treatment_per_day_per_machine * working_days_per_month
  ) STORED,
  safety_stock_qty numeric GENERATED ALWAYS AS (
    (SELECT machine_count FROM public.customers c WHERE c.id = customer_id) * treatment_per_day_per_machine * safety_stock_days
  ) STORED,
  rop_qty numeric GENERATED ALWAYS AS (
    (SELECT machine_count FROM public.customers c WHERE c.id = customer_id) * treatment_per_day_per_machine * rop_days
  ) STORED,
  estimated_stock numeric GENERATED ALWAYS AS (last_known_stock_qty + last_shipment_qty) STORED,
  doi_days numeric GENERATED ALWAYS AS (
    CASE WHEN (SELECT machine_count FROM public.customers c WHERE c.id = customer_id) > 0 AND treatment_per_day_per_machine > 0
         THEN (last_known_stock_qty + last_shipment_qty)
              / ((SELECT machine_count FROM public.customers c WHERE c.id = customer_id) * treatment_per_day_per_machine)
         ELSE NULL END
  ) STORED,
  estimated_stockout_date date GENERATED ALWAYS AS (
    CASE WHEN last_shipment_date IS NOT NULL
           AND (SELECT machine_count FROM public.customers c WHERE c.id = customer_id) > 0
           AND treatment_per_day_per_machine > 0
         THEN last_shipment_date + INTERVAL '1 day' * FLOOR(
                (last_known_stock_qty + last_shipment_qty)
                / ((SELECT machine_count FROM public.customers c WHERE c.id = customer_id) * treatment_per_day_per_machine)
              )
         ELSE NULL END
  ) STORED,
  available_stock numeric GENERATED ALWAYS AS (
    (last_known_stock_qty + last_shipment_qty)
    - ((SELECT machine_count FROM public.customers c WHERE c.id = customer_id) * treatment_per_day_per_machine * rop_days)
  ) STORED,
  available_days numeric GENERATED ALWAYS AS (
    CASE WHEN (SELECT machine_count FROM public.customers c WHERE c.id = customer_id) > 0 AND treatment_per_day_per_machine > 0
         THEN ((last_known_stock_qty + last_shipment_qty)
               - ((SELECT machine_count FROM public.customers c WHERE c.id = customer_id) * treatment_per_day_per_machine * rop_days))
              / ((SELECT machine_count FROM public.customers c WHERE c.id = customer_id) * treatment_per_day_per_machine)
         ELSE NULL END
  ) STORED,
  fu_po_date date GENERATED ALWAYS AS (
    CASE WHEN last_shipment_date IS NOT NULL
           AND (SELECT machine_count FROM public.customers c WHERE c.id = customer_id) > 0
           AND treatment_per_day_per_machine > 0
         THEN (last_shipment_date + INTERVAL '1 day' * FLOOR(
                (last_known_stock_qty + last_shipment_qty)
                / ((SELECT machine_count FROM public.customers c WHERE c.id = customer_id) * treatment_per_day_per_machine)
              )) - INTERVAL '1 day' * lead_time_reorder_days
         ELSE NULL END
  ) STORED
);
CREATE INDEX IF NOT EXISTS hd_stock_monitoring_customer_idx     ON public.hd_stock_monitoring (customer_id);
CREATE INDEX IF NOT EXISTS hd_stock_monitoring_snapshot_date_idx ON public.hd_stock_monitoring (snapshot_date DESC);
CREATE INDEX IF NOT EXISTS hd_stock_monitoring_fu_po_idx        ON public.hd_stock_monitoring (fu_po_date) WHERE fu_po_date IS NOT NULL;
DROP TRIGGER IF EXISTS hd_stock_monitoring_updated_at ON public.hd_stock_monitoring;
CREATE TRIGGER hd_stock_monitoring_updated_at BEFORE UPDATE ON public.hd_stock_monitoring
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.hd_stock_monitoring ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated read" ON public.hd_stock_monitoring;
CREATE POLICY "authenticated read" ON public.hd_stock_monitoring FOR SELECT TO authenticated USING (true);

-- budget_request
CREATE TABLE IF NOT EXISTS public.budget_request (
  id                     bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  period                 text NOT NULL UNIQUE,
  lk_amount_projected    numeric,
  dk_amount_projected    numeric,
  total_projected        numeric GENERATED ALWAYS AS (COALESCE(lk_amount_projected,0)+COALESCE(dk_amount_projected,0)) STORED,
  buffer_amount          numeric,
  subtotal               numeric GENERATED ALWAYS AS (COALESCE(lk_amount_projected,0)+COALESCE(dk_amount_projected,0)+COALESCE(buffer_amount,0)) STORED,
  rounded_request_amount numeric,
  bank_name              text,
  bank_account_no        text,
  bank_account_holder    text,
  notes                  text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS budget_request_period_idx ON public.budget_request (period DESC);
DROP TRIGGER IF EXISTS budget_request_updated_at ON public.budget_request;
CREATE TRIGGER budget_request_updated_at BEFORE UPDATE ON public.budget_request
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.budget_request ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated read" ON public.budget_request;
CREATE POLICY "authenticated read" ON public.budget_request FOR SELECT TO authenticated USING (true);

-- budget_approval_log
CREATE TABLE IF NOT EXISTS public.budget_approval_log (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  budget_request_id bigint NOT NULL REFERENCES public.budget_request(id) ON DELETE CASCADE,
  approver_name     text NOT NULL,
  sequence_no       integer NOT NULL DEFAULT 1,
  status            text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Approved')),
  approved_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS budget_approval_log_request_idx ON public.budget_approval_log (budget_request_id);
ALTER TABLE public.budget_approval_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated read" ON public.budget_approval_log;
CREATE POLICY "authenticated read" ON public.budget_approval_log FOR SELECT TO authenticated USING (true);

-- vw_shipment_tms — versi lengkap v1.5
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
  tr.name AS transporter_name, tr.type AS transporter_type, tr.service_model AS transporter_service_model,
  tf.vehicle_no, tf.vehicle_type,
  md.driver_name, md.phone AS driver_phone,
  mh.driver_name AS helper_name, mh.phone AS helper_phone,
  r.route_code, r.origin AS route_origin, r.destination AS route_destination,
  st.notes, st.created_at, st.updated_at
FROM public.shipment_tracking st
LEFT JOIN public.master_transporter tr ON tr.id = st.transporter_id
LEFT JOIN public.transport_fleet    tf ON tf.id = st.vehicle_id
LEFT JOIN public.master_driver      md ON md.id = st.driver_id
LEFT JOIN public.master_driver      mh ON mh.id = st.helper_id
LEFT JOIN public.routes              r ON r.id  = st.route_id;
