-- Repair Crossdocking Shipment Tracking rows created before PSS and city flowed through.
-- Run after migration_v19 and migration_v20.

UPDATE public.shipment_tracking st
SET
  pss_no = cd.pss_no,
  destination_city = COALESCE(NULLIF(trim(cd.destination_city), ''), st.destination_city),
  destination_address = COALESCE(NULLIF(trim(cd.destination_address), ''), st.destination_address),
  document_date = COALESCE(cd.document_date, st.document_date),
  promised_delivery_date = COALESCE(cd.promised_delivery_date, st.promised_delivery_date),
  updated_at = now()
FROM public.crossdocking_header cd
WHERE st.source_type = 'Crossdocking'
  AND st.crossdocking_id = cd.id
  AND NULLIF(trim(cd.pss_no), '') IS NOT NULL;
