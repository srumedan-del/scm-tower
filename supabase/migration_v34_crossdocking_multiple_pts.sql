-- Allow one Crossdocking Header/PSS to be sourced from multiple PTS records.
CREATE TABLE IF NOT EXISTS public.crossdocking_header_pts (
  crossdocking_id bigint NOT NULL REFERENCES public.crossdocking_header(id) ON DELETE CASCADE,
  pts_id bigint NOT NULL REFERENCES public.crossdocking_pts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (crossdocking_id, pts_id),
  UNIQUE (pts_id)
);

CREATE INDEX IF NOT EXISTS crossdocking_header_pts_pts_idx
  ON public.crossdocking_header_pts (pts_id);

INSERT INTO public.crossdocking_header_pts (crossdocking_id, pts_id)
SELECT id, pts_id
FROM public.crossdocking_header
WHERE pts_id IS NOT NULL
ON CONFLICT DO NOTHING;

ALTER TABLE public.crossdocking_header_pts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated read" ON public.crossdocking_header_pts;
CREATE POLICY "authenticated read" ON public.crossdocking_header_pts
  FOR SELECT TO authenticated USING (true);