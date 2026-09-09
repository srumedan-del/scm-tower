-- ============================================================================
-- SCM Control Tower — Migration v1.7: Shipment Cost Detail
-- Tanggal: September 2026
--
-- Menambah kolom biaya spesifik per model transporter:
--   - Indah Logistik (Retail) : no_resi, biaya_kirim_paket per resi
--   - ASSA (Trucking)         : biaya_trucking, biaya_tkbm
--   - Internal                : sudah ada, tambah misc_cost untuk lain-lain
-- ============================================================================

-- 1. Tambah kolom baru di shipment_tracking
ALTER TABLE public.shipment_tracking
  ADD COLUMN IF NOT EXISTS no_resi          text,
  ADD COLUMN IF NOT EXISTS biaya_tkbm       numeric(12,2),
  ADD COLUMN IF NOT EXISTS biaya_trucking   numeric(12,2),
  ADD COLUMN IF NOT EXISTS misc_cost        numeric(12,2),
  ADD COLUMN IF NOT EXISTS misc_cost_notes  text;

COMMENT ON COLUMN public.shipment_tracking.no_resi         IS 'Indah Logistik: nomor resi pengiriman';
COMMENT ON COLUMN public.shipment_tracking.biaya_tkbm      IS 'ASSA Trucking: biaya Tenaga Kerja Bongkar Muat';
COMMENT ON COLUMN public.shipment_tracking.biaya_trucking  IS 'ASSA Trucking: biaya trucking per trip';
COMMENT ON COLUMN public.shipment_tracking.misc_cost       IS 'Internal: biaya lain-lain (uang jalan, dll)';
COMMENT ON COLUMN public.shipment_tracking.misc_cost_notes IS 'Internal: keterangan biaya lain-lain';

-- 2. Update GENERATED total_biaya agar ikut kolom baru
--    (drop & recreate karena GENERATED tidak bisa ALTER)
ALTER TABLE public.shipment_tracking
  DROP COLUMN IF EXISTS total_biaya CASCADE;

ALTER TABLE public.shipment_tracking
  ADD COLUMN total_biaya numeric(12,2) GENERATED ALWAYS AS (
    CASE
      -- Internal: jumlah semua komponen operasional
      WHEN cost_model = 'Internal' OR cost_model IS NULL THEN
        COALESCE(bbm_rupiah, 0)
        + COALESCE(bongkar_muat_cost, 0)
        + COALESCE(hotel_cost, 0)
        + COALESCE(uang_makan_driver, 0)
        + COALESCE(uang_makan_helper, 0)
        + COALESCE(toll_cost, 0)
        + COALESCE(parkir_cost, 0)
        + COALESCE(kirim_paket_cost, 0)
        + COALESCE(misc_cost, 0)
      -- Trucking (ASSA): biaya_trucking + biaya_tkbm
      WHEN cost_model = 'Trucking' THEN
        COALESCE(biaya_trucking, 0)
        + COALESCE(biaya_tkbm, 0)
      -- Retail (Indah Logistik): total_biaya_eksternal (jumlah semua resi)
      WHEN cost_model = 'Retail' THEN
        COALESCE(total_biaya_eksternal, 0)
      ELSE 0
    END
  ) STORED;

-- 3. Recreate cost_ratio GENERATED (ikut total_biaya baru)
ALTER TABLE public.shipment_tracking
  DROP COLUMN IF EXISTS cost_ratio CASCADE;

ALTER TABLE public.shipment_tracking
  ADD COLUMN cost_ratio numeric(6,2) GENERATED ALWAYS AS (
    CASE
      WHEN invoice_value IS NOT NULL AND invoice_value > 0
        AND (
          CASE
            WHEN cost_model = 'Internal' OR cost_model IS NULL THEN
              COALESCE(bbm_rupiah,0)+COALESCE(bongkar_muat_cost,0)+COALESCE(hotel_cost,0)
              +COALESCE(uang_makan_driver,0)+COALESCE(uang_makan_helper,0)
              +COALESCE(toll_cost,0)+COALESCE(parkir_cost,0)+COALESCE(kirim_paket_cost,0)
              +COALESCE(misc_cost,0)
            WHEN cost_model = 'Trucking' THEN
              COALESCE(biaya_trucking,0)+COALESCE(biaya_tkbm,0)
            WHEN cost_model = 'Retail' THEN
              COALESCE(total_biaya_eksternal,0)
            ELSE 0
          END
        ) > 0
      THEN ROUND(
        (
          CASE
            WHEN cost_model = 'Internal' OR cost_model IS NULL THEN
              COALESCE(bbm_rupiah,0)+COALESCE(bongkar_muat_cost,0)+COALESCE(hotel_cost,0)
              +COALESCE(uang_makan_driver,0)+COALESCE(uang_makan_helper,0)
              +COALESCE(toll_cost,0)+COALESCE(parkir_cost,0)+COALESCE(kirim_paket_cost,0)
              +COALESCE(misc_cost,0)
            WHEN cost_model = 'Trucking' THEN
              COALESCE(biaya_trucking,0)+COALESCE(biaya_tkbm,0)
            WHEN cost_model = 'Retail' THEN
              COALESCE(total_biaya_eksternal,0)
            ELSE 0
          END / invoice_value * 100
        ), 2)
      ELSE NULL
    END
  ) STORED;

-- 4. Recreate vw_shipment_tms agar include kolom baru
CREATE OR REPLACE VIEW public.vw_shipment_tms AS
SELECT
  st.id,
  st.source_type,
  st.pss_no,
  st.crossdocking_id,
  st.outbound_header_id,
  st.trip_id,
  st.transporter_id,
  st.vehicle_id,
  st.driver_id,
  st.helper_id,
  st.route_id,
  st.customer_code,
  st.customer_name,
  st.destination_address,
  st.destination_city,
  st.dk_lk,
  st.document_date,
  st.promised_delivery_date,
  st.status,
  st.dispatch_time,
  st.delivery_time,
  st.is_on_time,
  st.weight_kg,
  st.cost_model,
  st.payment_voucher_no,
  -- Internal costs
  st.bbm_liter,
  st.bbm_rupiah,
  st.bongkar_muat_cost,
  st.hotel_cost,
  st.uang_makan_driver,
  st.uang_makan_helper,
  st.toll_cost,
  st.parkir_cost,
  st.kirim_paket_cost,
  st.misc_cost,
  st.misc_cost_notes,
  -- Retail (Indah Logistik)
  st.no_resi,
  st.invoice_no_eksternal,
  st.total_biaya_eksternal,
  -- Trucking (ASSA)
  st.biaya_trucking,
  st.biaya_tkbm,
  -- Summary
  st.invoice_value,
  st.total_biaya,
  st.cost_ratio,
  st.notes,
  st.created_by,
  st.created_at,
  st.updated_at,
  -- Joined
  mt.name            AS transporter_name,
  mt.type            AS transporter_type,
  mt.service_model   AS transporter_service_model,
  mv.vehicle_no,
  mv.vehicle_type,
  md.driver_name,
  mh.driver_name     AS helper_name,
  mr.route_code
FROM public.shipment_tracking st
LEFT JOIN public.master_transporter mt ON mt.id = st.transporter_id
LEFT JOIN public.transport_fleet     mv ON mv.id = st.vehicle_id
LEFT JOIN public.master_driver       md ON md.id = st.driver_id
LEFT JOIN public.master_driver       mh ON mh.id = st.helper_id
LEFT JOIN public.routes              mr ON mr.id = st.route_id;

COMMENT ON VIEW public.vw_shipment_tms IS
  'View TMS lengkap v1.7 — biaya per model: Internal, Retail (Indah), Trucking (ASSA)';
