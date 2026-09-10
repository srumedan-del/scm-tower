-- Add source-document references for manual crossdocking shipments.

ALTER TABLE public.crossdocking_header
  ADD COLUMN IF NOT EXISTS pss_no text,
  ADD COLUMN IF NOT EXISTS psi_no text,
  ADD COLUMN IF NOT EXISTS document_date date;

COMMENT ON COLUMN public.crossdocking_header.pss_no IS 'Nomor Posted Sales Shipment (PSS) terkait crossdocking.';
COMMENT ON COLUMN public.crossdocking_header.psi_no IS 'Nomor Posted Sales Invoice (PSI) terkait crossdocking.';
COMMENT ON COLUMN public.crossdocking_header.document_date IS 'Tanggal dokumen sumber PSS/PSI.';

CREATE INDEX IF NOT EXISTS crossdocking_header_pss_no_idx
  ON public.crossdocking_header (pss_no)
  WHERE pss_no IS NOT NULL;
