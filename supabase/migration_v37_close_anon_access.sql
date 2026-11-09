-- migration_v37_close_anon_access.sql
-- Menutup akses publik (anon key) ke data aplikasi.
--
-- Latar belakang:
--   * View berjalan dengan hak pemiliknya sehingga melewati RLS. vw_shipment_tms
--     terbaca oleh anon key.
--   * Beberapa policy memberi akses ke role anon/public, termasuk tulis pada
--     customers, scm_tasks, dan trip_adhoc_expenses.
--
-- Dampak ke aplikasi: tidak ada. Server memakai service role, dan browser yang
-- sudah login memakai role authenticated, keduanya tetap punya akses.
-- Jalankan di Supabase SQL Editor (butuh PostgreSQL 15+). Aman dijalankan ulang.

BEGIN;

-- 1. Semua view publik mengikuti RLS pemanggil dan tidak bisa dibaca anon.
DO $$
DECLARE
  v record;
BEGIN
  FOR v IN
    SELECT schemaname, viewname FROM pg_views WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER VIEW %I.%I SET (security_invoker = true)', v.schemaname, v.viewname);
    EXECUTE format('REVOKE ALL ON %I.%I FROM anon', v.schemaname, v.viewname);
  END LOOP;
END $$;

-- 2. Policy yang berlaku untuk anon/public dipindah ke authenticated saja.
--    Isi USING/WITH CHECK tidak berubah.
DO $$
DECLARE
  p record;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND roles && ARRAY['anon', 'public']::name[]
  LOOP
    EXECUTE format(
      'ALTER POLICY %I ON %I.%I TO authenticated',
      p.policyname, p.schemaname, p.tablename
    );
  END LOOP;
END $$;

COMMIT;

-- Cek hasil, keduanya harus 0 baris:
--   SELECT tablename, policyname, roles FROM pg_policies
--   WHERE schemaname = 'public' AND roles && ARRAY['anon', 'public']::name[];
--
--   SELECT table_name FROM information_schema.role_table_grants
--   WHERE grantee = 'anon' AND table_schema = 'public'
--     AND table_name IN (SELECT viewname FROM pg_views WHERE schemaname = 'public');
