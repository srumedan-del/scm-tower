-- ============================================================================
-- SEED DATA DUMMY — Test fitur baru PRD v1.5
-- Jalankan di Supabase SQL Editor SETELAH semua migration sukses
-- ============================================================================

-- ── 1. Master Driver (Driver & Helper) ───────────────────────────────────────
INSERT INTO public.master_driver (driver_code, driver_name, role, sim_no, phone, is_active, notes)
VALUES
  ('DRV-001', 'BUDI SANTOSO',   'Driver', 'SIM-A-001234', '081234567890', true, 'Driver utama truck 1'),
  ('DRV-002', 'AGUS PRASETYO',  'Driver', 'SIM-A-005678', '081234567891', true, 'Driver utama truck 2'),
  ('HLP-001', 'RUDI HARTONO',   'Helper', NULL,            '081234567892', true, 'Helper truck 1'),
  ('HLP-002', 'SANDI WIJAYA',   'Helper', NULL,            '081234567893', true, 'Helper truck 2')
ON CONFLICT (driver_code) DO NOTHING;

-- ── 2. Update transporter (jika seed dari migration belum diisi nama aktual) ─
UPDATE public.master_transporter SET name = 'Internal — SRU Medan'      WHERE transporter_code = 'TRANS-INT-SRU';
UPDATE public.master_transporter SET name = 'Ekspedisi Andalas Cargo'   WHERE transporter_code = 'TRANS-EXT-001';
UPDATE public.master_transporter SET name = 'Truck Nusantara Express'   WHERE transporter_code = 'TRANS-EXT-002';
UPDATE public.master_transporter SET name = 'Kilat Delivery Service'    WHERE transporter_code = 'TRANS-EXT-003';

-- ── 3. Customers — tambah field is_hd_customer + machine_count ──────────────
-- Update customer yang sudah ada (jika ada) atau insert dummy
INSERT INTO public.customers (customer_code, customer_name, city, province, address, dk_lk, is_hd_customer, machine_count, is_active)
VALUES
  ('KLI-HD-001', 'RS ADVENT MEDAN',          'MEDAN',       'SUMATERA UTARA', 'JL. GATOT SUBROTO NO.1',     'DK', true,  12, true),
  ('KLI-HD-002', 'KLINIK DIALISIS SEHAT',    'MEDAN',       'SUMATERA UTARA', 'JL. SUTOMO NO.45',           'DK', true,  6,  true),
  ('KLI-HD-003', 'RS UMUM DELI',             'MEDAN',       'SUMATERA UTARA', 'JL. MERDEKA NO.10',          'DK', true,  8,  true),
  ('KLI-HD-004', 'RSU PEMATANG SIANTAR',     'PEMATANG SIANTAR', 'SUMATERA UTARA', 'JL. SISINGAMANGARAJA',  'LK', true,  10, true),
  ('KLI-HD-005', 'RS PIRNGADI',              'MEDAN',       'SUMATERA UTARA', 'JL. HM JONI NO.93',          'DK', true,  20, true),
  ('KLI-REG-001','APOTEK KIMIA FARMA MEDAN', 'MEDAN',       'SUMATERA UTARA', 'JL. PEMUDA NO.12',           'DK', false, null,true)
ON CONFLICT (customer_code) DO UPDATE SET
  is_hd_customer = EXCLUDED.is_hd_customer,
  machine_count  = EXCLUDED.machine_count,
  dk_lk          = EXCLUDED.dk_lk;

-- ── 4. Crossdocking Header ───────────────────────────────────────────────────
INSERT INTO public.crossdocking_header
  (customer_code, customer_name, destination_address, hq_reference_no,
   received_from_hq_date, promised_delivery_date, status, notes)
VALUES
  ('KLI-HD-001', 'RS ADVENT MEDAN',       'JL. GATOT SUBROTO NO.1 MEDAN',   'HQ-REF-2026-001',
   '2026-09-01', '2026-09-05', 'Draft',      'Pengiriman rutin HD Set'),
  ('KLI-HD-004', 'RSU PEMATANG SIANTAR',  'JL. SISINGAMANGARAJA SIANTAR',    'HQ-REF-2026-002',
   '2026-09-02', '2026-09-06', 'Dispatched', 'Urgent — stok hampir habis'),
  ('KLI-HD-002', 'KLINIK DIALISIS SEHAT', 'JL. SUTOMO NO.45 MEDAN',         NULL,
   '2026-09-03', '2026-09-08', 'Delivered',  'Sudah sampai')
ON CONFLICT DO NOTHING;

-- ── 5. Shipment Tracking ─────────────────────────────────────────────────────
-- Ambil ID transporter & driver untuk referensi
DO $$
DECLARE
  v_trans_int  bigint;
  v_trans_ext1 bigint;
  v_trans_ext2 bigint;
  v_drv1       bigint;
  v_drv2       bigint;
  v_hlp1       bigint;
  v_fleet1     bigint;
  v_fleet2     bigint;
  v_cd1        bigint;
  v_cd2        bigint;
BEGIN
  SELECT id INTO v_trans_int  FROM public.master_transporter WHERE transporter_code = 'TRANS-INT-SRU'  LIMIT 1;
  SELECT id INTO v_trans_ext1 FROM public.master_transporter WHERE transporter_code = 'TRANS-EXT-001' LIMIT 1;
  SELECT id INTO v_trans_ext2 FROM public.master_transporter WHERE transporter_code = 'TRANS-EXT-002' LIMIT 1;
  SELECT id INTO v_drv1       FROM public.master_driver      WHERE driver_code = 'DRV-001'            LIMIT 1;
  SELECT id INTO v_drv2       FROM public.master_driver      WHERE driver_code = 'DRV-002'            LIMIT 1;
  SELECT id INTO v_hlp1       FROM public.master_driver      WHERE driver_code = 'HLP-001'            LIMIT 1;
  SELECT id INTO v_fleet1     FROM public.transport_fleet                                              LIMIT 1;
  SELECT id INTO v_fleet2     FROM public.transport_fleet OFFSET 1                                     LIMIT 1;
  SELECT id INTO v_cd1        FROM public.crossdocking_header ORDER BY id LIMIT 1;
  SELECT id INTO v_cd2        FROM public.crossdocking_header ORDER BY id OFFSET 1 LIMIT 1;

  -- Shipment 1: PSS Internal DK — Draft (belum assign)
  INSERT INTO public.shipment_tracking
    (source_type, pss_no, customer_code, customer_name, destination_city, dk_lk,
     document_date, promised_delivery_date, status)
  VALUES
    ('PSS', 'PSS-2026-00101', 'KLI-HD-001', 'RS ADVENT MEDAN', 'MEDAN', 'DK',
     '2026-09-01', '2026-09-05', 'Draft');

  -- Shipment 2: PSS Internal DK — Dispatched + biaya rinci
  INSERT INTO public.shipment_tracking
    (source_type, pss_no, customer_code, customer_name, destination_city, dk_lk,
     document_date, promised_delivery_date, status,
     transporter_id, vehicle_id, driver_id, helper_id,
     trip_id, dispatch_time, cost_model, payment_voucher_no,
     bbm_liter, bbm_rupiah, bongkar_muat_cost, uang_makan_driver, uang_makan_helper,
     toll_cost, parkir_cost, invoice_value)
  VALUES
    ('PSS', 'PSS-2026-00102', 'KLI-HD-002', 'KLINIK DIALISIS SEHAT', 'MEDAN', 'DK',
     '2026-09-02', '2026-09-06', 'Dispatched',
     v_trans_int, v_fleet1, v_drv1, v_hlp1,
     'TRIP-20260902-01', '2026-09-02 07:30:00+07', 'Internal', 'K-MDN-B-2609-001',
     12.5, 137500, 50000, 35000, 35000,
     25000, 10000, 15000000);

  -- Shipment 3: PSS Internal LK — Delivered (on time) + biaya hotel
  INSERT INTO public.shipment_tracking
    (source_type, pss_no, customer_code, customer_name, destination_city, dk_lk,
     document_date, promised_delivery_date, status,
     transporter_id, vehicle_id, driver_id, helper_id,
     trip_id, dispatch_time, delivery_time, cost_model, payment_voucher_no,
     bbm_liter, bbm_rupiah, bongkar_muat_cost, hotel_cost,
     uang_makan_driver, uang_makan_helper, toll_cost, invoice_value)
  VALUES
    ('PSS', 'PSS-2026-00103', 'KLI-HD-004', 'RSU PEMATANG SIANTAR', 'PEMATANG SIANTAR', 'LK',
     '2026-09-01', '2026-09-03', 'Delivered',
     v_trans_int, v_fleet2, v_drv2, v_hlp1,
     'TRIP-20260901-01', '2026-09-01 06:00:00+07', '2026-09-03 14:30:00+07',
     'Internal', 'K-MDN-B-2609-002',
     45, 495000, 100000, 250000,
     70000, 70000, 85000, 28000000);

  -- Shipment 4: PSS Eksternal Retail
  INSERT INTO public.shipment_tracking
    (source_type, pss_no, customer_code, customer_name, destination_city, dk_lk,
     document_date, promised_delivery_date, status,
     transporter_id, cost_model,
     invoice_no_eksternal, total_biaya_eksternal, invoice_value)
  VALUES
    ('PSS', 'PSS-2026-00104', 'KLI-REG-001', 'APOTEK KIMIA FARMA MEDAN', 'MEDAN', 'DK',
     '2026-09-03', '2026-09-05', 'In Transit',
     v_trans_ext1, 'Retail',
     'INV/ANC/2026/0901', 180000, 5000000);

  -- Shipment 5: TERLAMBAT — untuk test alert dashboard
  INSERT INTO public.shipment_tracking
    (source_type, pss_no, customer_code, customer_name, destination_city, dk_lk,
     document_date, promised_delivery_date, status,
     transporter_id, cost_model)
  VALUES
    ('PSS', 'PSS-2026-00099', 'KLI-HD-005', 'RS PIRNGADI', 'MEDAN', 'DK',
     '2026-08-28', '2026-09-01', 'Dispatched',
     v_trans_int, 'Internal');

  -- Shipment 6: Crossdocking
  IF v_cd1 IS NOT NULL THEN
    INSERT INTO public.shipment_tracking
      (source_type, crossdocking_id, customer_code, customer_name, destination_city, dk_lk,
       document_date, promised_delivery_date, status)
    VALUES
      ('Crossdocking', v_cd1, 'KLI-HD-001', 'RS ADVENT MEDAN', 'MEDAN', 'DK',
       '2026-09-01', '2026-09-05', 'Draft');
  END IF;
END $$;

-- ── 6. Delivery POD untuk shipment yang sudah Delivered ──────────────────────
DO $$
DECLARE v_ship_id bigint;
BEGIN
  SELECT id INTO v_ship_id FROM public.shipment_tracking
  WHERE pss_no = 'PSS-2026-00103' AND status = 'Delivered' LIMIT 1;

  IF v_ship_id IS NOT NULL THEN
    INSERT INTO public.delivery_pod (tracking_id, receiver_name, received_at, notes)
    VALUES (v_ship_id, 'SITI RAHAYU (Admin RS)', '2026-09-03 14:30:00+07', 'Diterima lengkap, kondisi baik')
    ON CONFLICT (tracking_id) DO NOTHING;
  END IF;
END $$;

-- ── 7. HD Stock Monitoring ────────────────────────────────────────────────────
DO $$
DECLARE v_cust_id bigint;
BEGIN
  -- RS ADVENT — stok aman
  SELECT id INTO v_cust_id FROM public.customers WHERE customer_code = 'KLI-HD-001' LIMIT 1;
  IF v_cust_id IS NOT NULL THEN
    INSERT INTO public.hd_stock_monitoring
      (customer_id, snapshot_date, treatment_per_day_per_machine, working_days_per_month,
       safety_stock_days, rop_days, lead_time_reorder_days,
       last_known_stock_date, last_known_stock_qty, last_shipment_date, last_shipment_qty, notes)
    VALUES
      (v_cust_id, CURRENT_DATE, 2, 25, 6, 8, 9,
       '2026-09-01', 0, '2026-09-01', 600, 'Pengiriman terbaru 1 Sep');
  END IF;

  -- KLINIK DIALISIS — mendekati FU-PO
  SELECT id INTO v_cust_id FROM public.customers WHERE customer_code = 'KLI-HD-002' LIMIT 1;
  IF v_cust_id IS NOT NULL THEN
    INSERT INTO public.hd_stock_monitoring
      (customer_id, snapshot_date, treatment_per_day_per_machine, working_days_per_month,
       safety_stock_days, rop_days, lead_time_reorder_days,
       last_known_stock_date, last_known_stock_qty, last_shipment_date, last_shipment_qty, notes)
    VALUES
      (v_cust_id, CURRENT_DATE, 2, 25, 6, 8, 9,
       '2026-08-20', 0, '2026-08-20', 150, 'Stok hampir habis — perlu FU-PO segera');
  END IF;

  -- RSU PEMATANG SIANTAR — kritis/lewat FU-PO
  SELECT id INTO v_cust_id FROM public.customers WHERE customer_code = 'KLI-HD-004' LIMIT 1;
  IF v_cust_id IS NOT NULL THEN
    INSERT INTO public.hd_stock_monitoring
      (customer_id, snapshot_date, treatment_per_day_per_machine, working_days_per_month,
       safety_stock_days, rop_days, lead_time_reorder_days,
       last_known_stock_date, last_known_stock_qty, last_shipment_date, last_shipment_qty, notes)
    VALUES
      (v_cust_id, CURRENT_DATE, 2, 25, 6, 8, 9,
       '2026-08-01', 0, '2026-08-01', 100, 'Stok sangat kritis — sudah lewat FU-PO');
  END IF;

  -- RS PIRNGADI — stok aman (baru dikirim)
  SELECT id INTO v_cust_id FROM public.customers WHERE customer_code = 'KLI-HD-005' LIMIT 1;
  IF v_cust_id IS NOT NULL THEN
    INSERT INTO public.hd_stock_monitoring
      (customer_id, snapshot_date, treatment_per_day_per_machine, working_days_per_month,
       safety_stock_days, rop_days, lead_time_reorder_days,
       last_known_stock_date, last_known_stock_qty, last_shipment_date, last_shipment_qty, notes)
    VALUES
      (v_cust_id, CURRENT_DATE, 2, 25, 6, 8, 9,
       '2026-09-04', 0, '2026-09-04', 1200, 'Baru dikirim besar — aman 30 hari');
  END IF;
END $$;

-- ── 8. Budget Request ─────────────────────────────────────────────────────────
INSERT INTO public.budget_request
  (period, lk_amount_projected, dk_amount_projected, buffer_amount,
   rounded_request_amount, bank_name, bank_account_no, bank_account_holder, notes)
VALUES
  ('2026-09',
   3500000,   -- LK: Pematang Siantar + sekitarnya
   2200000,   -- DK: dalam kota Medan
   500000,    -- buffer
   6500000,   -- dibulatkan ke atas
   'Bank Mandiri', '1234-5678-9012', 'PT SUMBER RAYA USAHA MEDAN',
   'Pengajuan biaya kirim September 2026')
ON CONFLICT (period) DO NOTHING;

-- Insert approval checklist
DO $$
DECLARE v_req_id bigint;
BEGIN
  SELECT id INTO v_req_id FROM public.budget_request WHERE period = '2026-09' LIMIT 1;
  IF v_req_id IS NOT NULL THEN
    INSERT INTO public.budget_approval_log (budget_request_id, approver_name, sequence_no, status)
    VALUES
      (v_req_id, 'Kepala Gudang Medan',      1, 'Approved'),
      (v_req_id, 'Supervisor Logistik',      2, 'Pending'),
      (v_req_id, 'Finance Manager Pusat',    3, 'Pending')
    ON CONFLICT DO NOTHING;

    UPDATE public.budget_approval_log
      SET status = 'Approved', approved_at = now()
      WHERE budget_request_id = v_req_id AND sequence_no = 1;
  END IF;
END $$;

-- ── Selesai ───────────────────────────────────────────────────────────────────
SELECT 'Seed data berhasil diinsert' AS status;
