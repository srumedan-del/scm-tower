-- v41: kirim ulang PSS yang gagal dikirim.
-- Percobaan yang gagal tetap tersimpan (alasan, foto, biaya, trip lama), dan
-- percobaan berikutnya menjadi baris shipment baru. Satu PSS tetap hanya boleh
-- punya satu shipment yang tidak gagal.

DROP INDEX IF EXISTS public.shipment_tracking_unique_pss_idx;

CREATE UNIQUE INDEX shipment_tracking_unique_pss_idx
  ON public.shipment_tracking (pss_no)
  WHERE source_type = 'PSS' AND pss_no IS NOT NULL AND status <> 'Failed Delivery';
