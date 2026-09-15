#!/usr/bin/env bash
# Tests for TRACE append-only enforcement. Run: bash scripts/test_trace_append_only.sh
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$ROOT/scripts/trace_append_only.sh"

tests=0
fails=0
ok() { tests=$((tests+1)); printf "  ok   %s\n" "$1"; }
no() { tests=$((tests+1)); fails=$((fails+1)); printf "  FAIL %s\n" "$1"; }

BASE_TRACE='# TRACE (Append-Only)

## Entries
- 2026-01-01 — FIRST: initial entry; gate_1=PASS, gate_2=PASS.
- 2026-01-02 — SECOND: another entry; gate_1=PASS, gate_2=PASS.'

new_repo() {
  local d; d="$(mktemp -d)"
  git -C "$d" init -q
  git -C "$d" config user.email t@t.t
  git -C "$d" config user.name t
  printf '%s\n' "$BASE_TRACE" > "$d/TRACE.md"
  echo seed > "$d/seed.txt"
  git -C "$d" add -A >/dev/null
  git -C "$d" commit -qm base
  printf '%s' "$d"
}

# check <label> <repo> <pass|fail> [expected substring]; base is the root commit.
check() {
  local label="$1" d="$2" want="$3" needle="${4:-}" out rc got
  local base; base="$(git -C "$d" rev-list --max-parents=0 HEAD)"
  out="$(trace_verify_append_only "$d" "$base" 2>&1)"; rc=$?
  if (( rc == 0 )); then got=pass; else got=fail; fi
  if [[ "$got" != "$want" ]]; then
    no "$label (got $got, want $want) :: ${out:-<no output>}"
  elif [[ -n "$needle" && "$out" != *"$needle"* ]]; then
    no "$label (verdict right, message lacks '$needle') :: $out"
  else
    ok "$label"
  fi
  rm -rf "$d"
}

echo "== working tree =="

d="$(new_repo)"
echo '- 2026-01-03 — THIRD: appended; gate_1=PASS, gate_2=PASS.' >> "$d/TRACE.md"
check "pure append passes" "$d" pass

d="$(new_repo)"
sed -i 's/initial entry/REWRITTEN entry/' "$d/TRACE.md"
check "editing an existing entry fails" "$d" fail "diverges at"

d="$(new_repo)"
sed -i '/SECOND/d' "$d/TRACE.md"
check "deleting an entry fails" "$d" fail "truncated"

d="$(new_repo)"
sed -i '4i - 2026-01-01 — SMUGGLED: inserted in the middle; gate_1=PASS, gate_2=PASS.' "$d/TRACE.md"
check "inserting in the middle fails" "$d" fail

d="$(new_repo)"
rm "$d/TRACE.md"
check "deleting TRACE.md entirely fails" "$d" fail "truncated"

d="$(new_repo)"
printf '%s' "$BASE_TRACE" > "$d/TRACE.md"   # same content, trailing newline stripped
check "stripping the trailing newline fails" "$d" fail "truncated"

echo
echo "== commit chain =="

d="$(new_repo)"
echo '- 2026-01-03 — THIRD: appended; gate_1=PASS, gate_2=PASS.' >> "$d/TRACE.md"
git -C "$d" commit -qam third
echo '- 2026-01-04 — FOURTH: appended; gate_1=PASS, gate_2=PASS.' >> "$d/TRACE.md"
git -C "$d" commit -qam fourth
check "successive appending commits pass" "$d" pass

# The case an endpoint-only comparison cannot see: rewrite in one commit,
# restore in the next. base and HEAD look consistent; the trail is still gone.
d="$(new_repo)"
sed -i 's/initial entry/REWRITTEN entry/' "$d/TRACE.md"
git -C "$d" commit -qam "rewrite history"
printf '%s\n' "$BASE_TRACE" > "$d/TRACE.md"
echo '- 2026-01-03 — THIRD: appended; gate_1=PASS, gate_2=PASS.' >> "$d/TRACE.md"
git -C "$d" commit -qam "restore and append"
check "rewrite-then-restore is caught mid-chain" "$d" fail "rewrites TRACE.md history"

d="$(new_repo)"
echo '- 2026-01-03 — THIRD: appended; gate_1=PASS, gate_2=PASS.' >> "$d/TRACE.md"
git -C "$d" commit -qam third
sed -i 's/initial entry/REWRITTEN entry/' "$d/TRACE.md"
git -C "$d" commit -q --amend --no-edit -a
check "amending a commit to rewrite history is caught" "$d" fail "rewrites TRACE.md history"

echo
echo "== creation and edges =="

d="$(mktemp -d)"
git -C "$d" init -q; git -C "$d" config user.email t@t.t; git -C "$d" config user.name t
echo seed > "$d/seed.txt"; git -C "$d" add -A >/dev/null; git -C "$d" commit -qm base
printf '%s\n' "$BASE_TRACE" > "$d/TRACE.md"
check "creating TRACE.md where none existed passes" "$d" pass

d="$(new_repo)"
check "no change at all passes" "$d" pass

d="$(mktemp -d)"
git -C "$d" init -q; git -C "$d" config user.email t@t.t; git -C "$d" config user.name t
printf '%s' "$BASE_TRACE" > "$d/TRACE.md"   # committed without trailing newline
echo seed > "$d/seed.txt"; git -C "$d" add -A >/dev/null; git -C "$d" commit -qm base
printf '\n- 2026-01-03 — THIRD: appended; gate_1=PASS, gate_2=PASS.\n' >> "$d/TRACE.md"
check "appending to a file with no trailing newline passes" "$d" pass

echo
echo "== end-to-end through the gate =="
d="$(new_repo)"
cp "$ROOT"/{CLAUDE.md,LAW.md,PATH.md,GATE.md,REALITY.md,DECISIONS.md} "$d/"
mkdir -p "$d/scripts"
cp "$ROOT"/scripts/*.sh "$d/scripts/"   # whole dir: gate_enforce.sh sources siblings
sed -i 's/Last gate status: `UNKNOWN`/Last gate status: `PASS`/' "$d/REALITY.md"
git -C "$d" add -A >/dev/null; git -C "$d" commit -qm scaffold
sed -i 's/initial entry/REWRITTEN entry/' "$d/TRACE.md"
out="$(GOVERNANCE_DIFF_BASE="$(git -C "$d" rev-list --max-parents=0 HEAD)" bash "$d/scripts/gate_enforce.sh" gate2 2>&1)"
if grep -q "FAIL: TRACE append-only" <<<"$out"; then ok "gate reports the violation"; else no "gate should report TRACE violation :: $out"; fi
if grep -q "Gate enforcement result: FAIL" <<<"$out"; then ok "gate exits FAIL"; else no "gate should exit FAIL"; fi
rm -rf "$d"

echo
echo "-----------------------------------------"
if (( fails == 0 )); then
  echo "TRACE append-only tests: PASS ($tests assertions)"
  exit 0
fi
echo "TRACE append-only tests: FAIL ($fails/$tests assertions failed)"
exit 1
