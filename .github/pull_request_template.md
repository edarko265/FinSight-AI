# Pull Request

## Summary

<!-- What does this PR do? Keep it short and clear. -->

## Why

<!-- Link the requirement (e.g. P0-03) or issue: Closes #... -->

## Type of change

- [ ] feat — new feature
- [ ] fix — bug fix
- [ ] refactor — code change without behavior change
- [ ] docs — documentation only
- [ ] test — tests only
- [ ] chore / ci — tooling, dependencies, pipeline

## Affected areas

- [ ] Mobile UI (Coach / My money / Explore)
- [ ] Analytics (spending, baskets, forecast, scenarios)
- [ ] Data ingestion / database schema
- [ ] AI orchestration / tools
- [ ] Security / encryption / sessions
- [ ] CI/CD / docs

## Validation checklist

- [ ] Base branch is `dev` (only `dev` is promoted to `main`)
- [ ] `pnpm check` passes locally (lint, typecheck, test, build)
- [ ] New behavior has tests; money results are asserted in integer cents
- [ ] No secrets, `.env` files, bank CSVs or derived bank data are committed
- [ ] Nothing sensitive is written to the database unencrypted
- [ ] Every query is scoped to the server-side customer context
- [ ] Docs / `CHANGELOG.md` updated if behavior changed

## Deployment impact

- [ ] None
- [ ] New or changed environment variable(s) — listed in `.env.example`:
- [ ] Database migration

## Screenshots (UI changes, 390 px wide)
