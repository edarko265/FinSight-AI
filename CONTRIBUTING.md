# Contributing to FinSight-AI

FinSight-AI is open source under the [MIT License](LICENSE). Contributions are welcome
through pull requests.

## 1. Working style

- **Never commit directly to `main` or `dev`.**
- Work on your own branch and merge through a pull request into `dev`.
- Only `dev` is promoted to `main`.

See [docs/branching-strategy.md](docs/branching-strategy.md).

## 2. Branches

| Branch                                        | Purpose                          | Pull request target              |
| --------------------------------------------- | -------------------------------- | -------------------------------- |
| `eric`, `tom`                                 | Personal working branches        | `dev`                            |
| `feature/<name>`, `fix/<name>`, `docs/<name>` | Short-lived work by anyone else  | `dev`                            |
| `dev`                                         | Integration                      | `main`                           |
| `hotfix/<name>`                               | Urgent fix, branched from `main` | `main`, then merge back to `dev` |

## 3. Commits

Use [Conventional Commits](https://www.conventionalcommits.org):

```
feat(analytics): add basket reconciliation
fix(ingest): strip BOM before header match
docs: clarify dataset download
```

Keep commits focused. Commits are authored by the person who made them.

## 4. Pull requests

Every pull request must:

- Target `dev`
- Use the pull request template
- Pass all CI checks (`pnpm check` runs the same gates locally)
- Stay small enough to review

## 5. Code quality

Follow [docs/coding-conventions.md](docs/coding-conventions.md). Do not disable lint rules
or skip tests without explaining why in the pull request.

## 6. Secrets and data

- Never commit secrets, tokens, credentials or `.env` files. Document new variables in
  `.env.example` with a placeholder.
- Never commit the bank-provided dataset or anything derived from it.
- Nothing sensitive is written to the database unencrypted. See
  [docs/security.md](docs/security.md).

If a secret is committed by accident, **rotate it immediately** and tell the maintainer.

## 7. Security issues

Do not open a public issue. See [SECURITY.md](SECURITY.md).
