-- Preserve the NAV Item Ledger Entry creation timestamp for SLA calculations.
-- Run this once in the Supabase SQL Editor before uploading/re-uploading detail files.

ALTER TABLE public.outbound_detail
  ADD COLUMN IF NOT EXISTS document_created_at timestamptz;

COMMENT ON COLUMN public.outbound_detail.document_created_at IS
  'Timestamp from NAV Item Ledger Entry column "Document Created Date/Time"; SLA start time.';

CREATE INDEX IF NOT EXISTS outbound_detail_document_created_at_idx
  ON public.outbound_detail (document_no, document_created_at)
  WHERE document_created_at IS NOT NULL;
