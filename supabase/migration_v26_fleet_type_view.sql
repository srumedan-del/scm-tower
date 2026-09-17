-- ============================================================================
-- MIGRATION v26: Tambah kolom biaya trucking ke shipment_tracking + fleet_type ke vw_shipment_tms
--
-- shipment_tracking: tambah kolom biaya Trucking (ASSA) dan Retail (Indah)
-- vw_shipment_tms: tambah fleet_type (dari master_transporter.type), biaya trucking, dan notes
--
-- AMAN dijalankan: ADD COLUMN IF NOT EXISTS + CREATE OR REPLACE VIEW
-- ============================================================================

-- ── 1. Tambah kolom biaya ke shipment_tracking ──
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='shipment_tracking' AND column_name='biaya_trucking') THEN
    ALTER TABLE public.shipment_tracking ADD COLUMN biaya_trucking numeric;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='shipment_tracking' AND column_name='biaya_tkbm') THEN
    ALTER TABLE public.shipment_tracking ADD COLUMN biaya_tkbm numeric;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='shipment_tracking' AND column_name='no_resi') THEN
    ALTER TABLE public.shipment_tracking ADD COLUMN no_resi text;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='shipment_tracking' AND column_name='invoice_no_eksternal') THEN
    ALTER TABLE public.shipment_tracking ADD COLUMN invoice_no_eksternal text;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='shipment_tracking' AND column_name='total_biaya_eksternal') THEN
    ALTER TABLE public.shipment_tracking ADD COLUMN total_biaya_eksternal numeric;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='shipment_tracking' AND column_name='misc_cost') THEN
    ALTER TABLE public.shipment_tracking ADD COLUMN misc_cost numeric;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='shipment_tracking' AND column_name='misc_cost_notes') THEN
    ALTER TABLE public.shipment_tracking ADD COLUMN misc_cost_notes text;
  END IF;
END $$;

-- ── 2. Update vw_shipment_tms — tambah fleet_type, biaya trucking, dan notes ──
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
  st.status,
  st.customer_code,
  st.customer_name,
  st.destination_address,
  st.destination_city,
  st.dk_lk,
  st.document_date,
  st.promised_delivery_date,
  st.dispatch_time,
  st.delivery_time,
  st.is_on_time,
  st.weight_kg,
  st.cost_model,
  -- Fleet type: diturunkan dari master_transporter.type
  tr.type               AS fleet_type,
  -- Biaya Internal (rinci)
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
  -- Biaya Internal — tambahan
  st.misc_cost,
  st.misc_cost_notes,
  -- Biaya Retail (Indah Logistik)
  st.no_resi,
  st.invoice_no_eksternal,
  st.total_biaya_eksternal,
  -- Biaya Trucking (ASSA)
  st.biaya_trucking,
  st.biaya_tkbm,
  -- Summary
  st.invoice_value,
  st.total_biaya,
  st.cost_ratio,
  -- Legacy
  st.trip_cost,
  -- Joined fields
  tr.name              AS transporter_name,
  tr.type              AS transporter_type,
  tr.service_model     AS transporter_service_model,
  tf.vehicle_no,
  tf.vehicle_type,
  md.driver_name,
  md.phone             AS driver_phone,
  mh.driver_name       AS helper_name,
  mh.phone             AS helper_phone,
  r.route_code,
  r.origin             AS route_origin,
  r.destination        AS route_destination,
  st.notes,
  st.created_at,
  st.updated_at
FROM public.shipment_tracking st
LEFT JOIN public.master_transporter tr ON tr.id = st.transporter_id
LEFT JOIN public.transport_fleet    tf ON tf.id = st.vehicle_id
LEFT JOIN public.master_driver      md ON md.id = st.driver_id
LEFT JOIN public.master_driver      mh ON mh.id = st.helper_id
LEFT JOIN public.routes              r ON r.id  = st.route_id;

COMMENT ON COLUMN public.vw_shipment_tms.fleet_type IS
  'Jenis armada: Internal (kendaraan milik SRU) atau Eksternal (sewa/vendor). Diturunkan dari master_transporter.type.';
