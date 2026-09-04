-- ============================================================================
-- SCM Control Tower — New Tables Schema
-- Version: 1.0 | Date: September 2026
--
-- AMAN dijalankan: hanya CREATE TABLE IF NOT EXISTS
-- TIDAK menyentuh tabel yang sudah ada:
--   customers, vendors, routes, warehouses, master_sku,
--   shipments, shipment_status_logs,
--   receiving_header, receiving_detail,
--   outbound_header, outbound_detail,
--   transport_fleet, transport_rate_card,
--   issue_log, warehouse_checklist
--
-- Jalankan di Supabase SQL Editor
-- ============================================================================


-- ============================================================================
-- 1. INVENTORY SNAPSHOT
--    Stok fisik harian per SKU per gudang
--    (Menggantikan vw_inventory_alert yang hanya view)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.inventory_snapshot (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  snapshot_date     date         NOT NULL DEFAULT CURRENT_DATE,
  warehouse_code    text         NOT NULL REFERENCES public.warehouses(warehouse_code) ON UPDATE CASCADE,
  sku_code          text         NOT NULL REFERENCES public.master_sku(sku_code)       ON UPDATE CASCADE,
  qty_on_hand       numeric      NOT NULL DEFAULT 0,
  qty_reserved      numeric      NOT NULL DEFAULT 0,
  qty_available     numeric GENERATED ALWAYS AS (qty_on_hand - qty_reserved) STORED,
  avg_daily_usage   numeric               DEFAULT 0,
  days_of_supply    numeric GENERATED ALWAYS AS (
    CASE WHEN avg_daily_usage > 0
         THEN (qty_on_hand - qty_reserved) / avg_daily_usage
         ELSE NULL
    END
  ) STORED,
  alert_status      text GENERATED ALWAYS AS (
    CASE
      WHEN (qty_on_hand - qty_reserved) <= 0               THEN 'STOCKOUT'
      WHEN avg_daily_usage > 0
       AND (qty_on_hand - qty_reserved) / avg_daily_usage < 3  THEN 'CRITICAL'
      WHEN avg_daily_usage > 0
       AND (qty_on_hand - qty_reserved) / avg_daily_usage < 7  THEN 'LOW'
      ELSE 'OK'
    END
  ) STORED,
  notes             text,
  source            text         DEFAULT 'manual',    -- 'manual' | 'upload' | 'system'
  import_period     text,
  created_at        timestamptz  NOT NULL DEFAULT now(),
  updated_at        timestamptz  NOT NULL DEFAULT now(),
  UNIQUE (snapshot_date, warehouse_code, sku_code)
);

CREATE INDEX IF NOT EXISTS inventory_snapshot_date_idx
  ON public.inventory_snapshot (snapshot_date DESC);
CREATE INDEX IF NOT EXISTS inventory_snapshot_warehouse_idx
  ON public.inventory_snapshot (warehouse_code);
CREATE INDEX IF NOT EXISTS inventory_snapshot_sku_idx
  ON public.inventory_snapshot (sku_code);
CREATE INDEX IF NOT EXISTS inventory_snapshot_alert_idx
  ON public.inventory_snapshot (alert_status)
  WHERE alert_status IN ('STOCKOUT', 'CRITICAL', 'LOW');

COMMENT ON TABLE public.inventory_snapshot IS
  'Snapshot stok harian per SKU per gudang. Diisi manual atau via upload.';


-- ============================================================================
-- 2. INVENTORY MOVEMENT
--    Log setiap pergerakan stok (masuk / keluar / adjustment)
--    Terhubung ke receiving_detail dan outbound_detail secara logis
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.inventory_movement (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  movement_date     date         NOT NULL DEFAULT CURRENT_DATE,
  movement_type     text         NOT NULL CHECK (movement_type IN (
                      'INBOUND',      -- penerimaan dari transfer (PTR)
                      'OUTBOUND',     -- pengiriman ke customer (PSS)
                      'ADJUSTMENT',   -- koreksi stok
                      'RETURN',       -- retur
                      'TRANSFER_IN',  -- transfer masuk antar gudang
                      'TRANSFER_OUT'  -- transfer keluar antar gudang
                    )),
  warehouse_code    text         NOT NULL,
  sku_code          text         NOT NULL,
  lot_no            text,
  expiration_date   date,
  quantity          numeric      NOT NULL,              -- positif = masuk, negatif = keluar
  ref_document_no   text,                              -- PTR No. atau PSS No.
  ref_entry_no      bigint,                            -- entry_no dari NAV ILE
  ref_table         text,                              -- 'receiving_detail' | 'outbound_detail'
  notes             text,
  source_file       text,
  import_period     text,
  created_at        timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS inventory_movement_date_idx
  ON public.inventory_movement (movement_date DESC);
CREATE INDEX IF NOT EXISTS inventory_movement_warehouse_sku_idx
  ON public.inventory_movement (warehouse_code, sku_code);
CREATE INDEX IF NOT EXISTS inventory_movement_ref_doc_idx
  ON public.inventory_movement (ref_document_no)
  WHERE ref_document_no IS NOT NULL;

COMMENT ON TABLE public.inventory_movement IS
  'Log setiap pergerakan stok. quantity positif = masuk, negatif = keluar.';


-- ============================================================================
-- 3. KPI_DAILY
--    Snapshot KPI harian yang dihitung batch (atau on-demand)
--    Agar dashboard tidak query berat setiap load
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.kpi_daily (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kpi_date          date         NOT NULL,
  kpi_key           text         NOT NULL,   -- 'otd_rate', 'otif_rate', 'lead_time_avg', dll.
  kpi_value         numeric,
  kpi_unit          text,                    -- '%', 'hari', 'pcs', dll.
  dimension_key     text,                    -- filter dimension: 'project', 'customer_no', 'location_code'
  dimension_value   text,                    -- nilai dimension: 'MDN-HD-005', 'RSS000018', 'MDN-PAR'
  notes             text,
  computed_at       timestamptz  NOT NULL DEFAULT now(),
  UNIQUE (kpi_date, kpi_key, dimension_key, dimension_value)
);

CREATE INDEX IF NOT EXISTS kpi_daily_date_key_idx
  ON public.kpi_daily (kpi_date DESC, kpi_key);

COMMENT ON TABLE public.kpi_daily IS
  'Snapshot KPI harian. Isi via scheduled function atau manual insert.
   kpi_key contoh: otd_rate, avg_delay_days, pss_count, ptr_count,
                   stockout_sku_count, cost_per_delivery';


-- ============================================================================
-- 4. ISSUE_COMMENT
--    Komentar / update progres per issue (sub-table dari issue_log)
--    Tidak mengubah issue_log yang sudah ada
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.issue_comment (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  issue_id          bigint       NOT NULL,   -- FK ke issue_log.id (integer)
  comment_text      text         NOT NULL,
  comment_by        text,
  status_change_to  text,                   -- kalau komentar juga mengubah status
  created_at        timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS issue_comment_issue_idx
  ON public.issue_comment (issue_id);

COMMENT ON TABLE public.issue_comment IS
  'Thread komentar per issue. Terpisah dari issue_log agar tidak mengubah tabel lama.';


-- ============================================================================
-- 5. WAREHOUSE_CHECKLIST_ITEM
--    Checklist dinamis per area (bukan boolean hardcoded)
--    Komplemen dari warehouse_checklist yang ada
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.warehouse_checklist_item (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  checklist_id      bigint       NOT NULL,   -- FK ke warehouse_checklist.id
  area_code         text         NOT NULL,   -- 'RECEIVING', 'STAGING', 'LOADING', 'DOCK', dll.
  item_description  text         NOT NULL,
  is_ok             boolean      NOT NULL DEFAULT false,
  notes             text,
  checked_by        text,
  checked_at        timestamptz
);

CREATE INDEX IF NOT EXISTS checklist_item_checklist_idx
  ON public.warehouse_checklist_item (checklist_id);

COMMENT ON TABLE public.warehouse_checklist_item IS
  'Item checklist dinamis per area gudang. Komplemen warehouse_checklist yang sudah ada.';


-- ============================================================================
-- 6. DELIVERY_POD
--    Proof of Delivery aktual per PSS
--    Tidak mengubah outbound_header, hanya menambah data POD
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.delivery_pod (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  pss_no            text         NOT NULL,   -- referensi ke outbound_header.pss_no
  outbound_header_id bigint,                 -- FK ke outbound_header.id (nullable)
  pod_date          date,                   -- tanggal diterima customer aktual
  pod_status        text         NOT NULL DEFAULT 'pending'
                    CHECK (pod_status IN ('pending', 'received', 'partial', 'rejected', 'missing')),
  received_by       text,                   -- nama penerima
  notes             text,
  photo_url         text,                   -- URL foto bukti terima (opsional)
  input_by          text,
  created_at        timestamptz  NOT NULL DEFAULT now(),
  updated_at        timestamptz  NOT NULL DEFAULT now(),
  UNIQUE (pss_no)                           -- satu PSS satu POD record
);

CREATE INDEX IF NOT EXISTS delivery_pod_status_idx
  ON public.delivery_pod (pod_status)
  WHERE pod_status = 'pending';
CREATE INDEX IF NOT EXISTS delivery_pod_date_idx
  ON public.delivery_pod (pod_date DESC);

COMMENT ON TABLE public.delivery_pod IS
  'Proof of Delivery aktual per PSS. Digunakan untuk OTD/OTIF yang akurat.
   Tidak mengubah outbound_header — ini tabel terpisah.';


-- ============================================================================
-- 7. AUDIT_LOG
--    Log perubahan data penting (insert/update/delete)
--    Untuk kebutuhan compliance dan debugging
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.audit_log (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  table_name        text         NOT NULL,
  record_id         text         NOT NULL,
  operation         text         NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data          jsonb,
  new_data          jsonb,
  changed_by        text,
  changed_at        timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_log_table_record_idx
  ON public.audit_log (table_name, record_id);
CREATE INDEX IF NOT EXISTS audit_log_changed_at_idx
  ON public.audit_log (changed_at DESC);

COMMENT ON TABLE public.audit_log IS
  'Generic audit log untuk semua tabel. Isi via trigger atau manual dari aplikasi.';


-- ============================================================================
-- UPDATED_AT TRIGGERS (untuk tabel baru yang punya kolom updated_at)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- inventory_snapshot
DROP TRIGGER IF EXISTS inventory_snapshot_updated_at ON public.inventory_snapshot;
CREATE TRIGGER inventory_snapshot_updated_at
  BEFORE UPDATE ON public.inventory_snapshot
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- delivery_pod
DROP TRIGGER IF EXISTS delivery_pod_updated_at ON public.delivery_pod;
CREATE TRIGGER delivery_pod_updated_at
  BEFORE UPDATE ON public.delivery_pod
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ============================================================================
-- RLS — Row Level Security
-- Aktifkan tapi beri akses penuh ke service_role (used by Server Actions)
-- Batasi authenticated dan anon sesuai kebutuhan
-- ============================================================================

ALTER TABLE public.inventory_snapshot      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movement      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_daily               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issue_comment           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_checklist_item ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_pod            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log               ENABLE ROW LEVEL SECURITY;

-- Policy: authenticated user bisa read semua
CREATE POLICY "authenticated read" ON public.inventory_snapshot
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated read" ON public.inventory_movement
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated read" ON public.kpi_daily
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated read" ON public.issue_comment
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated read" ON public.warehouse_checklist_item
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated read" ON public.delivery_pod
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated read" ON public.audit_log
  FOR SELECT TO authenticated USING (true);

-- Policy: service_role bypass (sudah default di Supabase — service_role selalu bypass RLS)
-- Tidak perlu ditambahkan secara eksplisit


-- ============================================================================
-- VIEW: vw_otd_summary
--    On-Time Delivery summary per bulan
--    Menggunakan outbound_header yang sudah ada + delivery_pod (baru)
-- ============================================================================
CREATE OR REPLACE VIEW public.vw_otd_summary AS
SELECT
  date_trunc('month', h.document_date)::date AS month,
  COUNT(*)                                    AS total_shipments,
  COUNT(*) FILTER (WHERE h.is_late = false)  AS on_time,
  COUNT(*) FILTER (WHERE h.is_late = true)   AS late,
  ROUND(
    COUNT(*) FILTER (WHERE h.is_late = false)::numeric
    / NULLIF(COUNT(*), 0) * 100, 1
  )                                           AS otd_rate_pct,
  ROUND(AVG(h.delivery_delay_days), 1)        AS avg_delay_days,
  COUNT(p.id)                                 AS pod_recorded,
  COUNT(*) FILTER (WHERE p.pod_status = 'received') AS pod_received
FROM public.outbound_header h
LEFT JOIN public.delivery_pod p ON p.pss_no = h.pss_no
WHERE h.document_date IS NOT NULL
GROUP BY date_trunc('month', h.document_date)
ORDER BY month DESC;

COMMENT ON VIEW public.vw_otd_summary IS
  'OTD rate bulanan dari outbound_header. is_late = cust_receipt_date > promised_delivery_date.';


-- ============================================================================
-- VIEW: vw_inventory_current
--    Stok terkini (snapshot terbaru per SKU per gudang)
-- ============================================================================
CREATE OR REPLACE VIEW public.vw_inventory_current AS
SELECT DISTINCT ON (warehouse_code, sku_code)
  s.snapshot_date,
  s.warehouse_code,
  s.sku_code,
  m.item_name,
  m.category,
  m."group",
  m.uom,
  s.qty_on_hand,
  s.qty_reserved,
  s.qty_available,
  s.avg_daily_usage,
  s.days_of_supply,
  s.alert_status,
  m.safety_stock
FROM public.inventory_snapshot s
JOIN public.master_sku m ON m.sku_code = s.sku_code
ORDER BY warehouse_code, sku_code, snapshot_date DESC;

COMMENT ON VIEW public.vw_inventory_current IS
  'Snapshot stok terkini per SKU per gudang (baris terbaru dari inventory_snapshot).';


-- ============================================================================
-- SELESAI
-- Tabel baru yang dibuat:
--   1. inventory_snapshot      — stok harian per SKU per gudang
--   2. inventory_movement      — log pergerakan stok
--   3. kpi_daily               — snapshot KPI harian
--   4. issue_comment           — thread komentar per issue
--   5. warehouse_checklist_item — checklist item dinamis
--   6. delivery_pod            — POD aktual per PSS
--   7. audit_log               — log perubahan data
--
-- View baru:
--   vw_otd_summary             — OTD rate bulanan
--   vw_inventory_current       — stok terkini
--
-- Tabel LAMA tidak diubah sama sekali.
-- ============================================================================
