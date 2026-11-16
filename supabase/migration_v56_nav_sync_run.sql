-- v56: Riwayat dan permintaan sinkronisasi NAV (scripts/nav-sync).
-- Tombol "Update dari NAV" di SCM Tower membuat baris berstatus pending; program pemantau di komputer kantor
-- (yang bisa menjangkau NAV) menjalankannya. Jadwal otomatis juga mencatat hasilnya di sini.
create table if not exists nav_sync_run (
  id bigserial primary key,
  trigger text not null default 'manual' check (trigger in ('manual', 'schedule')),
  status text not null default 'pending' check (status in ('pending', 'running', 'done', 'failed')),
  requested_by text,
  requested_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  summary text,
  error text
);

create index if not exists nav_sync_run_status_idx on nav_sync_run (status, requested_at);
create index if not exists nav_sync_run_requested_idx on nav_sync_run (requested_at desc);

-- Tanda hidup program pemantau (diperbarui tiap ±20 detik).
create table if not exists nav_sync_agent (
  id integer primary key default 1 check (id = 1),
  last_seen timestamptz,
  hostname text
);

alter table nav_sync_run enable row level security;
alter table nav_sync_agent enable row level security;
