-- ==============================================================================
-- Migration v35: SCM Tasks Table (Clean & Safe)
-- ==============================================================================

-- 1. Buat Tabel
create table if not exists public.scm_tasks (
  id text primary key,
  name text not null,
  description text,
  status text not null default 'TODO',
  deadline date,
  pic text not null default 'Erwin',
  assigner text default 'Erwin',
  frequency text default 'Sekali saja',
  tags text[] default array[]::text[],
  warning_count integer default 0,
  comments_count integer default 0,
  subtasks text,
  icon text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Buat Index
create index if not exists idx_scm_tasks_status on public.scm_tasks (status);
create index if not exists idx_scm_tasks_created_at on public.scm_tasks (created_at desc);

-- 3. Row Level Security (RLS)
alter table public.scm_tasks enable row level security;

-- 4. RLS Policy
drop policy if exists "Allow all on scm_tasks" on public.scm_tasks;
create policy "Allow all on scm_tasks" on public.scm_tasks
  for all using (true) with check (true);
