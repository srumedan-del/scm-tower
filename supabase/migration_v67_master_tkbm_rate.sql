-- v67: master tarif TKBM/SPSI (biaya bongkar muat di tujuan) per customer.
-- Tarif berbeda per tujuan: per koli (total koli PSS x tarif) atau flat per bulan.
-- Sumber awal: "Biaya TKBM-SPSI Terupdat per 18 November 2026.xlsx".

create table if not exists public.master_tkbm_rate (
  id bigint generated always as identity primary key,
  customer_code text,
  customer_name text not null,
  rate_type text not null check (rate_type in ('per_koli', 'per_bulan')),
  amount numeric not null check (amount >= 0),
  effective_from date not null default current_date,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.master_tkbm_rate is 'Tarif TKBM/SPSI per customer tujuan. per_koli: total koli x amount; per_bulan: amount flat per bulan ada pengiriman.';
comment on column public.master_tkbm_rate.customer_code is 'Kode customer NAV (outbound_header.customer_no). Kosong bila customer belum ada di database.';

create unique index if not exists master_tkbm_rate_code_from_uidx
  on public.master_tkbm_rate (customer_code, effective_from) where customer_code is not null;

alter table public.master_tkbm_rate enable row level security;
drop policy if exists scm_access_only on public.master_tkbm_rate;
create policy scm_access_only on public.master_tkbm_rate as restrictive for all to authenticated
  using ((select public.is_scm_user())) with check ((select public.is_scm_user()));

insert into public.master_tkbm_rate (customer_code, customer_name, rate_type, amount, effective_from, notes)
select v.code, v.name, v.rate_type, v.amount, date '2026-11-18', v.notes
from (values
  ('RSS002881', 'RS LARAS', 'per_koli', 2000, null),
  ('RSS002095', 'RS PIRNGADI', 'per_bulan', 250000, null),
  ('RSP000034', 'RSU H. ADAM MALIK', 'per_bulan', 250000, null),
  ('RSP000030', 'RSU TARUTUNG', 'per_koli', 2000, null),
  ('RSP002695', 'RSUD DOLOK SANGGUL', 'per_koli', 1500, null),
  ('RSS000039', 'RSUD DRS. H. AMRI TAMBUNAN', 'per_bulan', 250000, null),
  ('RSP002825', 'RSUD KOTA PADANGSIDIMPUAN', 'per_koli', 2000, null),
  ('RSP000032', 'RSUD LANGSA-ACEH', 'per_koli', 2000, null),
  ('RSS003067', 'RSU MUFID', 'per_koli', 1000, null),
  ('RSS002882', 'RS PABATU', 'per_koli', 2500, null),
  (null, 'KLINIK NUSA LIMA', 'per_koli', 2500, 'Kode customer belum ditemukan di database'),
  ('RSP000036', 'RSU DR. ZAINOEL ABIDIN PROV. NAD', 'per_koli', 2000, null),
  ('KLI002225', 'KLINIK AYAH BUNDA', 'per_koli', 2500, null),
  ('KLI000052', 'KLINIK UTAMA SPESIALIS BUNDA', 'per_koli', 2500, null),
  ('RSS000049', 'RS HARAPAN', 'per_koli', 2500, null),
  ('RSS002910', 'RSU HKBP BALIGE', 'per_koli', 2500, null),
  ('RSP000043', 'RSU RANTAU PRAPAT', 'per_koli', 2500, null),
  ('RSP002817', 'RSUD DR. DJASAMEN SARAGIH', 'per_koli', 2500, null),
  ('RSP000053', 'RSUD DR. DJASAMEN SARAGIH', 'per_koli', 2500, 'Kode lama Djasamen Saragih di data NAV'),
  ('RSP000051', 'RSUD KAB. ACEH TAMIANG', 'per_koli', 2500, null),
  (null, 'RS ARIFIN AHMAD', 'per_koli', 2500, 'Kode customer belum ditemukan di database')
) as v(code, name, rate_type, amount, notes)
where not exists (select 1 from public.master_tkbm_rate);
