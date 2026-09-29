-- Numvera Naija production schema (RLS without cross-table recursion)
create extension if not exists pgcrypto;

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  category text,
  target_date date,
  location text,
  status text default 'Active',
  priority text default 'Normal',
  budget numeric(14,2) default 0,
  tasks jsonb default '[]',
  members jsonb default '[]',
  files jsonb default '[]',
  expenses jsonb default '[]',
  contributions jsonb default '[]',
  comments jsonb default '[]',
  created_by uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  email text,
  role text default 'member',
  created_at timestamptz default now(),
  unique(workspace_id, user_id)
);

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  note text not null,
  due_at timestamptz not null,
  created_at timestamptz default now()
);

create table if not exists public.workspace_activity (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

-- Helper functions bypass RLS safely (no policy recursion)
create or replace function public.is_workspace_owner(ws_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.workspaces w
    where w.id = ws_id and w.created_by = auth.uid()
  );
$$;

create or replace function public.is_workspace_member(ws_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws_id and m.user_id = auth.uid()
  );
$$;

create or replace function public.can_access_workspace(ws_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_workspace_owner(ws_id) or public.is_workspace_member(ws_id);
$$;

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.reminders enable row level security;
alter table public.workspace_activity enable row level security;

-- Drop old policies (including recursive ones)
drop policy if exists workspace_select on public.workspaces;
drop policy if exists workspace_insert on public.workspaces;
drop policy if exists workspace_update on public.workspaces;
drop policy if exists workspace_delete on public.workspaces;
drop policy if exists member_select on public.workspace_members;
drop policy if exists member_insert on public.workspace_members;
drop policy if exists member_update on public.workspace_members;
drop policy if exists member_delete on public.workspace_members;
drop policy if exists reminder_access on public.reminders;
drop policy if exists activity_access on public.workspace_activity;
drop policy if exists activity_insert on public.workspace_activity;

-- Workspaces: owner check is direct; membership via security definer (no recursion)
create policy workspace_select on public.workspaces
  for select using (
    created_by = auth.uid()
    or public.is_workspace_member(id)
  );

create policy workspace_insert on public.workspaces
  for insert with check (created_by = auth.uid());

create policy workspace_update on public.workspaces
  for update using (
    created_by = auth.uid()
    or public.is_workspace_member(id)
  );

create policy workspace_delete on public.workspaces
  for delete using (created_by = auth.uid());

-- Members: own row OR owner via security definer (does not re-enter workspaces RLS)
create policy member_select on public.workspace_members
  for select using (
    user_id = auth.uid()
    or public.is_workspace_owner(workspace_id)
  );

create policy member_insert on public.workspace_members
  for insert with check (
    user_id = auth.uid()
    or public.is_workspace_owner(workspace_id)
  );

create policy member_update on public.workspace_members
  for update using (public.is_workspace_owner(workspace_id));

create policy member_delete on public.workspace_members
  for delete using (public.is_workspace_owner(workspace_id));

create policy reminder_access on public.reminders
  for all using (
    user_id = auth.uid()
    or public.can_access_workspace(workspace_id)
  );

create policy activity_access on public.workspace_activity
  for select using (public.can_access_workspace(workspace_id));

create policy activity_insert on public.workspace_activity
  for insert with check (user_id = auth.uid());

insert into storage.buckets (id, name, public)
values ('workspace-files', 'workspace-files', false)
on conflict (id) do nothing;

drop policy if exists "workspace file read" on storage.objects;
create policy "workspace file read" on storage.objects
  for select to authenticated using (
    bucket_id = 'workspace-files'
    and public.can_access_workspace( ((storage.foldername(name))[1])::uuid )
  );

drop policy if exists "workspace file upload" on storage.objects;
create policy "workspace file upload" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'workspace-files'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

do $$ begin
  alter publication supabase_realtime add table public.workspaces;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.workspace_activity;
exception when duplicate_object then null;
end $$;
