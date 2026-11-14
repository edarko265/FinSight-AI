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

| Date       | Decision                                                                                                                  | Why                                                                                                   |
| ---------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 2026-11-13 | PostgreSQL in an EU region, with application-level field encryption                                                       | See [database.md](database.md)                                                                        |
| 2026-11-13 | Nothing a customer owns is stored unencrypted                                                                             | See [security.md](security.md)                                                                        |
| 2026-11-13 | Personal branches → `dev` → `main`                                                                                        | See [branching-strategy.md](branching-strategy.md)                                                    |
| 2026-11-13 | MIT licence; bank dataset excluded from the repository                                                                    | Open-source entry; the data is not ours to license                                                    |
| 2026-11-14 | One sealed ledger per customer instead of one encrypted row per transaction                                               | A customer has at most ~1,500 transactions; one row is faster, smaller and reveals less               |
| 2026-11-14 | Plain SQL and SQL migrations, no ORM                                                                                      | Few, simple tables; fewer moving parts                                                                |
| 2026-11-14 | Sign in with a synthetic customer ID and a shared demo password                                                           | The dataset has 5,100 customers and no real users                                                     |
| 2026-11-14 | The bank confirmed that data derived from the synthetic set may go to outside AI services                                 | Allows the AI coach and voice; still opt-in per customer                                              |
| 2026-11-14 | The model chooses calculations but never calculates; its wording is checked against the result                            | Trust and repeatability                                                                               |
| 2026-11-14 | Basket classification by versioned rules, not by the model                                                                | Totals must be repeatable and explainable                                                             |
| 2026-11-14 | Proactive insights shown in the app, not pushed to the device                                                             | The scope excludes a push-notification system                                                         |
| 2026-11-14 | Rewards and example coupons, measured against the customer's own past                                                     | Team request; ties to the bank's bonus programme. Departs from the scope, which excluded gamification |
| 2026-11-14 | Statistics Finland benchmark included, per consumption unit, 2022, by age group                                           | The brief encourages open-data benchmarks; shown as context, not a ranking                            |
| 2026-11-14 | Voice through ElevenLabs: speech both ways and a realtime agent whose only tool asks our coach                            | Real voice in three languages without giving the agent any data                                       |
| 2026-11-14 | OpenAI by default, Gemini switchable in Admin                                                                             | Gemini was slower in testing; its hackathon account is temporary                                      |
| 2026-11-14 | Adviser hand-over with the first conversation free and a fee set in Admin (starts at €19)                                 | Illustrates a revenue path; investment advice comes from a person                                     |
| 2026-11-14 | Terms and privacy accepted at first sign-in; AI as a separate optional choice                                             | GDPR: consent must be specific and freely given                                                       |
| 2026-11-14 | Every form opens from a button as a step-by-step wizard; everything creatable has edit, bin, restore and permanent delete | User experience                                                                                       |
| 2026-11-14 | Neon in Frankfurt for the demo database                                                                                   | Free tier, plain PostgreSQL, EU region                                                                |
| 2026-11-14 | Deploy on Vercel at `finsightai.araxda.com`                                                                               | So the team and judges can try it                                                                     |
