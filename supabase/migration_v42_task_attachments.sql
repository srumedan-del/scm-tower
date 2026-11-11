-- ==============================================================================
-- Migration v42: Lampiran tautan untuk Task Board
-- ==============================================================================
-- File tetap disimpan di Google Drive atau sharing folder kantor; task hanya
-- menyimpan tautan (https://...) atau path folder (\\server\share\..., H:\...).
-- Tidak ada policy untuk anon/authenticated: semua akses lewat service role.
-- Aman dijalankan ulang.

CREATE TABLE IF NOT EXISTS public.scm_task_attachments (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  task_id     text NOT NULL REFERENCES public.scm_tasks(id) ON DELETE CASCADE,
  label       text NOT NULL,
  location    text NOT NULL,
  added_by    text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS scm_task_attachments_task_idx
  ON public.scm_task_attachments (task_id, created_at);

ALTER TABLE public.scm_task_attachments ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.scm_task_attachments IS
  'Tautan lampiran Task Board: URL (Google Drive dll.) atau path sharing folder.';
