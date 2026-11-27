-- v65: kunci akses SCM Tower hanya untuk akun yang diberi tanda scm_access oleh admin.
-- Latar: pendaftaran publik Supabase Auth masih aktif sehingga orang luar bisa membuat akun
-- (uzumaki.pentest.77@gmail.com, 16/11/2026). Akun seperti itu mendapat peran `authenticated`
-- dan sebelumnya lolos RLS `using (true)` serta pemeriksaan login aplikasi.

-- 1. Tandai pengguna sah yang ada (dibuat admin / pemilik).
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"scm_access": true}'::jsonb
where id in (
  '3ca76b9a-97ef-459f-8b16-a24b695b2563', -- erwin.sapta@live.com
  '3cd655d4-a950-42e9-a35e-d1d136f00aa1', -- admin@sru.local
  '73812dcf-db54-4917-a993-07555fdd3ec1'  -- syahrum@sru.co.id
);

-- 2. Cek akses langsung ke auth.users (bukan klaim JWT) supaya pencabutan berlaku seketika.
create or replace function public.is_scm_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from auth.users u
    where u.id = auth.uid()
      and u.raw_app_meta_data ->> 'scm_access' = 'true'
      and (u.banned_until is null or u.banned_until <= now())
  )
$$;
revoke all on function public.is_scm_user() from public, anon;
grant execute on function public.is_scm_user() to authenticated;

-- 3. Kebijakan RESTRICTIVE di semua tabel ber-RLS: digabung (AND) dengan kebijakan yang ada,
--    jadi akun tanpa scm_access tidak bisa membaca/mengubah apa pun lewat API REST.
do $$
declare t record;
begin
  for t in select schemaname, tablename from pg_tables where schemaname = 'public' and rowsecurity loop
    execute format('drop policy if exists scm_access_only on %I.%I', t.schemaname, t.tablename);
    execute format(
      'create policy scm_access_only on %I.%I as restrictive for all to authenticated using ((select public.is_scm_user())) with check ((select public.is_scm_user()))',
      t.schemaname, t.tablename);
  end loop;
end $$;

drop policy if exists scm_access_only on storage.objects;
create policy scm_access_only on storage.objects as restrictive for all to authenticated
  using ((select public.is_scm_user())) with check ((select public.is_scm_user()));

-- 4. Pendaftaran mandiri dimatikan di dasbor Supabase (Auth > Sign In / Providers).
--    Trigger di auth.users sengaja tidak dipakai: admin createUser juga insert dulu baru konfirmasi.

-- 5. Fungsi RPC publik tidak perlu bisa dipanggil tanpa login.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
  loop
    execute format('revoke execute on function %s from public, anon', f.sig);
  end loop;
end $$;
grant execute on function public.is_scm_user() to authenticated;
