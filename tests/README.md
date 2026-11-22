# Tests

- `unit/` — Vitest + Testing Library (domain + UI primitives)
- `e2e/` — Playwright (app shell navigation in Phase 1A)

```bash
npm run test
npm run test:e2e
```

Use Node >= 20.9. If an older Node appears first on PATH, launch with the system
Node binary (Playwright’s webServer uses `process.execPath`).
