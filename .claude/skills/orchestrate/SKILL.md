---
name: orchestrate
description: Run a FinSight-AI change as an orchestrator, splitting it into tasks, dispatching implementer/test-writer agents in parallel worktrees, verifying each independently, reviewing, and merging into the working branch. Use when the user says /orchestrate, asks to "use agents" or to parallelise work on this repo.
---

# Orchestrate

You are the orchestrator. Agents write the code; you own the plan, the verification and the
merge. **An agent's report is a claim, not evidence.** Nothing is merged on a report alone.

## 0. Preconditions

- Note the working branch: `git branch --show-current`. It must not be `main` or `dev`.
  Agent branches start from its **last commit**. If `git status` shows uncommitted changes,
  tell the user that agents will not see them, and ask whether to go on or commit first.
  Do not commit the user's work yourself.
- Read or create the board, `.claude/orchestrator/board.md` (gitignored). After a context
  reset, the board is the state: pick up from it.

## 1. Plan

Split the goal into tasks. For each one, fill in a brief:

| field      | content                                                               |
| ---------- | --------------------------------------------------------------------- |
| slug       | `lowercase-dashes`, also the branch `agent/<slug>`                    |
| agent      | `implementer` or `test-writer`                                        |
| files      | the files it owns. **No two parallel tasks share a file.**            |
| goal       | what changes and why, in two or three sentences                       |
| acceptance | the command(s) that prove it, normally `pnpm check` plus a named test |
| needs db   | whether it needs `data/derived` (integration tests, ingestion)        |

Shared files (the i18n message files `src/lib/i18n/messages/*.ts`, `registry.ts`,
`contracts/`) are the usual cause of conflicts. Give each one to a single task, or do that
part yourself after the merge. Show the user the task table and get a go-ahead before you
dispatch anything with more than two tasks.

Write the board:

```
| slug | agent | worktree | status | verified |
| ---- | ----- | -------- | ------ | -------- |
```

Statuses: `planned → running → returned → verified → reviewed → merged` (or `failed`).

## 2. Dispatch

For each task: `scripts/agent-worktree.sh new <slug> [--db]`. It prints the worktree path.
Then, in **one message**, one Agent call per task with `run_in_background: true`. Run at
most 3 at once. Do **not** use `isolation: "worktree"`, because it creates the worktree inside
the repo, where Vitest and ESLint collect every file twice. The brief in the prompt must
hold everything the agent needs: it starts cold.

```
Worktree: <path>   Branch: agent/<slug>
Files you own: ...
Goal: ...
Acceptance: ...
Context: <the file:line pointers you already found, so it does not re-search>
```

## 3. Verify (per returned task, yourself)

```bash
cd <worktree>
git log --oneline <base>..HEAD     # exactly the commits you expected
git diff --stat <base>...HEAD      # only the files in the brief
pnpm check                         # the full gate, not just the agent's subset
```

Without `pnpm`, use
`nix shell nixpkgs#pnpm -c env npm_config_manage_package_manager_versions=false pnpm check`.
If it fails, send the failing output back to the **same** agent once with SendMessage. If it
fails a second time, fix it yourself or mark it `failed` and tell the user. Never relay
"done" without this step.

## 4. Review

Dispatch `reviewer` on the verified branch (worktree path + base). It is read-only and can
run in parallel with other tasks. Send confirmed findings back to the implementer. Show the
user plausible findings rather than acting on them silently.

## 5. Merge

One branch at a time, in an order where later tasks build on earlier ones:

```bash
git merge --no-ff agent/<slug> -m "merge(agent): <slug>"
pnpm check                          # on the working branch, after every merge
scripts/agent-worktree.sh rm <slug>
```

Use `--no-ff` because merge commits are the repo's convention and keep each agent's work
visible as a unit. If the merge conflicts, stop and resolve it on the working branch (never
on `dev`), then run the check again. Pushing and opening a PR to `dev` are the **user's**
call: offer them, and never do either unasked (the guard hook blocks `git push` in any case).

## 6. Close

Report per task: merged, failed or dropped, with the evidence (check summary line, review
outcome). Clear finished rows from the board. Leftover worktrees: `scripts/agent-worktree.sh ls`.
