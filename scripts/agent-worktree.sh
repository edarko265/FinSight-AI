#!/usr/bin/env bash
# Worktrees for coding agents, kept outside the repo so that Vitest and ESLint do not
# collect every file twice. Each worktree gets its own branch, agent/<slug>, from the base
# branch (default: the branch checked out now). Agent branches stay local and are merged
# back with --no-ff by whoever runs the agents.
#
#   scripts/agent-worktree.sh new <slug> [--db] [--base <branch>]
#   scripts/agent-worktree.sh rm <slug> [--force]
#   scripts/agent-worktree.sh ls
#
# --db copies data/derived (the embedded database) into the worktree. Each worktree needs
# its own copy: two processes writing to the same PGlite directory corrupt it.
set -euo pipefail

REPO="$(git rev-parse --show-toplevel)"
ROOT="${AGENT_WORKTREE_ROOT:-$HOME/git/claude-worktrees}"
NAME="$(basename "$REPO" | tr '[:upper:]' '[:lower:]')"

die() { echo "agent-worktree: $*" >&2; exit 1; }

# pnpm, or a temporary one from nixpkgs where none is installed. The pnpm that
# `packageManager` asks for is a generic Linux binary that NixOS cannot run, so the
# version switch is turned off.
pn() {
  if command -v pnpm >/dev/null 2>&1; then
    npm_config_manage_package_manager_versions=false pnpm "$@"
  elif command -v nix >/dev/null 2>&1; then
    nix shell nixpkgs#pnpm -c env npm_config_manage_package_manager_versions=false pnpm "$@"
  else
    die "pnpm not found"
  fi
}

path_of() { echo "$ROOT/$NAME-$1"; }

check_slug() {
  [[ "${1:-}" =~ ^[a-z0-9][a-z0-9-]*$ ]] || die "slug must be lowercase letters, digits and dashes"
}

cmd_new() {
  local slug="${1:-}" db=false base
  base="$(git -C "$REPO" branch --show-current)"
  check_slug "$slug"
  shift
  while [ $# -gt 0 ]; do
    case "$1" in
      --db) db=true ;;
      --base) base="${2:?--base needs a branch}"; shift ;;
      *) die "unknown option: $1" ;;
    esac
    shift
  done
  case "$base" in main | dev | "") die "base must be a working branch, not '${base:-detached HEAD}'" ;; esac

  local dir
  dir="$(path_of "$slug")"
  [ -e "$dir" ] && die "$dir already exists"
  mkdir -p "$ROOT"
  git -C "$REPO" worktree add -q "$dir" -b "agent/$slug" "$base"

  # Secrets stay in one place: link, never copy.
  [ -f "$REPO/.env.local" ] && ln -s "$REPO/.env.local" "$dir/.env.local"
  if $db && [ -d "$REPO/data/derived" ]; then
    mkdir -p "$dir/data"
    cp -r --reflink=auto "$REPO/data/derived" "$dir/data/derived"
  fi

  (cd "$dir" && pn install --frozen-lockfile --prefer-offline --silent)
  echo "$dir"
  echo "branch agent/$slug from $base ($(git -C "$REPO" rev-parse --short "$base"))"
  if [ -n "$(git -C "$REPO" status --porcelain)" ]; then
    echo "note: $REPO has uncommitted changes; the worktree does not see them" >&2
  fi
}

cmd_rm() {
  local slug="${1:-}" force="${2:-}" dir
  check_slug "$slug"
  dir="$(path_of "$slug")"
  if [ "$force" = "--force" ]; then
    git -C "$REPO" worktree remove --force "$dir"
    git -C "$REPO" branch -D "agent/$slug"
  else
    # Refuses on uncommitted changes or an unmerged branch, so no work is lost by accident.
    git -C "$REPO" worktree remove "$dir"
    git -C "$REPO" branch -d "agent/$slug"
  fi
}

cmd_ls() {
  git -C "$REPO" worktree list | grep -F "$ROOT/$NAME-" || echo "no agent worktrees"
}

case "${1:-}" in
  new) shift; cmd_new "$@" ;;
  rm) shift; cmd_rm "$@" ;;
  ls) cmd_ls ;;
  *) sed -n '2,13p' "$0" | sed 's/^# \{0,1\}//'; exit 2 ;;
esac
