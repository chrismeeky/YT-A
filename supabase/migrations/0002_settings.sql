-- Per-user app settings (one row per user). API-key fields inside `data` are
-- encrypted at the application layer before they ever reach this table.
--
-- Run in the Supabase SQL editor (or `supabase db push`).

create table if not exists public.settings (
  user_id    uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.settings enable row level security;

drop policy if exists own_rows on public.settings;
create policy own_rows on public.settings
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
