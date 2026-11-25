# SQL tests (executable assertions — not run until authorized)

Transactional SQL with `RAISE EXCEPTION` on failure. Intended for
`supabase test db` / SQL Editor **after** L3 apply to personal-os-dev only
(`qyysmgwdvhftbgwhpbjt`, eu-central-1).

## Constraints

- **Do not start Docker** in agent passes unless explicitly approved.
- **Do not** run against hosted DEV until migration apply is approved.
- Agent authoring passes: **authored only — not executed.**

## Files

| File | Covers |
|------|--------|
| `01_privileges_and_functions.sql` | Table privileges; function EXECUTE; authenticated cadence EXECUTE + valid habit INSERT under CHECK |
| `02_rls_and_audit.sql` | Own vs cross-user RLS; no DELETE; audit insert denial |
| `03_fk_cadence_recovery.sql` | Fail-closed cadence cases; composite FK; SET NULL (col); habit/log NO ACTION; recovery |
| `04_account_deletion.sql` | Whole-account purge; no orphans; deferred NO ACTION vs history-preserving individual deletes |
| `05_phase2_ownership_rls.sql` | Phase 2 check_ins / reviews / physical_metrics |
| `06_phase3_finance_ownership.sql` | Phase 3 finance accounts/txs/pnl; transfer RPC; DB-wide economic pairing (SET CONSTRAINTS IMMEDIATE on ins/upd + del deferred triggers); opening unique; FX; PnL currency match; no partials. Authored only — not executed until L3. Transfer-group concurrency assumes **READ COMMITTED**; advisory lock alone is not equivalent under REPEATABLE READ/SERIALIZABLE. |

## Runner (future, human-approved)

```bash
# Example only — do not run until authorized:
# npx supabase test db
```
