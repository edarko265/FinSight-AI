# Coding conventions — FinSight-AI

Pragmatic rules for a small team moving quickly: clarity, consistency and reviewability
over personal preference.

> When in doubt, match the surrounding code. When the surrounding code is wrong, fix it in
> a small, separate pull request.

---

## 1. Tooling baseline

- **TypeScript** (strict) for everything.
- **Next.js 16** App Router. This version differs from older ones; check the bundled docs
  in `node_modules/next/dist/docs/` before relying on an API from memory.
- **Node.js 24** (see `.nvmrc`), **pnpm** with a committed lockfile.
- **ESLint + Prettier** for lint and format. **Vitest** for unit tests, **Playwright** for
  end-to-end.
- Editor behaviour comes from [`.editorconfig`](../.editorconfig); line endings from
  [`.gitattributes`](../.gitattributes).

## 2. Layout

```
src/
  app/                 pages and route handlers
  components/          chat, cards, charts, evidence, layout, ui
  lib/
    ai/                provider adapter, prompts, tool registry
    analytics/         spending, baskets, recurrence, forecast, scenarios
    contracts/         shared Zod schemas and serialisable types
    data/              repositories, category and MCC mappings
    db/                schema, connection, migrations
    demo/              persona registry, simulated clock, session
    security/          encryption, validation, limits
    money.ts
scripts/               ingestion and profiling
tests/                 fixtures, unit, integration, e2e, evals
docs/
```

## 3. Naming

| Thing                 | Convention             | Example                |
| --------------------- | ---------------------- | ---------------------- |
| TS files              | `kebab-case.ts`        | `basket-mapper.ts`     |
| React component files | `PascalCase.tsx`       | `EvidenceSheet.tsx`    |
| Components, types     | `PascalCase`           | `CoachResult`          |
| Hooks                 | `useCamelCase`         | `useAssumptions`       |
| Variables, functions  | `camelCase`            | `getSpendingSummary()` |
| Constants             | `SCREAMING_SNAKE_CASE` | `MAX_TOOL_STEPS`       |
| Environment variables | `SCREAMING_SNAKE_CASE` | `DATABASE_URL`         |
| DB tables             | `snake_case`, plural   | `demo_sessions`        |
| DB columns            | `snake_case`           | `created_at`           |
| Money values          | suffix `Cents`         | `baselineSpendCents`   |

## 4. TypeScript

- `"strict": true`. No `any` — use `unknown` and narrow, or define a type.
- Avoid non-null assertions (`!`); narrow explicitly.
- Exported functions have explicit return types.
- Named exports. Default exports only where the framework requires them (pages, layouts).
- Import through the `@/` alias instead of long relative paths.
- One concern per file; split at roughly 300 lines.

## 5. Money, dates and numbers

- **Money is integer cents.** Never store, sum or compare euro floats.
- Parse decimals with `parseDecimalToCents`; format only at the UI boundary with
  `formatEur`.
- Round once per calculation, not once per transaction.
- Dates use inclusive start and exclusive end. The current date comes from the server-owned
  demo clock, never from `new Date()` in analytics code.
- Never use data dated after the as-of cutoff.

## 6. Security rules that apply to every change

Full detail in [security.md](security.md). The short version:

- **Nothing sensitive is written to the database unencrypted.** Use
  `encryptField` / `blindIndex` from `@/lib/security/crypto`.
- The customer comes from the server session, never from client input.
- Validate every external input with a schema. Parameterised SQL only.
- No secrets in code or logs. Server secrets never start with `NEXT_PUBLIC_`.
- The model never does arithmetic and never receives raw transactions.

## 7. Errors and logging

- Never swallow errors silently. Throw `Error` or a typed subclass, not strings.
- Validate at boundaries (route handlers, scripts); internal code may trust its inputs.
- Return safe, generic errors to the client; keep detail in server logs.
- Never log secrets, decrypted values, prompts or transaction rows.

## 8. React and UI

- Server Components by default; add `"use client"` only where interaction needs it.
- Design at 390 px first, verify at 320 px and desktop. No horizontal page scroll.
- Semantic HTML first, ARIA only when needed. Everything reachable by keyboard.
- Never rely on colour alone; pair every chart with text and values.
- Tone: calm and non-judgmental. "Your restaurant spending was higher this month", never
  "You overspent again".

## 9. Testing

- Every bug fix gets a regression test.
- Money results are asserted as exact integer cents.
- Test behaviour, not implementation. Names describe behaviour:
  `it("rejects more than two non-zero decimal places")`.
- Fixtures are hand-authored. Never copy bank data into tests.
- CI never calls a paid model.

## 10. Git and commits

- [Conventional Commits](https://www.conventionalcommits.org):
  ```
  feat(analytics): add basket reconciliation
  fix(ingest): strip BOM before header match
  docs(security): describe key rotation
  chore(deps): bump next
  ```
- One logical change per commit. Commits are authored by the person who made them.
- Branches and pull requests: see [branching-strategy.md](branching-strategy.md).

## 11. Pull requests

- Small: aim for under ~400 changed lines.
- `pnpm check` green before asking for review.
- The author owns getting it merged.

## 12. Dependencies

- Justify new dependencies in the pull request. Prefer the platform or existing utilities.
- Before adding an AI SDK or provider package, check its current official documentation and
  pick mutually compatible stable versions.
- Dependabot handles minor and patch updates.

## 13. Documentation

- Comment **why**, not what.
- Update the relevant doc and `CHANGELOG.md` in the same pull request that changes
  behaviour.
- Bank answers go into [decisions.md](decisions.md) the moment we get them.
