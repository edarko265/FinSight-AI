#!/usr/bin/env bash
# PreToolUse guard for Bash: holds the branch rules in CONTRIBUTING.md even when an agent
# ignores its instructions. Blocks pushes, force and hard resets, and commits or merges
# while main or dev is checked out. Exit code 2 refuses the call and shows the reason.
set -uo pipefail

input="$(cat)"
cmd="$(jq -r '.tool_input.command // empty' <<<"$input")"
cwd="$(jq -r '.cwd // empty' <<<"$input")"
[ -z "$cmd" ] && exit 0

block() { echo "guard-git: $1" >&2; exit 2; }

# Only look at the git invocations, wherever they sit in a compound command.
git_parts="$(grep -oE '(^|[;&|(]|&&|\|\|)[[:space:]]*git[[:space:]][^;&|)]*' <<<"$cmd" | sed -E 's/^[;&|( ]*//')"
[ -z "$git_parts" ] && exit 0

while IFS= read -r part; do
  # Where would this git run? Honour `git -C <dir>` and a leading `cd <dir> &&`.
  dir="$cwd"
  if [[ "$part" =~ git[[:space:]]+-C[[:space:]]+([^[:space:]]+) ]]; then
    dir="${BASH_REMATCH[1]}"
  elif [[ "$cmd" =~ ^[[:space:]]*cd[[:space:]]+([^[:space:]\;\&]+) ]]; then
    dir="${BASH_REMATCH[1]}"
  fi
  dir="${dir/#\~/$HOME}"
  sub="$(sed -E 's/^git[[:space:]]+(-C[[:space:]]+[^[:space:]]+[[:space:]]+)?//; s/[[:space:]].*//' <<<"$part")"

  case "$sub" in
    push) block "pushing is left to the user." ;;
    reset) [[ "$part" == *--hard* ]] && block "git reset --hard discards work; ask first." ;;
  esac
  if [[ "$sub" =~ ^(checkout|switch|clean)$ && "$part" =~ (^|[[:space:]])(--force|-f)([[:space:]]|$) ]]; then
    block "forced git $sub throws away changes; ask first."
  fi

  case "$sub" in
    commit | merge | rebase | cherry-pick | revert)
      branch="$(git -C "$dir" branch --show-current 2>/dev/null || true)"
      case "$branch" in
        main | dev) block "no direct $sub on $branch; work on your own branch (CONTRIBUTING.md)." ;;
      esac
      ;;
  esac
done <<<"$git_parts"

exit 0
