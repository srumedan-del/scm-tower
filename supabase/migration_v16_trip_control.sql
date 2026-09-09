-- SCM Control Tower v1.6
-- Foundation for canonical transporter, trip cost allocation, delivery events,
-- upload audit, and POD-based OTD. This migration is additive and preserves
-- shipment_tracking as the legacy compatibility layer during rollout.

BEGIN;

-- Canonical transporter for the current application is public.vendors.
-- Keep shipment_tracking.transporter_id temporarily for backward compatibility.
ALTER TABLE public.shipment_tracking
  ADD COLUMN IF NOT EXISTS vendor_id bigint REFERENCES public.vendors(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS shipment_tracking_vendor_id_idx
  ON public.shipment_tracking (vendor_id) WHERE vendor_id IS NOT NULL;

-- No automatic fuzzy backfill is performed. Existing records must be mapped
-- from their stored transporter/notes data and reviewed by an Admin.

CREATE SEQUENCE IF NOT EXISTS public.trip_no_seq START 1;

CREATE TABLE IF NOT EXISTS public.trip (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  trip_no text NOT NULL UNIQUE DEFAULT (
    'TRIP-' || to_char(now(), 'YYMM') || '-' || lpad(nextval('public.trip_no_seq')::text, 4, '0')
  ),
  vendor_id bigint NOT NULL REFERENCES public.vendors(id) ON DELETE RESTRICT,
  vehicle_id bigint REFERENCES public.transport_fleet(id) ON DELETE SET NULL,
  driver_id bigint REFERENCES public.master_driver(id) ON DELETE SET NULL,
  helper_id bigint REFERENCES public.master_driver(id) ON DELETE SET NULL,
  route_id bigint REFERENCES public.routes(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'Assigned'
    CHECK (status IN ('Assigned', 'Dispatched', 'In Transit', 'Completed', 'Cancelled')),
  dispatch_time timestamptz,
  completed_at timestamptz,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status <> 'Dispatched' AND status <> 'In Transit') OR dispatch_time IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS trip_vendor_status_idx ON public.trip (vendor_id, status);
CREATE INDEX IF NOT EXISTS trip_dispatch_time_idx ON public.trip (dispatch_time DESC);

CREATE TABLE IF NOT EXISTS public.trip_stop (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  trip_id bigint NOT NULL REFERENCES public.trip(id) ON DELETE CASCADE,
  shipment_tracking_id bigint UNIQUE REFERENCES public.shipment_tracking(id) ON DELETE RESTRICT,
  stop_sequence integer NOT NULL CHECK (stop_sequence > 0),
  source_type text NOT NULL CHECK (source_type IN ('PSS', 'Crossdocking')),
  pss_no text,
  crossdocking_id bigint REFERENCES public.crossdocking_header(id) ON DELETE RESTRICT,
  customer_code text,
  customer_name text,
  destination_address text,
  destination_city text,
  promised_delivery_date date,
  status text NOT NULL DEFAULT 'Assigned'
    CHECK (status IN ('Assigned', 'Dispatched', 'In Transit', 'Delivered', 'Partial Delivered', 'Delivery Attempt Failed', 'Rescheduled', 'Cancelled', 'Returned')),
  dispatch_time timestamptz,
  delivery_time timestamptz,
  receiver_name text,
  pod_id bigint,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trip_id, stop_sequence),
  CHECK (
    (source_type = 'PSS' AND pss_no IS NOT NULL AND crossdocking_id IS NULL) OR
    (source_type = 'Crossdocking' AND crossdocking_id IS NOT NULL AND pss_no IS NULL)
  ),
  CHECK (status <> 'Delivered' OR (delivery_time IS NOT NULL AND receiver_name IS NOT NULL))
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'trip_stop_pod_id_fkey'
  ) THEN
    ALTER TABLE public.trip_stop
      ADD CONSTRAINT trip_stop_pod_id_fkey
      FOREIGN KEY (pod_id) REFERENCES public.delivery_pod(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS trip_stop_status_promised_idx
  ON public.trip_stop (status, promised_delivery_date);

CREATE TABLE IF NOT EXISTS public.trip_stop_line (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  trip_stop_id bigint NOT NULL REFERENCES public.trip_stop(id) ON DELETE CASCADE,
  item_no text NOT NULL,
  description text,
  uom text,
  qty_planned numeric NOT NULL CHECK (qty_planned >= 0),
  qty_delivered numeric CHECK (qty_delivered >= 0),
  variance_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trip_stop_id, item_no)
);

CREATE TABLE IF NOT EXISTS public.trip_expense (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  trip_id bigint NOT NULL REFERENCES public.trip(id) ON DELETE CASCADE,
  expense_type text NOT NULL CHECK (expense_type IN ('BBM', 'Bongkar Muat', 'Hotel', 'Uang Makan Driver', 'Uang Makan Helper', 'Tol', 'Parkir', 'Kirim Paket', 'Invoice Eksternal', 'Lainnya')),
  amount numeric NOT NULL CHECK (amount >= 0),
  quantity numeric CHECK (quantity >= 0),
  reference_no text,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.expense_allocation (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  trip_expense_id bigint NOT NULL REFERENCES public.trip_expense(id) ON DELETE CASCADE,
  trip_stop_id bigint NOT NULL REFERENCES public.trip_stop(id) ON DELETE CASCADE,
  allocation_method text NOT NULL CHECK (allocation_method IN ('weight', 'invoice_value', 'quantity', 'equal', 'manual')),
  allocation_basis numeric,
  allocated_amount numeric NOT NULL CHECK (allocated_amount >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trip_expense_id, trip_stop_id)
);

CREATE TABLE IF NOT EXISTS public.shipment_event_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  trip_stop_id bigint REFERENCES public.trip_stop(id) ON DELETE CASCADE,
  shipment_tracking_id bigint REFERENCES public.shipment_tracking(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('Assigned', 'Dispatched', 'In Transit', 'Delivered', 'Partial Delivered', 'Delivery Attempt Failed', 'Rescheduled', 'Cancelled', 'Returned', 'Correction')),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  reason text,
  issue_id bigint REFERENCES public.issue_log(id) ON DELETE SET NULL,
  actor_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (trip_stop_id IS NOT NULL OR shipment_tracking_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS shipment_event_log_stop_time_idx ON public.shipment_event_log (trip_stop_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.upload_batch (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  batch_no text NOT NULL UNIQUE DEFAULT ('UPL-' || to_char(now(), 'YYMM') || '-' || lpad(nextval('public.trip_no_seq')::text, 4, '0')),
  source_system text NOT NULL DEFAULT 'NAV',
  entity_type text NOT NULL CHECK (entity_type IN ('PTR Header', 'PTR Detail', 'PSS Header', 'PSS Detail', 'Inventory Snapshot', 'Customer Master')),
  file_name text NOT NULL,
  file_checksum text,
  total_rows integer NOT NULL DEFAULT 0 CHECK (total_rows >= 0),
  accepted_rows integer NOT NULL DEFAULT 0 CHECK (accepted_rows >= 0),
  rejected_rows integer NOT NULL DEFAULT 0 CHECK (rejected_rows >= 0),
  status text NOT NULL DEFAULT 'Started' CHECK (status IN ('Started', 'Validated', 'Completed', 'Failed', 'Reversed')),
  error_summary text,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

-- Canonical OTD source. Only a final delivery with a POD belongs in its denominator.
CREATE OR REPLACE VIEW public.vw_otd_delivered AS
SELECT
  ts.id AS trip_stop_id,
  t.trip_no,
  ts.customer_code,
  ts.customer_name,
  ts.promised_delivery_date,
  ts.delivery_time,
  CASE WHEN ts.delivery_time::date <= ts.promised_delivery_date THEN true ELSE false END AS is_on_time
FROM public.trip_stop ts
JOIN public.trip t ON t.id = ts.trip_id
JOIN public.delivery_pod pod ON pod.id = ts.pod_id
WHERE ts.status = 'Delivered'
  AND ts.delivery_time IS NOT NULL
  AND ts.promised_delivery_date IS NOT NULL;

-- Application writes run through authenticated Server Actions using the service
-- role. Direct client access is read-only for authenticated users.
ALTER TABLE public.trip ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_stop ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_stop_line ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_expense ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_allocation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipment_event_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.upload_batch ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated read" ON public.trip;
CREATE POLICY "authenticated read" ON public.trip FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "authenticated read" ON public.trip_stop;
CREATE POLICY "authenticated read" ON public.trip_stop FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "authenticated read" ON public.trip_stop_line;
CREATE POLICY "authenticated read" ON public.trip_stop_line FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "authenticated read" ON public.trip_expense;
CREATE POLICY "authenticated read" ON public.trip_expense FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "authenticated read" ON public.expense_allocation;
CREATE POLICY "authenticated read" ON public.expense_allocation FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "authenticated read" ON public.shipment_event_log;
CREATE POLICY "authenticated read" ON public.shipment_event_log FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "authenticated read" ON public.upload_batch;
CREATE POLICY "authenticated read" ON public.upload_batch FOR SELECT TO authenticated USING (true);

COMMIT;
