#!/usr/bin/env bash
# Tests for the sharded append-only records. Run: bash scripts/test_shard_store.sh
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$ROOT/scripts/shard_store.sh"

tests=0
fails=0
ok() { tests=$((tests+1)); printf "  ok   %s\n" "$1"; }
no() { tests=$((tests+1)); fails=$((fails+1)); printf "  FAIL %s\n" "$1"; }
has() { if [[ "$2" == *"$1"* ]]; then ok "$3"; else no "$3 :: missing '$1'"; fi; }

new_repo() {
  local d; d="$(mktemp -d)"
  git -C "$d" init -q
  git -C "$d" config user.email t@t.t
  git -C "$d" config user.name t
  mkdir -p "$d/trace"
  printf '# trace/\nrules, not an entry\n' > "$d/trace/README.md"
  printf '# 2026-01-01 — FIRST\n\nbody; gate_1=PASS, gate_2=PASS.\n' > "$d/trace/2026-01-01-first.md"
  printf '# 2026-01-02 — SECOND\n\nbody; gate_1=PASS, gate_2=PASS.\n' > "$d/trace/2026-01-02-second.md"
  git -C "$d" add -A >/dev/null
  git -C "$d" commit -qm base
  printf '%s' "$d"
}

base_of() { git -C "$1" rev-list --max-parents=0 HEAD; }

echo "== slugs and paths =="
[[ "$(shard_slug 'SCOPE ENFORCEMENT: bind PATH steps!')" == "scope-enforcement-bind-path-steps" ]] \
  && ok "slug is filesystem safe" || no "slug wrong: $(shard_slug 'SCOPE ENFORCEMENT: bind PATH steps!')"
[[ "$(shard_slug '  ///  ')" == "" ]] && ok "a slug of only separators collapses to empty" || no "separator-only slug"

d="$(new_repo)"
p1="$(shard_new_path "$d" trace "FIRST")"
printf 'x\n' > "$d/$p1"
p2="$(shard_new_path "$d" trace "FIRST")"
[[ "$p1" != "$p2" ]] && ok "a same-day collision gets a distinct path" || no "collision reused '$p1'"
rm -rf "$d"

echo
echo "== listing and rendering =="
d="$(new_repo)"
list="$(shard_list "$d" trace)"
[[ "$(wc -l <<<"$list")" == "2" ]] && ok "lists the two entries" || no "expected 2 entries, got: $list"
[[ "$list" != *README.md* ]] && ok "README.md is not an entry" || no "README.md leaked into the listing"
[[ "$(head -n1 <<<"$list")" == *2026-01-01* ]] && ok "entries are ordered by date" || no "ordering wrong"
render="$(shard_render "$d" trace)"
has 'FIRST' "$render" "render includes the first entry"
has 'SECOND' "$render" "render includes the second entry"
[[ "$render" != *"rules, not an entry"* ]] && ok "render omits README.md" || no "render included README.md"
rm -rf "$d"

echo
echo "== immutability =="
d="$(new_repo)"
printf '# 2026-01-03 — THIRD\n\nbody; gate_1=PASS, gate_2=PASS.\n' > "$d/trace/2026-01-03-third.md"
shard_immutability "$d" "$(base_of "$d")" trace >/dev/null && ok "adding an entry is admissible" || no "addition should pass"
rm -rf "$d"

d="$(new_repo)"
printf 'tampered\n' >> "$d/trace/2026-01-01-first.md"
out="$(shard_immutability "$d" "$(base_of "$d")" trace)" && no "modifying an entry should fail" || \
  has 'modified: trace/2026-01-01-first.md' "$out" "names the modified entry"
rm -rf "$d"

d="$(new_repo)"
rm "$d/trace/2026-01-02-second.md"
out="$(shard_immutability "$d" "$(base_of "$d")" trace)" && no "deleting an entry should fail" || \
  has 'deleted: trace/2026-01-02-second.md' "$out" "names the deleted entry"
rm -rf "$d"

d="$(new_repo)"
git -C "$d" mv trace/2026-01-01-first.md trace/2026-01-01-renamed.md >/dev/null
out="$(shard_immutability "$d" "$(base_of "$d")" trace)" && no "renaming an entry should fail" || \
  ok "renaming an entry is rejected"
rm -rf "$d"

# A rewrite that is later restored: the endpoints match, so only walking the
# chain can see it. This is the case a naive endpoint diff calls clean.
d="$(new_repo)"
printf 'tampered\n' >> "$d/trace/2026-01-01-first.md"
git -C "$d" commit -qam tamper
git -C "$d" checkout "$(base_of "$d")" -- trace/2026-01-01-first.md
git -C "$d" commit -qam restore
out="$(shard_immutability "$d" "$(base_of "$d")" trace)" && no "rewrite-then-restore should be caught" || \
  has 'touched in commit' "$out" "catches a rewrite that was restored later"
rm -rf "$d"

# But an entry added on this branch may still be corrected before it merges.
d="$(new_repo)"
printf '# 2026-01-03 — THIRD\n\nbody; gate_1=PASS, gate_2=PASS.\n' > "$d/trace/2026-01-03-third.md"
git -C "$d" add -A >/dev/null; git -C "$d" commit -qm third
printf 'typo fixed; gate_1=PASS, gate_2=PASS.\n' > "$d/trace/2026-01-03-third.md"
git -C "$d" commit -qam fix
shard_immutability "$d" "$(base_of "$d")" trace >/dev/null \
  && ok "correcting an entry added on this branch is still allowed" \
  || no "a not-yet-merged entry should remain editable"
rm -rf "$d"

echo
echo "== the point of sharding: parallel entries do not conflict =="
d="$(new_repo)"
git -C "$d" checkout -qb agent-a
printf '# 2026-01-03 — A\n\nbody; gate_1=PASS, gate_2=PASS.\n' > "$d/trace/2026-01-03-a.md"
git -C "$d" add -A >/dev/null; git -C "$d" commit -qm a
git -C "$d" checkout -q master 2>/dev/null || git -C "$d" checkout -q main
git -C "$d" checkout -qb agent-b
printf '# 2026-01-03 — B\n\nbody; gate_1=PASS, gate_2=PASS.\n' > "$d/trace/2026-01-03-b.md"
git -C "$d" add -A >/dev/null; git -C "$d" commit -qm b
if git -C "$d" merge -q --no-edit agent-a >/dev/null 2>&1; then
  ok "two agents adding entries on the same day merge cleanly"
else
  no "merge conflicted, which sharding exists to prevent"
fi
[[ -f "$d/trace/2026-01-03-a.md" && -f "$d/trace/2026-01-03-b.md" ]] \
  && ok "both entries survive the merge" || no "an entry was lost in the merge"
rm -rf "$d"

echo
echo "== added-entry detection =="
d="$(new_repo)"
printf '# 2026-01-03 — THIRD\n\nbody; gate_1=PASS, gate_2=PASS.\n' > "$d/trace/2026-01-03-third.md"
added="$(shard_added "$d" "$(base_of "$d")" trace)"
[[ "$added" == "trace/2026-01-03-third.md" ]] && ok "reports only the new entry" || no "added set wrong: $added"
rm -rf "$d"

echo
echo "-----------------------------------------"
if (( fails == 0 )); then
  echo "Shard store tests: PASS ($tests assertions)"
  exit 0
fi
echo "Shard store tests: FAIL ($fails/$tests assertions failed)"
exit 1
