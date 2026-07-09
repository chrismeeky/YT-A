-- Cloud storage for ReelIQ — projects / analyses / scripts / bookmarks as JSONB,
-- plus a private Storage bucket for media & audio. Per-user isolation via RLS.
--
-- Run this in the Supabase SQL editor (or `supabase db push`).

-- ─── Tables ──────────────────────────────────────────────────────────────────

create table if not exists public.projects (
  id         uuid primary key,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.analyses (
  id         uuid primary key,
  project_id uuid not null,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.scripts (
  id         uuid primary key,
  project_id uuid not null,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

-- Bookmarks are keyed by YouTube channel id (a string), so the same channel
-- can be bookmarked by different users — composite primary key.
create table if not exists public.bookmarks (
  id         text not null,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists analyses_project_idx on public.analyses (user_id, project_id);
create index if not exists scripts_project_idx  on public.scripts  (user_id, project_id);

-- ─── Row Level Security ──────────────────────────────────────────────────────

alter table public.projects  enable row level security;
alter table public.analyses  enable row level security;
alter table public.scripts   enable row level security;
alter table public.bookmarks enable row level security;

-- Each table: a user may only see and mutate their own rows.
do $$
declare t text;
begin
  foreach t in array array['projects','analyses','scripts','bookmarks']
  loop
    execute format($f$
      drop policy if exists own_rows on public.%1$s;
      create policy own_rows on public.%1$s
        for all
        using (user_id = auth.uid())
        with check (user_id = auth.uid());
    $f$, t);
  end loop;
end $$;

-- ─── Media / audio object storage ────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('media', 'media', false)
on conflict (id) do nothing;

-- Objects are stored under a top-level folder equal to the owner's user id:
--   {user_id}/media/{projectId}/{scriptId}/{sceneId}/{filename}
--   {user_id}/audio/{projectId}/{scriptId}/{sceneId}/{filename}
-- so the first path segment identifies the owner.

drop policy if exists media_own_select on storage.objects;
create policy media_own_select on storage.objects
  for select using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists media_own_insert on storage.objects;
create policy media_own_insert on storage.objects
  for insert with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists media_own_update on storage.objects;
create policy media_own_update on storage.objects
  for update using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists media_own_delete on storage.objects;
create policy media_own_delete on storage.objects
  for delete using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
