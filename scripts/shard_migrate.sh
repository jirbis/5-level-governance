#!/usr/bin/env bash
# Split a legacy single-file record into one file per entry.
#
# Usage: bash scripts/shard_migrate.sh [--apply]
#
# Without --apply it only reports what it would do. The legacy file is left in
# place either way: removing it is a separate, deliberate act, because a record
# is not something a script should delete on its own.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/shard_store.sh
source "$ROOT/scripts/shard_store.sh"

APPLY=0
[[ "${1:-}" == "--apply" ]] && APPLY=1

# Reserve names in memory as well as on disk, so a dry run reports exactly the
# filenames an apply would write instead of showing the same one twice.
declare -A RESERVED=()

# Sets RESERVED_PATH rather than printing: a command substitution runs in a
# subshell, so the reservation would be discarded the moment it was made.
RESERVED_PATH=""
reserve() {
  # separate lines: bash expands the right-hand sides before `local` assigns,
  # so `target` cannot reference `base` on the same line
  local base="$1"
  local target="$base.md"
  local n=2
  while [[ -e "$ROOT/$target" || -n "${RESERVED[$target]:-}" ]]; do
    target="$base-$n.md"
    n=$(( n + 1 ))
  done
  RESERVED[$target]=1
  RESERVED_PATH="$target"
}

migrate_trace() {
  local src="$ROOT/TRACE.md" dir="trace" count=0
  [[ -f "$src" ]] || { echo "no TRACE.md to migrate"; return 0; }
  mkdir -p "$ROOT/$dir"

  local line date label body slug target
  while IFS= read -r line; do
    # legacy entry: "- YYYY-MM-DD — LABEL: body"
    [[ "$line" =~ ^-\ ([0-9]{4}-[0-9]{2}-[0-9]{2})\ (—|-)\ (.*)$ ]] || continue
    date="${BASH_REMATCH[1]}"
    body="${BASH_REMATCH[3]}"
    label="${body%%:*}"
    [[ "$label" == "$body" ]] && label="entry"

    slug="$(shard_slug "$label")"
    [[ -z "$slug" ]] && slug="entry"
    reserve "$dir/$date-$slug"; target="$RESERVED_PATH"

    count=$(( count + 1 ))
    if (( APPLY == 1 )); then
      {
        printf '# %s — %s\n\n' "$date" "$label"
        printf '%s\n' "${body#*: }"
      } > "$ROOT/$target"
    fi
    printf '  %s\n' "$target"
  done < "$src"
  printf 'trace: %s entr(ies)\n' "$count"
}

migrate_decisions() {
  local src="$ROOT/DECISIONS.md" dir="decisions" count=0
  [[ -f "$src" ]] || { echo "no DECISIONS.md to migrate"; return 0; }
  mkdir -p "$ROOT/$dir"

  # Entries start at "### D<n> — <date> — <title>" and run to the next one.
  local current="" date="" title="" target
  flush() {
    [[ -z "$current" ]] && return 0
    local slug
    slug="$(shard_slug "$title")"
    [[ -z "$slug" ]] && slug="decision"
    reserve "$dir/${date:-0000-00-00}-$slug"; target="$RESERVED_PATH"
    count=$(( count + 1 ))
    if (( APPLY == 1 )); then
      printf '%s\n' "$current" > "$ROOT/$target"
    fi
    printf '  %s\n' "$target"
    current=""
  }

  local line in_entries=0
  while IFS= read -r line; do
    if [[ "$line" == "## Entries" ]]; then in_entries=1; continue; fi
    (( in_entries == 1 )) || continue
    if [[ "$line" =~ ^\#\#\#\ (.*)$ ]]; then
      flush
      current="$line"
      local heading="${BASH_REMATCH[1]}"
      if [[ "$heading" =~ ([0-9]{4}-[0-9]{2}-[0-9]{2}) ]]; then date="${BASH_REMATCH[1]}"; else date=""; fi
      title="${heading##*— }"
      continue
    fi
    [[ -n "$current" ]] && current+=$'\n'"$line"
  done < "$src"
  flush
  printf 'decisions: %s entr(ies)\n' "$count"
}

if (( APPLY == 0 )); then
  echo "Dry run. Pass --apply to write the shards."
fi
migrate_trace
migrate_decisions
if (( APPLY == 1 )); then
  echo
  echo "Shards written. TRACE.md and DECISIONS.md were left in place; remove them"
  echo "in a deliberate commit once you have checked the split."
fi
