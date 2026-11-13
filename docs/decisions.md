# Decisions and open questions

Answers from the bank override the proposed defaults in the
[project scope](FinSight-AI-Project-Scope.md). Record each answer here as soon as we have
it: who said it, when, and what changed.

## Open questions for the bank

| #   | Question                                                               | Blocks                          | Default until answered                                             | Answer |
| --- | ---------------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------ | ------ |
| 1   | May synthetic-derived aggregates be sent to an external AI model?      | Live AI (milestone D)           | `AI_PROCESSING_ALLOWED=false`, deterministic mode                  |        |
| 2   | May selected rows be deployed publicly or committed as small fixtures? | Publishing bank-derived samples | Keep all bank data untracked; hand-author fixtures                 |        |
| 3   | How do groceries and essential variable costs fit the three baskets?   | Final basket taxonomy           | Everyday basket with essential / discretionary / unknown sublabels |        |
| 4   | Is the balance booked cash, available cash, or something else?         | Wording of the estimate         | Label "recorded account balance"; estimate only                    |        |
| 5   | What does `salary_sweep` represent?                                    | Savings story                   | Separate non-consumption outflow of unknown purpose                |        |
| 6   | What timezone do the timestamps use?                                   | Timezone guarantees             | Preserve the local-looking value; mark unconfirmed                 |        |
| 7   | Is a mobile WebView embed enough for S-mobiili?                        | Integration claims              | Document the proposed adapter; claim nothing                       |        |
| 8   | Are the mortgage files expected to be used?                            | Nothing                         | Exclude from the MVP                                               |        |
| 9   | Which language is required?                                            | Nothing                         | English first                                                      |        |
| 10  | Which persona and pitch length matter most?                            | Nothing                         | Everyday customer; three-minute pitch                              |        |

## Team decisions

| Date       | Decision                                                       | Why                                                |
| ---------- | -------------------------------------------------------------- | -------------------------------------------------- |
| 2026-11-13 | PostgreSQL, EU region, with application-level field encryption | See [database.md](database.md)                     |
| 2026-11-13 | Nothing sensitive is stored unencrypted in the database        | See [security.md](security.md)                     |
| 2026-11-13 | Personal branches → `dev` → `main`                             | See [branching-strategy.md](branching-strategy.md) |
| 2026-11-13 | MIT licence; bank dataset excluded from the repository         | Open-source entry; data is not ours to license     |
