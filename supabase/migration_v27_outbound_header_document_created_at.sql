-- Store the NAV document creation timestamp on the PSS header.
-- Run this once in the Supabase SQL Editor before uploading PSS Detail files.

ALTER TABLE public.outbound_header
  ADD COLUMN IF NOT EXISTS document_created_at timestamptz;

COMMENT ON COLUMN public.outbound_header.document_created_at IS
  'Earliest Document Date Time from NAV PSS Detail rows for this PSS.';

CREATE INDEX IF NOT EXISTS outbound_header_document_created_at_idx
  ON public.outbound_header (document_created_at)
  WHERE document_created_at IS NOT NULL;
