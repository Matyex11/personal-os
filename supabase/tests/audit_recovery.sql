-- Phase 1B audit integrity + habit recovery constraints (AUTHOR ONLY — not executed).

begin;

-- ---------------------------------------------------------------------------
-- Audit: authenticated may only insert actor_type = 'user' + user_id = auth.uid()
-- ---------------------------------------------------------------------------

-- As authenticated JWT for :u1
-- INSERT into audit_logs (user_id, actor_type, action)
--   values (:u1, 'user', 'test.ok') → success
-- INSERT (... actor_type = 'system' ...) → fails WITH CHECK
-- INSERT (... actor_type = 'mcp' ...) → fails WITH CHECK
-- INSERT (... actor_type = 'agent' ...) → fails WITH CHECK
-- INSERT (... user_id = :u2, actor_type = 'user' ...) → fails WITH CHECK
-- UPDATE audit_logs SET action = 'x' → fails (no privilege / no policy)
-- DELETE from audit_logs → fails (no privilege / no policy)

-- Future trusted-server path for system/mcp/agent:
--   security definer writer OR service_role in Next/MCP *host* only —
--   never agent-held credentials. Documented in docs/SECURITY.md.

-- ---------------------------------------------------------------------------
-- Recovery constraints
-- ---------------------------------------------------------------------------

-- INSERT recovery with recovers_log_id null → CHECK fails
-- INSERT non-recovery with recovers_log_id set → CHECK fails
-- INSERT recovery targeting completed log → trigger exception
-- INSERT recovery targeting other habit → FK / trigger exception
-- INSERT recovery targeting other user → FK exception
-- UPDATE missed status → completed → trigger exception
-- UPDATE log that already has a recovery link (status/logged_on/habit_id/user_id)
--   → trigger exception
-- DELETE habit_logs as authenticated → privilege denied (no hard delete)

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'audit_logs'
      and policyname = 'audit_logs_insert_user_self'
  ) then
    raise notice 'REVIEW: expect audit_logs_insert_user_self policy after apply';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename in ('chapters','habits','habit_logs','projects','milestones','tasks')
      and cmd = 'DELETE'
  ) then
    raise exception 'authenticated DELETE policies must not exist on domain tables';
  end if;
end $$;

rollback;
