@AGENTS.md

## Working with agents

Larger changes can run through the `orchestrate` skill (`/orchestrate <goal>`): the main
session plans, the `implementer`, `test-writer` and `reviewer` agents in `.claude/agents/`
do the work in parallel, and every result is re-checked before it is merged.

- Agent worktrees live **outside** the repo, under `~/git/claude-worktrees/`, created with
  `scripts/agent-worktree.sh`. Never put a worktree inside the repo: Vitest and ESLint would
  collect every file twice.
- Agent branches are `agent/<slug>`, local only, merged into the working branch with `--no-ff`.
- `.claude/hooks/guard-git.sh` blocks `git push`, hard resets, forced checkouts, and commits or
  merges on `main`/`dev`. Pushing and PRs are left to a person.
- The branch rules in `CONTRIBUTING.md` and the conventions in `docs/coding-conventions.md`
  apply to agents too.
