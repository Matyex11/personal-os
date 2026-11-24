-- Phase 2 schema DRAFT for personal-os-dev (qyysmgwdvhftbgwhpbjt, eu-central-1).
-- Tables: check_ins, reviews, physical_metrics.
-- DO NOT APPLY until separate human L3 approval on the named DEV project.
-- Does not ALTER Phase 1B tables, Auth, or existing RLS/policies.
-- Privilege matrix matches Phase 1B: authenticated SELECT/INSERT/UPDATE own; no DELETE.

-- ---------------------------------------------------------------------------
-- check_ins
-- ---------------------------------------------------------------------------

create table public.check_ins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  chapter_id uuid,
  checked_on date not null,
  mood smallint not null,
  energy smallint not null,
  focus smallint not null,
  body text,
  prompt_set_key text not null default 'v1_simple',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id),
  unique (user_id, checked_on),
  constraint check_ins_mood_range check (mood between 1 and 5),
  constraint check_ins_energy_range check (energy between 1 and 5),
  constraint check_ins_focus_range check (focus between 1 and 5),
  constraint check_ins_body_length check (body is null or char_length(body) <= 2000),
  -- v1 only: must equal 'v1_simple' (column NOT NULL + default preserves omit path).
  constraint check_ins_prompt_set_key_v1_simple check (prompt_set_key = 'v1_simple'),
  foreign key (user_id, chapter_id)
    references public.chapters (user_id, id)
    on delete set null (chapter_id)
);

create index check_ins_user_checked_on_idx
  on public.check_ins (user_id, checked_on desc);

alter table public.check_ins enable row level security;

create policy check_ins_select_own on public.check_ins
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy check_ins_insert_own on public.check_ins
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy check_ins_update_own on public.check_ins
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- No DELETE policy for authenticated clients.

-- ---------------------------------------------------------------------------
-- reviews
-- ---------------------------------------------------------------------------

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  chapter_id uuid,
  period_kind text not null,
  period_start date not null,
  period_end date not null,
  status text not null default 'draft',
  answers jsonb not null default '{}'::jsonb,
  narrative text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id),
  unique (user_id, period_kind, period_start, period_end),
  constraint reviews_period_kind check (
    period_kind in ('weekly', 'monthly', 'chapter', 'custom')
  ),
  constraint reviews_period_order check (period_start <= period_end),
  constraint reviews_status check (status in ('draft', 'completed')),
  constraint reviews_completed_at_consistency check (
    (status = 'draft' and completed_at is null)
    or (status = 'completed' and completed_at is not null)
  ),
  constraint reviews_answers_object check (jsonb_typeof(answers) = 'object'),
  foreign key (user_id, chapter_id)
    references public.chapters (user_id, id)
    on delete set null (chapter_id)
);

create index reviews_user_period_start_idx
  on public.reviews (user_id, period_start desc);

alter table public.reviews enable row level security;

create policy reviews_select_own on public.reviews
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy reviews_insert_own on public.reviews
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy reviews_update_own on public.reviews
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- No DELETE policy for authenticated clients.

-- ---------------------------------------------------------------------------
-- physical_metrics
-- ---------------------------------------------------------------------------

create table public.physical_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  recorded_on date not null,
  metric_key text not null,
  value numeric not null,
  unit text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id),
  unique (user_id, metric_key, recorded_on),
  -- Reject NaN / ±Infinity (numeric admits these literals; CHECK must fail closed).
  constraint physical_metrics_value_finite check (
    lower(btrim(value::text)) not in ('nan', 'infinity', '-infinity')
  ),
  -- Per-key unit + range bounds. Integer metrics require trunc(value) = value.
  constraint physical_metrics_key_unit_bounds check (
    (metric_key = 'weight_kg' and unit = 'kg'
      and value >= 0.1 and value <= 500)
    or (metric_key = 'sleep_hours' and unit = 'hours'
      and value >= 0 and value <= 24)
    or (metric_key = 'steps' and unit = 'count'
      and value >= 0 and value <= 200000 and value = trunc(value))
    or (metric_key = 'resting_hr_bpm' and unit = 'bpm'
      and value >= 20 and value <= 250 and value = trunc(value))
    or (metric_key = 'workout_minutes' and unit = 'minutes'
      and value >= 0 and value <= 1440 and value = trunc(value))
  )
);

create index physical_metrics_user_key_recorded_idx
  on public.physical_metrics (user_id, metric_key, recorded_on);

alter table public.physical_metrics enable row level security;

create policy physical_metrics_select_own on public.physical_metrics
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy physical_metrics_insert_own on public.physical_metrics
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy physical_metrics_update_own on public.physical_metrics
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- No DELETE policy for authenticated clients.

-- ---------------------------------------------------------------------------
-- Explicit table privileges (hosted PG17 / Supabase roles) — new tables only
-- ---------------------------------------------------------------------------

revoke all on table public.check_ins from anon, authenticated;
revoke all on table public.reviews from anon, authenticated;
revoke all on table public.physical_metrics from anon, authenticated;

grant select, insert, update on table public.check_ins to authenticated;
grant select, insert, update on table public.reviews to authenticated;
grant select, insert, update on table public.physical_metrics to authenticated;

-- ---------------------------------------------------------------------------
-- Privilege assertions (fail migration if grants are wrong)
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array['check_ins', 'reviews', 'physical_metrics']
  loop
    if has_table_privilege('anon', format('public.%I', t), 'SELECT')
       or has_table_privilege('anon', format('public.%I', t), 'INSERT')
       or has_table_privilege('anon', format('public.%I', t), 'UPDATE')
       or has_table_privilege('anon', format('public.%I', t), 'DELETE')
       or has_table_privilege('anon', format('public.%I', t), 'TRUNCATE')
       or has_table_privilege('anon', format('public.%I', t), 'REFERENCES')
       or has_table_privilege('anon', format('public.%I', t), 'TRIGGER')
    then
      raise exception 'anon must have no table privileges on %', t;
    end if;

    if has_table_privilege('authenticated', format('public.%I', t), 'DELETE')
       or has_table_privilege('authenticated', format('public.%I', t), 'TRUNCATE')
       or has_table_privilege('authenticated', format('public.%I', t), 'REFERENCES')
       or has_table_privilege('authenticated', format('public.%I', t), 'TRIGGER')
    then
      raise exception 'authenticated must not have DELETE/TRUNCATE/REFERENCES/TRIGGER on %', t;
    end if;

    if not has_table_privilege('authenticated', format('public.%I', t), 'SELECT')
       or not has_table_privilege('authenticated', format('public.%I', t), 'INSERT')
       or not has_table_privilege('authenticated', format('public.%I', t), 'UPDATE')
    then
      raise exception 'authenticated missing SELECT/INSERT/UPDATE on %', t;
    end if;
  end loop;
end $$;
