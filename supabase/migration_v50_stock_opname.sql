-- ============================================================================
-- MIGRATION v50: Stock opname mingguan (IDE-002)
-- Sumber data: SIRUP Stok Gudang (CAB01-MDN / MDN-PAR), disaring kategori
-- HOLOW FIBER / DIALYZER + BLOOD TUBING SET di bincode MDN-PAR-CON.
-- Output: lembar hitung (BL ELISIO) dan berita acara F-SRU-SCMWHL-37.
-- AMAN dijalankan ulang.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.stock_opname_session (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  opname_date   date NOT NULL,
  source        text NOT NULL DEFAULT 'upload' CHECK (source IN ('sirup', 'upload')),
  source_note   text,
  pic           text,
  status        text NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Selesai dihitung', 'Diverifikasi')),
  notes         text,
  created_by    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stock_opname_session_date_idx ON public.stock_opname_session (opname_date DESC);

CREATE TABLE IF NOT EXISTS public.stock_opname_line (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id       bigint NOT NULL REFERENCES public.stock_opname_session(id) ON DELETE CASCADE,
  sort_order       integer NOT NULL DEFAULT 0,
  bincode          text,
  kategori         text,
  no_item          text,
  nama_item        text,
  serial_no        text,
  lot_no           text,
  expiration_date  date,
  qty_system       numeric NOT NULL DEFAULT 0,
  qty_physical     numeric,
  penyebab         text,
  action_plan      text,
  line_status      text CHECK (line_status IS NULL OR line_status IN ('Open', 'Proses', 'Closed')),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stock_opname_line_session_idx ON public.stock_opname_line (session_id, sort_order);

-- Pengaturan dokumen (penandatangan berita acara, PIC default)
CREATE TABLE IF NOT EXISTS public.stock_opname_settings (
  id          integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  signers     jsonb NOT NULL DEFAULT '[]'::jsonb,
  default_pic text,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.stock_opname_settings (id, signers, default_pic)
VALUES (1, '[
  {"name": "ERWIN SAPTA ANDIKA", "title": "SCM"},
  {"name": "MUHAMMAD SYAHRUM HARAHAP", "title": "PJT"},
  {"name": "DEDIANA", "title": "FAT"},
  {"name": "YUSUF HARYANTO", "title": "SPC"},
  {"name": "SUYANTO", "title": "BOM"}
]'::jsonb, 'Abdi & Ngadimin')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.stock_opname_session ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_opname_line ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_opname_settings ENABLE ROW LEVEL SECURITY;
