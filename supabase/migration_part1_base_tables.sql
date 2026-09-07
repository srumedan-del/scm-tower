-- ============================================================================
-- PART 1: Tabel dasar TMS (master_driver, master_transporter, transport_fleet)
-- Jalankan ini DULU, cek sukses, baru jalankan part2.
-- ============================================================================

-- Fungsi updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- master_driver
CREATE TABLE IF NOT EXISTS public.master_driver (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  driver_code text NOT NULL UNIQUE,
  driver_name text NOT NULL,
  sim_no      text,
  phone       text,
  is_active   boolean NOT NULL DEFAULT true,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS master_driver_updated_at ON public.master_driver;
CREATE TRIGGER master_driver_updated_at BEFORE UPDATE ON public.master_driver
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.master_driver ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated read" ON public.master_driver;
CREATE POLICY "authenticated read" ON public.master_driver FOR SELECT TO authenticated USING (true);

-- Tambah kolom role jika belum ada
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='master_driver' AND column_name='role') THEN
    ALTER TABLE public.master_driver ADD COLUMN role text NOT NULL DEFAULT 'Driver' CHECK (role IN ('Driver','Helper'));
  END IF;
END $$;

-- master_transporter
CREATE TABLE IF NOT EXISTS public.master_transporter (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  transporter_code text NOT NULL UNIQUE,
  name             text NOT NULL,
  type             text NOT NULL DEFAULT 'Eksternal' CHECK (type IN ('Internal','Eksternal')),
  service_model    text CHECK (service_model IN ('Retail','Trucking',NULL)),
  pic_name         text,
  pic_phone        text,
  pic_email        text,
  is_active        boolean NOT NULL DEFAULT true,
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS master_transporter_updated_at ON public.master_transporter;
CREATE TRIGGER master_transporter_updated_at BEFORE UPDATE ON public.master_transporter
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.master_transporter ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated read" ON public.master_transporter;
CREATE POLICY "authenticated read" ON public.master_transporter FOR SELECT TO authenticated USING (true);
INSERT INTO public.master_transporter (transporter_code, name, type, service_model, notes) VALUES
  ('TRANS-INT-SRU', 'Internal — SRU Medan',   'Internal',  NULL,       '2 unit truck milik cabang'),
  ('TRANS-EXT-001', 'Transporter Eksternal 1', 'Eksternal', 'Retail',   'Isi nama vendor aktual'),
  ('TRANS-EXT-002', 'Transporter Eksternal 2', 'Eksternal', 'Trucking', 'Isi nama vendor aktual'),
  ('TRANS-EXT-003', 'Transporter Eksternal 3', 'Eksternal', 'Retail',   'Isi nama vendor aktual')
ON CONFLICT (transporter_code) DO NOTHING;

-- transport_fleet — tambah kolom satu-satu dalam DO block (aman jika sudah ada)
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='transport_fleet' AND column_name='capacity_kg') THEN ALTER TABLE public.transport_fleet ADD COLUMN capacity_kg numeric; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='transport_fleet' AND column_name='capacity_cbm') THEN ALTER TABLE public.transport_fleet ADD COLUMN capacity_cbm numeric; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='transport_fleet' AND column_name='brand') THEN ALTER TABLE public.transport_fleet ADD COLUMN brand text; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='transport_fleet' AND column_name='year') THEN ALTER TABLE public.transport_fleet ADD COLUMN year integer; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='transport_fleet' AND column_name='is_active') THEN ALTER TABLE public.transport_fleet ADD COLUMN is_active boolean DEFAULT true; END IF; END $$;
