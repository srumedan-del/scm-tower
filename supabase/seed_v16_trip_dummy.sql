-- SCM Control Tower v1.6 -- Trip Control dummy data
-- Safe to run repeatedly. Every record is marked DUMMY / V16DEMO.
-- Prerequisite: migration_v16_trip_control.sql must have been run.

BEGIN;

INSERT INTO public.vendors (vendor_code, vendor_name, vendor_type, is_active)
VALUES ('V16DEMO', 'DUMMY - DEMO TRANSPORT MEDAN', 'Internal', true)
ON CONFLICT (vendor_code) DO UPDATE
SET vendor_name = EXCLUDED.vendor_name,
    vendor_type = EXCLUDED.vendor_type,
    is_active = true;

DO $$
DECLARE
  v_vendor_id bigint;
  v_trip_id bigint;
  v_shipment_1 bigint;
  v_shipment_2 bigint;
  v_expense_1 bigint;
  v_expense_2 bigint;
BEGIN
  SELECT id INTO v_vendor_id
  FROM public.vendors WHERE vendor_code = 'V16DEMO';

  SELECT id INTO v_shipment_1
  FROM public.shipment_tracking WHERE pss_no = 'PSS-DUMMY-V16-001';
  IF v_shipment_1 IS NULL THEN
    INSERT INTO public.shipment_tracking (
      source_type, pss_no, customer_code, customer_name, destination_address,
      destination_city, dk_lk, document_date, promised_delivery_date, status,
      vendor_id, cost_model, invoice_value, notes
    ) VALUES (
      'PSS', 'PSS-DUMMY-V16-001', 'CUS-DUMMY-V16-01', 'DUMMY RS MEDAN', 'Jl. Dummy Medan No. 1',
      'MEDAN', 'DK', CURRENT_DATE - 1, CURRENT_DATE + 1, 'Draft',
      v_vendor_id, 'Internal', 15000000, 'DUMMY V16 -- aman dihapus'
    ) RETURNING id INTO v_shipment_1;
  END IF;

  SELECT id INTO v_shipment_2
  FROM public.shipment_tracking WHERE pss_no = 'PSS-DUMMY-V16-002';
  IF v_shipment_2 IS NULL THEN
    INSERT INTO public.shipment_tracking (
      source_type, pss_no, customer_code, customer_name, destination_address,
      destination_city, dk_lk, document_date, promised_delivery_date, status,
      vendor_id, cost_model, invoice_value, notes
    ) VALUES (
      'PSS', 'PSS-DUMMY-V16-002', 'CUS-DUMMY-V16-02', 'DUMMY KLINIK BINJAI', 'Jl. Dummy Binjai No. 2',
      'BINJAI', 'LK', CURRENT_DATE - 1, CURRENT_DATE + 2, 'Draft',
      v_vendor_id, 'Internal', 10000000, 'DUMMY V16 -- aman dihapus'
    ) RETURNING id INTO v_shipment_2;
  END IF;

  SELECT id INTO v_trip_id FROM public.trip WHERE trip_no = 'TRIP-DUMMY-V16-001';
  IF v_trip_id IS NULL THEN
    INSERT INTO public.trip (trip_no, vendor_id, status, notes)
    VALUES ('TRIP-DUMMY-V16-001', v_vendor_id, 'Assigned', 'DUMMY V16 -- multi-drop demo')
    RETURNING id INTO v_trip_id;
  END IF;

  UPDATE public.shipment_tracking
  SET vendor_id = v_vendor_id, trip_id = 'TRIP-DUMMY-V16-001', updated_at = now()
  WHERE id IN (v_shipment_1, v_shipment_2);

  INSERT INTO public.trip_stop (
    trip_id, shipment_tracking_id, stop_sequence, source_type, pss_no,
    customer_code, customer_name, destination_address, destination_city,
    promised_delivery_date, status, notes
  )
  SELECT v_trip_id, v_shipment_1, 1, 'PSS', 'PSS-DUMMY-V16-001',
    'CUS-DUMMY-V16-01', 'DUMMY RS MEDAN', 'Jl. Dummy Medan No. 1', 'MEDAN', CURRENT_DATE + 1, 'Assigned', 'DUMMY stop 1'
  WHERE NOT EXISTS (SELECT 1 FROM public.trip_stop WHERE shipment_tracking_id = v_shipment_1);

  INSERT INTO public.trip_stop (
    trip_id, shipment_tracking_id, stop_sequence, source_type, pss_no,
    customer_code, customer_name, destination_address, destination_city,
    promised_delivery_date, status, notes
  )
  SELECT v_trip_id, v_shipment_2, 2, 'PSS', 'PSS-DUMMY-V16-002',
    'CUS-DUMMY-V16-02', 'DUMMY KLINIK BINJAI', 'Jl. Dummy Binjai No. 2', 'BINJAI', CURRENT_DATE + 2, 'Assigned', 'DUMMY stop 2'
  WHERE NOT EXISTS (SELECT 1 FROM public.trip_stop WHERE shipment_tracking_id = v_shipment_2);

  SELECT id INTO v_expense_1 FROM public.trip_expense
  WHERE trip_id = v_trip_id AND expense_type = 'BBM' AND reference_no = 'DUMMY-V16-BBM';
  IF v_expense_1 IS NULL THEN
    INSERT INTO public.trip_expense (trip_id, expense_type, amount, quantity, reference_no, notes)
    VALUES (v_trip_id, 'BBM', 350000, 35, 'DUMMY-V16-BBM', 'DUMMY BBM trip multi-drop')
    RETURNING id INTO v_expense_1;
  END IF;

  SELECT id INTO v_expense_2 FROM public.trip_expense
  WHERE trip_id = v_trip_id AND expense_type = 'Tol' AND reference_no = 'DUMMY-V16-TOL';
  IF v_expense_2 IS NULL THEN
    INSERT INTO public.trip_expense (trip_id, expense_type, amount, reference_no, notes)
    VALUES (v_trip_id, 'Tol', 100000, 'DUMMY-V16-TOL', 'DUMMY tol trip multi-drop')
    RETURNING id INTO v_expense_2;
  END IF;

  INSERT INTO public.expense_allocation (trip_expense_id, trip_stop_id, allocation_method, allocation_basis, allocated_amount)
  SELECT v_expense_1, ts.id, 'invoice_value', CASE WHEN ts.stop_sequence = 1 THEN 15000000 ELSE 10000000 END,
    CASE WHEN ts.stop_sequence = 1 THEN 210000 ELSE 140000 END
  FROM public.trip_stop ts WHERE ts.trip_id = v_trip_id
  ON CONFLICT (trip_expense_id, trip_stop_id) DO NOTHING;

  INSERT INTO public.expense_allocation (trip_expense_id, trip_stop_id, allocation_method, allocation_basis, allocated_amount)
  SELECT v_expense_2, ts.id, 'invoice_value', CASE WHEN ts.stop_sequence = 1 THEN 15000000 ELSE 10000000 END,
    CASE WHEN ts.stop_sequence = 1 THEN 60000 ELSE 40000 END
  FROM public.trip_stop ts WHERE ts.trip_id = v_trip_id
  ON CONFLICT (trip_expense_id, trip_stop_id) DO NOTHING;

  INSERT INTO public.shipment_event_log (trip_stop_id, shipment_tracking_id, event_type, reason, metadata)
  SELECT ts.id, ts.shipment_tracking_id, 'Assigned', 'DUMMY V16 seed', jsonb_build_object('trip_no', 'TRIP-DUMMY-V16-001')
  FROM public.trip_stop ts
  WHERE ts.trip_id = v_trip_id
    AND NOT EXISTS (
      SELECT 1 FROM public.shipment_event_log ev
      WHERE ev.trip_stop_id = ts.id AND ev.event_type = 'Assigned' AND ev.reason = 'DUMMY V16 seed'
    );
END $$;

COMMIT;
