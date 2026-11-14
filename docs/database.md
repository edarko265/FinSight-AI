# Database

**PostgreSQL, managed, in an EU region, holding ciphertext only.**

For the demo it runs on Neon in Frankfurt. Locally, with no `DATABASE_URL`, the app uses an
embedded PostgreSQL (PGlite) under `data/derived/`, so nothing needs installing.

---

## Why PostgreSQL

| Need              | How PostgreSQL meets it                                                        |
| ----------------- | ------------------------------------------------------------------------------ |
| Correctness       | Transactions, strict types, constraints that reject bad rows                   |
| Bank acceptance   | A standard relational database, widely run in regulated financial services     |
| Defence in depth  | TLS with certificate verification, roles, row-level security, audit extensions |
| Portability       | Runs as a managed service on every major cloud and on-premises                 |
| EU data residency | Available in EU regions on every major provider                                |
| Cost              | Open source, no licence fee, no lock-in                                        |

A document store or a vector database would be the wrong tool: the questions are structured
(filter, sum, compare periods) and the answers must reconcile to the cent.

## How this fits S-Pankki

S-Pankki's core banking runs on a platform provided by Crosskey
([case study](https://crosskey.fi/case-studies/s-pankki),
[partnership announcement](https://www.crosskey.fi/resources/s-bank-and-crosskey-extend-and-expand-their-cooperation-with-new-contract)).
Crosskey describes its stack as built on IBM iSeries
([Why Crosskey](https://www.crosskey.fi/company/why-us)). The database behind it is not
publicly documented, and we do not claim to know it.

That does not constrain the choice. FinSight-AI is a **companion service**, not part of the
core, and would never connect to the core database. It would read through an interface the
bank controls. In this codebase every read of customer data goes through one module,
[`repository.ts`](../src/lib/data/repository.ts); replacing its source with a bank API is
the integration point. PostgreSQL holds only what the service itself needs to keep.

## Where to host it

| Option                        | For the hackathon                                                        | For a bank                                                                           |
| ----------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| **Neon**                      | Chosen. Plain PostgreSQL, Frankfurt, free tier, branches per environment | A US company and serverless; unlikely to pass as it is                               |
| **Supabase**                  | Would also work; brings auth and storage we do not use                   | Same limits                                                                          |
| **Aiven**                     | More set-up                                                              | Stronger: a Finnish company, PostgreSQL in the cloud and region the customer chooses |
| **The bank's own PostgreSQL** | Not available to us                                                      | What customer data would actually require                                            |

The app needs nothing beyond standard PostgreSQL, so the bank can host it wherever its rules
require. Because the database only ever holds ciphertext, the hosting choice matters less
than usual.

## Tables

Twenty tables, created by the migrations in
[`src/lib/db/migrations`](../src/lib/db/migrations).

### Customer data — sealed

| Table              | Plain columns                                | Sealed or hashed                                                                                                                                                                                                                                                                                  |
| ------------------ | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `customer_ledgers` | key ID, ingestion ID                         | customer blind index; profile (customer ID, account ID, age, postal code); the whole transaction ledger                                                                                                                                                                                           |
| `customer_state`   | kind, updated-at                             | customer blind index; the value. Kinds: `views`, `goals`, `plans`, `linked_accounts`, `corrections`, `set_asides`, `budgets`, `friends`, `chat`, `notify_prefs`, `totp`, `redemptions`, `mortgage`, `trash`, `consent`, `insights_read`, `announcements_seen`, `push`, `push_locale`, `push_sent` |
| `sessions`         | expiry                                       | token hash; customer blind index                                                                                                                                                                                                                                                                  |
| `advisor_requests` | topic, status, timestamps                    | customer blind index; details (call time, note, fee)                                                                                                                                                                                                                                              |
| `advisor_messages` | sender, timestamp                            | message text                                                                                                                                                                                                                                                                                      |
| `staff_users`      | timestamps                                   | username blind index; profile (name, username, role); password as a salted scrypt hash                                                                                                                                                                                                            |
| `shared_plans`     | listed flag, copy count, timestamps          | the plan (name and percentages). **No customer reference at all**                                                                                                                                                                                                                                 |
| `payments`         | purpose, amount, provider, status, timestamp | customer blind index; receipt reference. Simulated provider only: no money moves                                                                                                                                                                                                                  |
| `friend_codes`     | code, timestamp                              | customer blind index (the code maps to it, never to a customer ID)                                                                                                                                                                                                                                |

Each customer's whole transaction history is **one sealed value**: the rows are packed,
compressed and encrypted with that customer's key. The database cannot see how many
transactions a customer has, what they bought, or when.

### Not customer data — plain

| Table               | Holds                                                                                      |
| ------------------- | ------------------------------------------------------------------------------------------ |
| `ingestions`        | What was loaded, from which file, with which checksum                                      |
| `peer_benchmarks`   | Percentiles per age band and metric, for groups of 30 or more                              |
| `usage_events`      | Counts per day, kind, topic, language and mode. No customer reference, no text             |
| `ai_usage`          | AI answers and tokens per day and model                                                    |
| `app_settings`      | Feature switches, adviser fee, AI limit and provider, reward rules                         |
| `admin_audit`       | Staff actions, when, and the staff id of who acted                                         |
| `announcements`     | Notices written by staff, and how many customers have seen each                            |
| `coach_answers`     | Answers staff taught the coach, per theme and language, and how often each was given       |
| `plan_reports`      | Reports customers made about a shared plan: the plan's code and a reason. Not who reported |
| `rate_limits`       | Hashed key, window start, count                                                            |
| `schema_migrations` | Which migrations have been applied                                                         |

### Size and speed

The full dataset — 5,100 customers, 3,626,755 transactions — loads in under a minute locally
and occupies about 300 MB. A request fetches one row by primary key and decrypts it in
memory; decrypted ledgers are cached per server instance for the most recent customers.

## Working with it

| Task                             | Command                              |
| -------------------------------- | ------------------------------------ |
| See what is connected and loaded | `pnpm db:check`                      |
| Apply new migrations             | `pnpm db:migrate`                    |
| Load or reload the dataset       | `pnpm data:ingest --source data/raw` |

Migrations are plain `.sql` files, applied in name order inside a transaction and recorded
in `schema_migrations`. To change the schema, add the next numbered file; never edit one
that has been applied.

Access is hand-written, parameterised SQL through a small `Db` interface
([`client.ts`](../src/lib/db/client.ts)). There is no ORM: the tables are few and simple.

## For a bank deployment

1. **TLS always**, `sslmode=verify-full`.
2. **Least-privilege roles**: one that owns the schema and runs migrations, one that loads
   data, and one for the running app that cannot alter tables.
3. **Row-level security** as a second line behind the application's own scoping.
4. **Keys outside the database**, in a KMS or HSM.
5. **Encrypted backups with point-in-time recovery**, and a tested restore.
6. **Separate databases and keys per environment.** No production data in development.
