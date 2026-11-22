-- Phase 1B core schema DRAFT for personal-os-dev (qyysmgwdvhftbgwhpbjt, eu-central-1).
-- DO NOT APPLY until separate human L3 approval.
-- Final L3 corrections: function EXECUTE lockdown, audit SELECT-only for clients,
-- cadence JSON checks, non-negative value constraints.

create extension if not exists pgcrypto with schema extensions;

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
  using ((select auth.uid()) = id);

create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check ((select auth.uid()) = id);

create policy profiles_update_own on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- No DELETE policy for authenticated clients.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;
revoke all on function public.handle_new_user() from anon, authenticated, service_role;
grant execute on function public.handle_new_user() to supabase_auth_admin;

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
  for select to authenticated using ((select auth.uid()) = user_id);
create policy chapters_insert_own on public.chapters
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy chapters_update_own on public.chapters
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

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
  for select to authenticated using ((select auth.uid()) = user_id);
create policy module_activations_insert_own on public.module_activations
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy module_activations_update_own on public.module_activations
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- habit cadence validator (DB-level; mirrors habitCadenceSchema v1)
-- Fail-closed: always returns TRUE or FALSE — never NULL (CHECK accepts NULL).
-- IMMUTABLE, SECURITY INVOKER, side-effect-free. Invalid dates → FALSE.
-- ---------------------------------------------------------------------------

create or replace function public.is_valid_habit_cadence(c jsonb)
returns boolean
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  kind text;
  start_txt text;
  end_txt text;
  start_d date;
  end_d date;
  elem jsonb;
  n numeric;
  weekday_count integer;
begin
  if c is null or jsonb_typeof(c) is distinct from 'object' then
    return false;
  end if;

  kind := c->>'kind';
  if kind is null or kind not in ('daily', 'weekdays') then
    return false;
  end if;

  if not (c ? 'startOn') or jsonb_typeof(c->'startOn') is distinct from 'string' then
    return false;
  end if;
  start_txt := c->>'startOn';
  if start_txt is null or start_txt !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    return false;
  end if;
  begin
    start_d := start_txt::date;
    if to_char(start_d, 'YYYY-MM-DD') is distinct from start_txt then
      return false;
    end if;
  exception
    when others then
      return false;
  end;

  -- endOn omitted or JSON null → open-ended; otherwise must be valid date ≥ startOn
  if (c ? 'endOn') and (c->'endOn') is distinct from 'null'::jsonb then
    if jsonb_typeof(c->'endOn') is distinct from 'string' then
      return false;
    end if;
    end_txt := c->>'endOn';
    if end_txt is null or end_txt !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
      return false;
    end if;
    begin
      end_d := end_txt::date;
      if to_char(end_d, 'YYYY-MM-DD') is distinct from end_txt then
        return false;
      end if;
    exception
      when others then
        return false;
    end;
    if end_d < start_d then
      return false;
    end if;
  end if;

  -- weekdays: required for kind=weekdays; optional for daily; if present must be
  -- array of 1–7 integers each in 1..7 (parity with habitCadenceSchema / Zod).
  if kind = 'weekdays' and not (c ? 'weekdays') then
    return false;
  end if;

  if c ? 'weekdays' then
    if jsonb_typeof(c->'weekdays') is distinct from 'array' then
      return false;
    end if;
    weekday_count := jsonb_array_length(c->'weekdays');
    if weekday_count is null or weekday_count < 1 or weekday_count > 7 then
      return false;
    end if;
    for elem in select value from jsonb_array_elements(c->'weekdays')
    loop
      if jsonb_typeof(elem) is distinct from 'number' then
        return false;
      end if;
      begin
        n := (elem #>> '{}')::numeric;
      exception
        when others then
          return false;
      end;
      if n is distinct from trunc(n) or n < 1 or n > 7 then
        return false;
      end if;
    end loop;
  end if;

  return true;
end;
$$;

-- CHECK evaluation runs as the inserting role → authenticated needs EXECUTE.
revoke all on function public.is_valid_habit_cadence(jsonb) from public;
revoke all on function public.is_valid_habit_cadence(jsonb) from anon, service_role;
grant execute on function public.is_valid_habit_cadence(jsonb) to authenticated;

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
  constraint habits_min_nonneg check (min_value >= 0),
  constraint habits_min_target check (target_value >= min_value),
  -- IS TRUE so a NULL function result cannot pass the CHECK.
  constraint habits_cadence_v1 check (public.is_valid_habit_cadence(cadence) is true),
  foreign key (user_id, chapter_id)
    references public.chapters (user_id, id)
    on delete set null (chapter_id)
);

create index habits_user_active_idx on public.habits (user_id, is_active);

alter table public.habits enable row level security;

create policy habits_select_own on public.habits
  for select to authenticated using ((select auth.uid()) = user_id);
create policy habits_insert_own on public.habits
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy habits_update_own on public.habits
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

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
  constraint habit_logs_value_nonneg check (value is null or value >= 0),
  -- Named deferred NO ACTION FKs: individual habit/original deletes still fail
  -- while dependents exist (force-check via SET CONSTRAINTS … IMMEDIATE in tests).
  -- Whole-account purge (auth.users CASCADE) succeeds in one transaction without
  -- casually CASCADE-wiping history on single-habit delete.
  constraint habit_logs_habit_fkey
    foreign key (user_id, habit_id)
    references public.habits (user_id, id)
    on delete no action
    deferrable initially deferred,
  constraint habit_logs_recovery_fkey
    foreign key (user_id, habit_id, recovers_log_id)
    references public.habit_logs (user_id, habit_id, id)
    on delete no action
    deferrable initially deferred
);

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
  for select to authenticated using ((select auth.uid()) = user_id);
create policy habit_logs_insert_own on public.habit_logs
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy habit_logs_update_own on public.habit_logs
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create or replace function public.enforce_habit_recovery_insert()
returns trigger
language plpgsql
set search_path = ''
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

-- Trigger functions: migration owner creates triggers; no API-role EXECUTE.
revoke all on function public.enforce_habit_recovery_insert() from public;
revoke all on function public.enforce_habit_recovery_insert() from anon, authenticated, service_role;

create trigger habit_logs_recovery_insert
  before insert on public.habit_logs
  for each row execute function public.enforce_habit_recovery_insert();

create or replace function public.enforce_habit_log_immutability()
returns trigger
language plpgsql
set search_path = ''
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

revoke all on function public.enforce_habit_log_immutability() from public;
revoke all on function public.enforce_habit_log_immutability() from anon, authenticated, service_role;

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
    on delete set null (chapter_id)
);

create index projects_user_status_idx on public.projects (user_id, status);

alter table public.projects enable row level security;
create policy projects_select_own on public.projects
  for select to authenticated using ((select auth.uid()) = user_id);
create policy projects_insert_own on public.projects
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy projects_update_own on public.projects
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

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
    on delete set null (project_id)
);

create index milestones_user_status_idx on public.milestones (user_id, status);

alter table public.milestones enable row level security;
create policy milestones_select_own on public.milestones
  for select to authenticated using ((select auth.uid()) = user_id);
create policy milestones_insert_own on public.milestones
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy milestones_update_own on public.milestones
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

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
    on delete set null (project_id),
  foreign key (user_id, milestone_id)
    references public.milestones (user_id, id)
    on delete set null (milestone_id)
);

create index tasks_user_status_due_idx on public.tasks (user_id, status, due_on);

alter table public.tasks enable row level security;
create policy tasks_select_own on public.tasks
  for select to authenticated using ((select auth.uid()) = user_id);
create policy tasks_insert_own on public.tasks
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy tasks_update_own on public.tasks
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- audit_logs
-- ---------------------------------------------------------------------------
-- Clients: SELECT own only. No generic client audit writer.
-- Trusted writing (user/system/mcp/agent) is deferred until a secure
-- server-side or DB-trigger mechanism exists — never agent-held credentials.

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
  using ((select auth.uid()) = user_id);

-- No INSERT / UPDATE / DELETE policies for authenticated clients.

-- ---------------------------------------------------------------------------
-- Explicit table privileges (hosted PG17 / Supabase roles)
-- ---------------------------------------------------------------------------

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.chapters from anon, authenticated;
revoke all on table public.module_activations from anon, authenticated;
revoke all on table public.habits from anon, authenticated;
revoke all on table public.habit_logs from anon, authenticated;
revoke all on table public.projects from anon, authenticated;
revoke all on table public.milestones from anon, authenticated;
revoke all on table public.tasks from anon, authenticated;
revoke all on table public.audit_logs from anon, authenticated;

grant select, insert, update on table public.profiles to authenticated;
grant select, insert, update on table public.chapters to authenticated;
grant select, insert, update on table public.module_activations to authenticated;
grant select, insert, update on table public.habits to authenticated;
grant select, insert, update on table public.habit_logs to authenticated;
grant select, insert, update on table public.projects to authenticated;
grant select, insert, update on table public.milestones to authenticated;
grant select, insert, update on table public.tasks to authenticated;
grant select on table public.audit_logs to authenticated;

-- ---------------------------------------------------------------------------
-- Function EXECUTE assertions (fail migration if grants are wrong)
-- ---------------------------------------------------------------------------

do $$
begin
  -- handle_new_user: only supabase_auth_admin (PUBLIC revoked; no role named "public")
  if has_function_privilege('anon', 'public.handle_new_user()', 'EXECUTE') then
    raise exception 'anon must not EXECUTE handle_new_user';
  end if;
  if has_function_privilege('authenticated', 'public.handle_new_user()', 'EXECUTE') then
    raise exception 'authenticated must not EXECUTE handle_new_user';
  end if;
  if has_function_privilege('service_role', 'public.handle_new_user()', 'EXECUTE') then
    raise exception 'service_role must not EXECUTE handle_new_user';
  end if;
  if not has_function_privilege('supabase_auth_admin', 'public.handle_new_user()', 'EXECUTE') then
    raise exception 'supabase_auth_admin must EXECUTE handle_new_user';
  end if;

  -- trigger enforcers: no API-role EXECUTE (migration owner creates triggers)
  if has_function_privilege('anon', 'public.enforce_habit_recovery_insert()', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.enforce_habit_recovery_insert()', 'EXECUTE')
     or has_function_privilege('service_role', 'public.enforce_habit_recovery_insert()', 'EXECUTE')
  then
    raise exception 'API roles must not EXECUTE enforce_habit_recovery_insert';
  end if;

  if has_function_privilege('anon', 'public.enforce_habit_log_immutability()', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.enforce_habit_log_immutability()', 'EXECUTE')
     or has_function_privilege('service_role', 'public.enforce_habit_log_immutability()', 'EXECUTE')
  then
    raise exception 'API roles must not EXECUTE enforce_habit_log_immutability';
  end if;

  -- cadence validator: authenticated must EXECUTE (CHECK on INSERT/UPDATE); anon/service_role must not
  if not has_function_privilege('authenticated', 'public.is_valid_habit_cadence(jsonb)', 'EXECUTE') then
    raise exception 'authenticated must EXECUTE is_valid_habit_cadence';
  end if;
  if has_function_privilege('anon', 'public.is_valid_habit_cadence(jsonb)', 'EXECUTE') then
    raise exception 'anon must not EXECUTE is_valid_habit_cadence';
  end if;
  if has_function_privilege('service_role', 'public.is_valid_habit_cadence(jsonb)', 'EXECUTE') then
    raise exception 'service_role must not EXECUTE is_valid_habit_cadence';
  end if;
end $$;
