-- Store manual Crossdocking document creation timestamp for Service Level reporting.
ALTER TABLE public.crossdocking_header
  ADD COLUMN IF NOT EXISTS document_created_at timestamptz;

UPDATE public.crossdocking_header
SET document_created_at = document_date::timestamptz
WHERE document_created_at IS NULL
  AND document_date IS NOT NULL;

COMMENT ON COLUMN public.crossdocking_header.document_created_at IS
  'Manual Document Date Time for Crossdocking used by Service Level reporting.';

CREATE INDEX IF NOT EXISTS crossdocking_header_document_created_at_idx
  ON public.crossdocking_header (document_created_at)
  WHERE document_created_at IS NOT NULL;
