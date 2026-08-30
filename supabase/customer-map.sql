create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text not null,
  province text not null check (province in ('Aceh', 'Sumatera Utara')),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  machine_count integer not null default 0 check (machine_count >= 0),
  stock_quantity numeric not null default 0,
  daily_usage numeric not null default 0 check (daily_usage >= 0),
  last_order_date date,
  lead_time_days numeric not null default 3 check (lead_time_days >= 0),
  safety_buffer_days numeric not null default 2 check (safety_buffer_days >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Kompatibilitas untuk tabel customers yang mungkin sudah dibuat sebelumnya.
alter table public.customers add column if not exists name text;
alter table public.customers add column if not exists city text;
alter table public.customers add column if not exists province text;
alter table public.customers add column if not exists latitude double precision;
alter table public.customers add column if not exists longitude double precision;
alter table public.customers add column if not exists machine_count integer default 0;
alter table public.customers add column if not exists stock_quantity numeric default 0;
alter table public.customers add column if not exists daily_usage numeric default 0;
alter table public.customers add column if not exists last_order_date date;
alter table public.customers add column if not exists lead_time_days numeric default 3;
alter table public.customers add column if not exists safety_buffer_days numeric default 2;
alter table public.customers add column if not exists created_at timestamptz default now();
alter table public.customers add column if not exists updated_at timestamptz default now();

create index if not exists customers_province_idx on public.customers (province);

create or replace function public.set_customers_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists customers_updated_at on public.customers;
create trigger customers_updated_at
before update on public.customers
for each row execute function public.set_customers_updated_at();

alter table public.customers enable row level security;

drop policy if exists "customers read for public map" on public.customers;
drop policy if exists "customers read for authenticated users" on public.customers;
drop policy if exists "customers insert for authenticated users" on public.customers;
drop policy if exists "customers insert for maintain phase" on public.customers;
drop policy if exists "customers update for authenticated users" on public.customers;
drop policy if exists "customers update for maintain phase" on public.customers;
drop policy if exists "customers delete for authenticated users" on public.customers;
drop policy if exists "customers delete for maintain phase" on public.customers;

create policy "customers read for public map"
  on public.customers for select to anon, authenticated using (true);
create policy "customers insert for maintain phase"
  on public.customers for insert to anon, authenticated with check (true);
create policy "customers update for maintain phase"
  on public.customers for update to anon, authenticated using (true) with check (true);
create policy "customers delete for maintain phase"
  on public.customers for delete to anon, authenticated using (true);

-- Jalankan sekali jika tabel belum masuk ke publication Realtime.
do $$
begin
  alter publication supabase_realtime add table public.customers;
exception when duplicate_object then
  null;
end;
$$;
