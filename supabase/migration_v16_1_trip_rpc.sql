-- SCM Control Tower v1.6.1
-- Atomic creation of a canonical trip from legacy shipment_tracking rows.

CREATE OR REPLACE FUNCTION public.create_trip_from_shipments(
  p_vendor_id bigint,
  p_shipment_ids bigint[],
  p_actor_id uuid DEFAULT NULL,
  p_vehicle_id bigint DEFAULT NULL,
  p_driver_id bigint DEFAULT NULL,
  p_helper_id bigint DEFAULT NULL,
  p_route_id bigint DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS TABLE (trip_id bigint, trip_no text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trip_id bigint;
  v_trip_no text;
  v_shipment record;
  v_sequence integer := 0;
BEGIN
  IF p_vendor_id IS NULL OR NOT EXISTS (SELECT 1 FROM vendors WHERE id = p_vendor_id AND COALESCE(is_active, true)) THEN
    RAISE EXCEPTION 'Transporter aktif wajib dipilih';
  END IF;

  IF COALESCE(array_length(p_shipment_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'Pilih minimal satu shipment';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(p_shipment_ids) AS selected(id)
    LEFT JOIN shipment_tracking st ON st.id = selected.id
    LEFT JOIN trip_stop ts ON ts.shipment_tracking_id = selected.id
    WHERE st.id IS NULL OR ts.id IS NOT NULL OR st.status <> 'Draft'
  ) THEN
    RAISE EXCEPTION 'Shipment harus ada, belum masuk Trip, dan masih berstatus Draft';
  END IF;

  INSERT INTO trip (vendor_id, vehicle_id, driver_id, helper_id, route_id, notes, created_by)
  VALUES (p_vendor_id, p_vehicle_id, p_driver_id, p_helper_id, p_route_id, p_notes, p_actor_id)
  RETURNING id, trip_no INTO v_trip_id, v_trip_no;

  FOR v_shipment IN
    SELECT *
    FROM shipment_tracking
    WHERE id = ANY(p_shipment_ids)
    ORDER BY promised_delivery_date NULLS LAST, id
  LOOP
    v_sequence := v_sequence + 1;

    INSERT INTO trip_stop (
      trip_id, shipment_tracking_id, stop_sequence, source_type, pss_no,
      crossdocking_id, customer_code, customer_name, destination_address,
      destination_city, promised_delivery_date, status, notes, created_by
    ) VALUES (
      v_trip_id, v_shipment.id, v_sequence, v_shipment.source_type, v_shipment.pss_no,
      v_shipment.crossdocking_id, v_shipment.customer_code, v_shipment.customer_name,
      v_shipment.destination_address, v_shipment.destination_city,
      v_shipment.promised_delivery_date, 'Assigned', v_shipment.notes, p_actor_id
    );

    UPDATE shipment_tracking
    SET vendor_id = p_vendor_id,
        trip_id = v_trip_no,
        updated_at = now()
    WHERE id = v_shipment.id;

    INSERT INTO shipment_event_log (trip_stop_id, shipment_tracking_id, event_type, actor_id, metadata)
    SELECT ts.id, v_shipment.id, 'Assigned', p_actor_id,
      jsonb_build_object('trip_id', v_trip_id, 'trip_no', v_trip_no, 'source', 'create_trip_from_shipments')
    FROM trip_stop ts
    WHERE ts.trip_id = v_trip_id AND ts.shipment_tracking_id = v_shipment.id;
  END LOOP;

  RETURN QUERY SELECT v_trip_id, v_trip_no;
END;
$$;

REVOKE ALL ON FUNCTION public.create_trip_from_shipments(bigint, bigint[], uuid, bigint, bigint, bigint, bigint, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_trip_from_shipments(bigint, bigint[], uuid, bigint, bigint, bigint, bigint, text) TO service_role;
