-- Removes only V16DEMO / DUMMY V16 data created by seed_v16_trip_dummy.sql.
BEGIN;

DELETE FROM public.trip WHERE trip_no = 'TRIP-DUMMY-V16-001';
DELETE FROM public.shipment_tracking WHERE pss_no IN ('PSS-DUMMY-V16-001', 'PSS-DUMMY-V16-002');
DELETE FROM public.vendors WHERE vendor_code = 'V16DEMO';

COMMIT;
