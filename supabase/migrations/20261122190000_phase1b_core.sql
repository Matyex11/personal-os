-- Phase 1B core schema DRAFT for personal-os-dev (qyysmgwdvhftbgwhpbjt, eu-central-1).
-- DO NOT APPLY until separate human L3 approval.
-- Target: profiles, chapters, module_activations, habits, habit_logs,
-- projects, milestones, tasks, audit_logs.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  timezone text not null default 'Europe/Bucharest',
  base_currency text not null default 'RON',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy profiles_select_own on public.profiles
  for select to authenticated
  using (auth.uid() = id);

create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check (auth.uid() = id);

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- chapters
-- ---------------------------------------------------------------------------

create table public.chapters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  summary text,
  started_on date not null,
  ended_on date,
  status text not null check (status in ('planned', 'active', 'closed')),
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id),
  constraint chapters_lifecycle_dates check (
    ended_on is null or ended_on >= started_on
  ),
  constraint chapters_lifecycle_status check (
    (status = 'planned' and ended_on is null and is_current = false)
    or (status = 'active' and ended_on is null)
    or (status = 'closed' and ended_on is not null and is_current = false)
  ),
  constraint chapters_current_implies_active check (
    is_current = false or status = 'active'
  )
);

create unique index chapters_one_current_per_user
  on public.chapters (user_id)
  where is_current = true;

create index chapters_user_status_idx on public.chapters (user_id, status);

alter table public.chapters enable row level security;

create policy chapters_select_own on public.chapters
  for select to authenticated using (auth.uid() = user_id);
create policy chapters_insert_own on public.chapters
  for insert to authenticated with check (auth.uid() = user_id);
create policy chapters_update_own on public.chapters
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy chapters_delete_own on public.chapters
  for delete to authenticated using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- module_activations
-- ---------------------------------------------------------------------------

create table public.module_activations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  scope text not null check (scope in ('global', 'chapter')),
  chapter_id uuid,
  module_key text not null check (module_key in (
    'habits', 'tasks', 'projects', 'milestones', 'checkins',
    'finances', 'physical', 'behavioural', 'reviews', 'xnine_tracking'
  )),
  is_active boolean not null default true,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint module_activations_scope_chapter check (
    (scope = 'global' and chapter_id is null)
    or (scope = 'chapter' and chapter_id is not null)
  ),
  foreign key (user_id, chapter_id)
    references public.chapters (user_id, id)
    on delete cascade
);

create unique index module_activations_global_unique
  on public.module_activations (user_id, module_key)
  where scope = 'global';

create unique index module_activations_chapter_unique
  on public.module_activations (user_id, chapter_id, module_key)
  where scope = 'chapter';

create index module_activations_user_idx on public.module_activations (user_id);

alter table public.module_activations enable row level security;

create policy module_activations_select_own on public.module_activations
  for select to authenticated using (auth.uid() = user_id);
create policy module_activations_insert_own on public.module_activations
  for insert to authenticated with check (auth.uid() = user_id);
create policy module_activations_update_own on public.module_activations
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy module_activations_delete_own on public.module_activations
  for delete to authenticated using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- habits
-- ---------------------------------------------------------------------------

create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  chapter_id uuid,
  name text not null,
  description text,
  -- cadence v1 JSON: { kind: 'daily'|'weekdays', weekdays?: 1-7[], startOn, endOn? }
  cadence jsonb not null,
  min_value numeric not null default 1,
  target_value numeric not null default 1,
  unit text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id),
  constraint habits_min_target check (target_value >= min_value),
  foreign key (user_id, chapter_id)
    references public.chapters (user_id, id)
    on delete set null
);

create index habits_user_active_idx on public.habits (user_id, is_active);

alter table public.habits enable row level security;

create policy habits_select_own on public.habits
  for select to authenticated using (auth.uid() = user_id);
create policy habits_insert_own on public.habits
  for insert to authenticated with check (auth.uid() = user_id);
create policy habits_update_own on public.habits
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy habits_delete_own on public.habits
  for delete to authenticated using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- habit_logs
-- ---------------------------------------------------------------------------

create table public.habit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  habit_id uuid not null,
  logged_on date not null,
  status text not null check (status in (
    'completed', 'partial', 'missed', 'not_scheduled', 'recovery'
  )),
  value numeric,
  notes text,
  recovers_log_id uuid,
  created_at timestamptz not null default now(),
  unique (user_id, id),
  unique (user_id, habit_id, id),
  constraint habit_logs_recovery_nullness check (
    (status = 'recovery') = (recovers_log_id is not null)
  ),
  foreign key (user_id, habit_id)
    references public.habits (user_id, id)
    on delete cascade,
  foreign key (user_id, habit_id, recovers_log_id)
    references public.habit_logs (user_id, habit_id, id)
);

-- One primary (non-recovery) log per habit/date
create unique index habit_logs_primary_unique
  on public.habit_logs (habit_id, logged_on)
  where status <> 'recovery';

create unique index habit_logs_recovery_unique
  on public.habit_logs (habit_id, recovers_log_id)
  where status = 'recovery';

create index habit_logs_user_habit_date_idx
  on public.habit_logs (user_id, habit_id, logged_on);

alter table public.habit_logs enable row level security;

create policy habit_logs_select_own on public.habit_logs
  for select to authenticated using (auth.uid() = user_id);
create policy habit_logs_insert_own on public.habit_logs
  for insert to authenticated with check (auth.uid() = user_id);
-- Updates allowed only for non-immutable fields on non-referenced rows via trigger below;
-- keep RLS update own for notes/value corrections that trigger permits.
create policy habit_logs_update_own on public.habit_logs
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy habit_logs_delete_own on public.habit_logs
  for delete to authenticated using (auth.uid() = user_id);

-- Recovery integrity: referenced log must be missed|partial and same habit/user (FK covers user+habit).
create or replace function public.enforce_habit_recovery_insert()
returns trigger
language plpgsql
as $$
declare
  original public.habit_logs%rowtype;
begin
  if new.status = 'recovery' then
    select * into original
    from public.habit_logs
    where id = new.recovers_log_id
      and user_id = new.user_id
      and habit_id = new.habit_id;

    if not found then
      raise exception 'recovery target not found for same user/habit';
    end if;

    if original.status not in ('missed', 'partial') then
      raise exception 'recovery may only link to missed or partial logs';
    end if;
  end if;
  return new;
end;
$$;

create trigger habit_logs_recovery_insert
  before insert on public.habit_logs
  for each row execute function public.enforce_habit_recovery_insert();

-- Immutable primary history: block status/identity rewrites when referenced or for primary keys.
create or replace function public.enforce_habit_log_immutability()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' then
    if exists (
      select 1 from public.habit_logs r
      where r.recovers_log_id = old.id
    ) then
      if new.status is distinct from old.status
         or new.logged_on is distinct from old.logged_on
         or new.habit_id is distinct from old.habit_id
         or new.user_id is distinct from old.user_id
         or new.recovers_log_id is distinct from old.recovers_log_id then
        raise exception 'cannot rewrite a habit log that has recovery links';
      end if;
    end if;

    -- Never silently rewrite missed/partial into completed/etc.
    if old.status in ('missed', 'partial')
       and new.status is distinct from old.status then
      raise exception 'primary missed/partial status is immutable; use a recovery log';
    end if;

    if old.status = 'recovery'
       and (
         new.status is distinct from old.status
         or new.recovers_log_id is distinct from old.recovers_log_id
         or new.habit_id is distinct from old.habit_id
         or new.user_id is distinct from old.user_id
       ) then
      raise exception 'recovery linkage fields are immutable';
    end if;
  end if;
  return new;
end;
$$;

create trigger habit_logs_immutability
  before update on public.habit_logs
  for each row execute function public.enforce_habit_log_immutability();

-- ---------------------------------------------------------------------------
-- projects / milestones / tasks
-- ---------------------------------------------------------------------------

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  chapter_id uuid,
  title text not null,
  description text,
  status text not null default 'active'
    check (status in ('active', 'paused', 'done', 'dropped')),
  priority integer,
  target_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id),
  foreign key (user_id, chapter_id)
    references public.chapters (user_id, id)
    on delete set null
);

create index projects_user_status_idx on public.projects (user_id, status);

alter table public.projects enable row level security;
create policy projects_select_own on public.projects for select to authenticated using (auth.uid() = user_id);
create policy projects_insert_own on public.projects for insert to authenticated with check (auth.uid() = user_id);
create policy projects_update_own on public.projects for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy projects_delete_own on public.projects for delete to authenticated using (auth.uid() = user_id);

create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid,
  title text not null,
  description text,
  status text not null default 'pending'
    check (status in ('pending', 'hit', 'missed', 'cancelled')),
  target_on date,
  achieved_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id),
  foreign key (user_id, project_id)
    references public.projects (user_id, id)
    on delete set null
);

create index milestones_user_status_idx on public.milestones (user_id, status);

alter table public.milestones enable row level security;
create policy milestones_select_own on public.milestones for select to authenticated using (auth.uid() = user_id);
create policy milestones_insert_own on public.milestones for insert to authenticated with check (auth.uid() = user_id);
create policy milestones_update_own on public.milestones for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy milestones_delete_own on public.milestones for delete to authenticated using (auth.uid() = user_id);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid,
  milestone_id uuid,
  title text not null,
  notes text,
  status text not null default 'todo'
    check (status in ('todo', 'doing', 'done', 'cancelled')),
  due_on date,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id),
  foreign key (user_id, project_id)
    references public.projects (user_id, id)
    on delete set null,
  foreign key (user_id, milestone_id)
    references public.milestones (user_id, id)
    on delete set null
);

create index tasks_user_status_due_idx on public.tasks (user_id, status, due_on);

alter table public.tasks enable row level security;
create policy tasks_select_own on public.tasks for select to authenticated using (auth.uid() = user_id);
create policy tasks_insert_own on public.tasks for insert to authenticated with check (auth.uid() = user_id);
create policy tasks_update_own on public.tasks for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy tasks_delete_own on public.tasks for delete to authenticated using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- audit_logs (append-oriented; no client update/delete)
-- ---------------------------------------------------------------------------

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  actor_type text not null check (actor_type in ('user', 'system', 'mcp', 'agent')),
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_user_created_idx on public.audit_logs (user_id, created_at desc);

alter table public.audit_logs enable row level security;

create policy audit_logs_select_own on public.audit_logs
  for select to authenticated
  using (auth.uid() = user_id);

create policy audit_logs_insert_own on public.audit_logs
  for insert to authenticated
  with check (auth.uid() = user_id);

-- Intentionally no UPDATE/DELETE policies for authenticated clients.
