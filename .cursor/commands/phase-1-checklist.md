# Phase 1 checklist

Only run after the human approved Phase 0 and opened Phase 1.

Verify against `docs/ROADMAP.md` Phase 1:

1. Scaffold Next.js/TS/Tailwind/shadcn/Zod/Vitest/Playwright if not present
2. Draft migrations for core tables + RLS (do not apply without L3)
3. Auth + minimal UI for chapter, modules, habits, projects/milestones/tasks
4. Vitest for habit rules; Playwright smoke when app boots
5. Confirm no XNINE credentials and no Docker start unless L3-approved
6. Update `docs/DECISIONS.md` with any new choices

Stop and ask before hosted migration or Vercel deploy.
