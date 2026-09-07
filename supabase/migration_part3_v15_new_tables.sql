-- ============================================================================
-- PART 3: Tabel baru v1.5 + ALTER tabel lama
-- Jalankan SETELAH Part 1, 2a, 2b v3 sukses.
--
-- Catatan: GENERATED columns dengan subquery tidak supported di PostgreSQL
-- (not immutable). Semua kalkulasi otomatis pakai TRIGGER sebagai gantinya.
-- ============================================================================

-- ── ALTER tabel yang sudah ada ───────────────────────────────────────────────

-- customers: tambah is_hd_customer
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS is_hd_customer boolean NOT NULL DEFAULT false;
UPDATE public.customers
  SET is_hd_customer = true
  WHERE machine_count IS NOT NULL AND machine_count > 0 AND is_hd_customer = false;

-- outbound_header: tambah psi_no
ALTER TABLE public.outbound_header
  ADD COLUMN IF NOT EXISTS psi_no text;
CREATE INDEX IF NOT EXISTS outbound_header_psi_no_idx
  ON public.outbound_header (psi_no) WHERE psi_no IS NOT NULL;


-- ── hd_stock_monitoring ──────────────────────────────────────────────────────
-- Kolom kalkulasi (daily_usage, doi_days, dll) disimpan sebagai kolom biasa
-- dan diisi otomatis via trigger calc_hd_monitoring() di bawah.

CREATE TABLE IF NOT EXISTS public.hd_stock_monitoring (
  id                            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id                   bigint NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  snapshot_date                 date   NOT NULL DEFAULT CURRENT_DATE,
  treatment_per_day_per_machine integer NOT NULL DEFAULT 2,
  working_days_per_month        integer NOT NULL DEFAULT 25,
  safety_stock_days             integer NOT NULL DEFAULT 6,
  rop_days                      integer NOT NULL DEFAULT 8,
  lead_time_reorder_days        integer NOT NULL DEFAULT 9,
  -- Input manual
  last_known_stock_date         date,
  last_known_stock_qty          numeric NOT NULL DEFAULT 0,
  last_shipment_date            date,
  last_shipment_qty             numeric NOT NULL DEFAULT 0,
  -- Kalkulasi (diisi otomatis via trigger)
  daily_usage                   numeric,
  monthly_need                  numeric,
  safety_stock_qty              numeric,
  rop_qty                       numeric,
  estimated_stock               numeric,
  doi_days                      numeric,
  estimated_stockout_date       date,
  available_stock               numeric,
  available_days                numeric,
  fu_po_date                    date,
  notes                         text,
  created_at                    timestamptz NOT NULL DEFAULT now(),
  updated_at                    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS hd_stock_monitoring_customer_idx
  ON public.hd_stock_monitoring (customer_id);
CREATE INDEX IF NOT EXISTS hd_stock_monitoring_snapshot_date_idx
  ON public.hd_stock_monitoring (snapshot_date DESC);
CREATE INDEX IF NOT EXISTS hd_stock_monitoring_fu_po_idx
  ON public.hd_stock_monitoring (fu_po_date) WHERE fu_po_date IS NOT NULL;

-- Trigger: hitung semua field kalkulasi otomatis
CREATE OR REPLACE FUNCTION public.calc_hd_monitoring()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_machine_count integer;
  v_daily_usage   numeric;
BEGIN
  -- Ambil machine_count dari tabel customers
  SELECT machine_count INTO v_machine_count
  FROM public.customers WHERE id = NEW.customer_id;

  v_machine_count := COALESCE(v_machine_count, 0);

  -- daily_usage
  v_daily_usage := v_machine_count * NEW.treatment_per_day_per_machine;
  NEW.daily_usage         := v_daily_usage;
  NEW.monthly_need        := v_daily_usage * NEW.working_days_per_month;
  NEW.safety_stock_qty    := v_daily_usage * NEW.safety_stock_days;
  NEW.rop_qty             := v_daily_usage * NEW.rop_days;
  NEW.estimated_stock     := NEW.last_known_stock_qty + NEW.last_shipment_qty;

  -- doi_days & estimated_stockout_date
  IF v_daily_usage > 0 THEN
    NEW.doi_days := NEW.estimated_stock / v_daily_usage;
    IF NEW.last_shipment_date IS NOT NULL THEN
      NEW.estimated_stockout_date :=
        NEW.last_shipment_date + FLOOR(NEW.doi_days) * INTERVAL '1 day';
    ELSE
      NEW.estimated_stockout_date := NULL;
    END IF;
  ELSE
    NEW.doi_days                := NULL;
    NEW.estimated_stockout_date := NULL;
  END IF;

  -- available_stock & available_days
  NEW.available_stock := NEW.estimated_stock - NEW.rop_qty;
  IF v_daily_usage > 0 THEN
    NEW.available_days := NEW.available_stock / v_daily_usage;
  ELSE
    NEW.available_days := NULL;
  END IF;

  -- fu_po_date
  IF NEW.estimated_stockout_date IS NOT NULL THEN
    NEW.fu_po_date :=
      NEW.estimated_stockout_date - NEW.lead_time_reorder_days * INTERVAL '1 day';
  ELSE
    NEW.fu_po_date := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS hd_stock_monitoring_calc ON public.hd_stock_monitoring;
CREATE TRIGGER hd_stock_monitoring_calc
  BEFORE INSERT OR UPDATE ON public.hd_stock_monitoring
  FOR EACH ROW EXECUTE FUNCTION public.calc_hd_monitoring();

DROP TRIGGER IF EXISTS hd_stock_monitoring_updated_at ON public.hd_stock_monitoring;
CREATE TRIGGER hd_stock_monitoring_updated_at
  BEFORE UPDATE ON public.hd_stock_monitoring
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.hd_stock_monitoring ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated read" ON public.hd_stock_monitoring;
CREATE POLICY "authenticated read" ON public.hd_stock_monitoring
  FOR SELECT TO authenticated USING (true);


-- ── budget_request ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.budget_request (
  id                     bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  period                 text NOT NULL UNIQUE,
  lk_amount_projected    numeric,
  dk_amount_projected    numeric,
  -- total_projected dan subtotal dihitung via trigger
  total_projected        numeric,
  buffer_amount          numeric,
  subtotal               numeric,
  rounded_request_amount numeric,
  bank_name              text,
  bank_account_no        text,
  bank_account_holder    text,
  notes                  text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.calc_budget_request()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.total_projected := COALESCE(NEW.lk_amount_projected,0) + COALESCE(NEW.dk_amount_projected,0);
  NEW.subtotal        := NEW.total_projected + COALESCE(NEW.buffer_amount,0);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS budget_request_calc ON public.budget_request;
CREATE TRIGGER budget_request_calc
  BEFORE INSERT OR UPDATE ON public.budget_request
  FOR EACH ROW EXECUTE FUNCTION public.calc_budget_request();

CREATE INDEX IF NOT EXISTS budget_request_period_idx ON public.budget_request (period DESC);

DROP TRIGGER IF EXISTS budget_request_updated_at ON public.budget_request;
CREATE TRIGGER budget_request_updated_at
  BEFORE UPDATE ON public.budget_request
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.budget_request ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated read" ON public.budget_request;
CREATE POLICY "authenticated read" ON public.budget_request
  FOR SELECT TO authenticated USING (true);


-- ── budget_approval_log ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.budget_approval_log (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  budget_request_id bigint NOT NULL REFERENCES public.budget_request(id) ON DELETE CASCADE,
  approver_name     text NOT NULL,
  sequence_no       integer NOT NULL DEFAULT 1,
  status            text NOT NULL DEFAULT 'Pending'
                    CHECK (status IN ('Pending','Approved')),
  approved_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS budget_approval_log_request_idx
  ON public.budget_approval_log (budget_request_id);

ALTER TABLE public.budget_approval_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated read" ON public.budget_approval_log;
CREATE POLICY "authenticated read" ON public.budget_approval_log
  FOR SELECT TO authenticated USING (true);

-- ── Selesai ──────────────────────────────────────────────────────────────────
-- Yang dibuat/diubah:
--   customers            ALTER → tambah is_hd_customer
--   outbound_header      ALTER → tambah psi_no
--   hd_stock_monitoring  CREATE + trigger calc_hd_monitoring
--   budget_request       CREATE + trigger calc_budget_request
--   budget_approval_log  CREATE
