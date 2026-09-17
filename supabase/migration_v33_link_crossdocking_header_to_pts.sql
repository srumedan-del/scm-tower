-- Koreksi alur PTS: PTS adalah detail NAV, sedangkan Crossdocking Header dibuat manual.

ALTER TABLE public.crossdocking_header
  ADD COLUMN IF NOT EXISTS pts_id bigint;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'crossdocking_header_pts_id_fkey'
  ) THEN
    ALTER TABLE public.crossdocking_header
      ADD CONSTRAINT crossdocking_header_pts_id_fkey
      FOREIGN KEY (pts_id) REFERENCES public.crossdocking_pts(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS crossdocking_header_pts_id_unique_idx
  ON public.crossdocking_header (pts_id) WHERE pts_id IS NOT NULL;

ALTER TABLE public.crossdocking_pts
  DROP CONSTRAINT IF EXISTS crossdocking_pts_status_check;

UPDATE public.crossdocking_pts
SET status = CASE
  WHEN status = 'Crossdocking Dibuat' THEN 'Terhubung Crossdocking'
  ELSE 'Menunggu Crossdocking'
END;

ALTER TABLE public.crossdocking_pts
  ALTER COLUMN status SET DEFAULT 'Menunggu Crossdocking',
  ADD CONSTRAINT crossdocking_pts_status_check
    CHECK (status IN ('Menunggu Crossdocking', 'Terhubung Crossdocking'));

COMMENT ON COLUMN public.crossdocking_header.pts_id IS
  'PTS sumber detail NAV yang dipilih saat membuat Crossdocking Header secara manual.';
