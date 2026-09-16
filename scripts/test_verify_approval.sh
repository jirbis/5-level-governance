#!/usr/bin/env bash
# Tests for approval verification. Run: bash scripts/test_verify_approval.sh
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

tests=0
fails=0
ok() { tests=$((tests+1)); printf "  ok   %s\n" "$1"; }
no() { tests=$((tests+1)); fails=$((fails+1)); printf "  FAIL %s\n" "$1"; }

new_repo() {
  local d; d="$(mktemp -d)"
  mkdir -p "$d/scripts" "$d/decisions" "$d/trace"
  cp "$ROOT"/scripts/{path_scope.sh,shard_store.sh,verify_approval.sh} "$d/scripts/"
  printf '# LAW\n\n## Non-Negotiables\n- original.\n' > "$d/LAW.md"
  printf '# decisions/\nrules\n' > "$d/decisions/README.md"
  printf '### D0 — 2026-01-01 — older\n- `target_file`: `LAW.md`\n- `approved_by`: someone-else\n' \
    > "$d/decisions/2026-01-01-older.md"
  git -C "$d" init -q
  git -C "$d" config user.email t@t.t
  git -C "$d" config user.name t
  git -C "$d" add -A >/dev/null
  git -C "$d" commit -qm base
  printf '%s' "$d"
}

amend_law() { printf -- '- an added rule.\n' >> "$1/LAW.md"; }

add_entry() {  # add_entry <repo> <file> <target> <approver>
  cat > "$1/decisions/$2" <<E
### D9 — 2026-02-02 — a change
- \`type\`: ARCHITECTURAL
- \`target_file\`: \`$3\`
- \`approved_by\`: $4
- \`approved_at\`: 2026-02-02
E
}

approvers_file() {  # approvers_file <repo> <login...>
  local d="$1"; shift
  local f="$d/../approvers.$$"
  : > "$f"
  for a in "$@"; do printf '%s\n' "$a" >> "$f"; done
  printf '%s' "$f"
}

run() {  # run <repo> [approvers_file]
  local d="$1" f="${2:-__UNSET__}" base
  base="$(git -C "$d" rev-list --max-parents=0 HEAD)"
  if [[ "$f" == "__UNSET__" ]]; then
    ( cd "$d" && GOVERNANCE_ROOT="$d" bash scripts/verify_approval.sh "$base" 2>&1 )
  else
    ( cd "$d" && GOVERNANCE_ROOT="$d" GOVERNANCE_APPROVERS_FILE="$f" bash scripts/verify_approval.sh "$base" 2>&1 )
  fi
}

check() {  # check <label> <repo> <pass|fail> <needle> [approvers_file]
  local label="$1" d="$2" want="$3" needle="$4" f="${5:-__UNSET__}" out rc got
  out="$(run "$d" "$f")"; rc=$?
  if (( rc == 0 )); then got=pass; else got=fail; fi
  if [[ "$got" != "$want" ]]; then
    no "$label (got $got, want $want) :: $out"
  elif [[ -n "$needle" && "$out" != *"$needle"* ]]; then
    no "$label (verdict right, message lacks '$needle') :: $out"
  else
    ok "$label"
  fi
}

echo "== nothing to verify =="
d="$(new_repo)"
check "an unchanged LAW.md needs no approval" "$d" pass "nothing to verify"
rm -rf "$d"

echo
echo "== fails closed when the approvers cannot be established =="
# D4: a verifier that cannot verify must not report success. "File missing"
# means the query failed; it is not the same as "nobody approved".
d="$(new_repo)"
amend_law "$d"; add_entry "$d" 2026-02-02-new.md LAW.md jirbis
check "an unset approvers file fails, it does not pass" "$d" fail "approvers are unknown"
f="$(approvers_file "$d")"; rm -f "$f"
check "a missing approvers file fails, it does not pass" "$d" fail "never written" "$f"
rm -rf "$d"

echo
echo "== the recorded approver must have actually approved =="
d="$(new_repo)"
amend_law "$d"; add_entry "$d" 2026-02-02-new.md LAW.md jirbis
f="$(approvers_file "$d" jirbis)"
check "an entry naming a real approver passes" "$d" pass "verified against" "$f"
rm -f "$f"; rm -rf "$d"

d="$(new_repo)"
amend_law "$d"; add_entry "$d" 2026-02-02-new.md LAW.md jirbis
f="$(approvers_file "$d" someone-else)"
check "an entry naming a non-approver fails" "$d" fail "did not approve this pull request" "$f"
rm -f "$f"; rm -rf "$d"

d="$(new_repo)"
amend_law "$d"; add_entry "$d" 2026-02-02-new.md LAW.md "@JIRBIS"
f="$(approvers_file "$d" jirbis)"
check "the @ prefix and case are tolerated" "$d" pass "verified against" "$f"
rm -f "$f"; rm -rf "$d"

d="$(new_repo)"
amend_law "$d"; add_entry "$d" 2026-02-02-new.md LAW.md jirbis
f="$(approvers_file "$d")"
check "an empty approver list fails" "$d" fail "nobody has submitted an approving review" "$f"
rm -f "$f"; rm -rf "$d"

echo
echo "== the record stays immutable =="
# The pre-existing entry names someone who did not approve. It must never be
# re-examined: rewriting a past entry to satisfy a newer rule is exactly what
# the append-only record forbids.
d="$(new_repo)"
amend_law "$d"; add_entry "$d" 2026-02-02-new.md LAW.md jirbis
f="$(approvers_file "$d" jirbis)"
out="$(run "$d" "$f")"
[[ "$out" != *"2026-01-01-older"* ]] && ok "a historical entry is not re-examined" || no "historical entry was checked: $out"
[[ "$out" == *"1 entr(ies) verified"* ]] && ok "only the newly added entry is counted" || no "wrong count: $out"
rm -f "$f"; rm -rf "$d"

echo
echo "== an amendment with no entry at all =="
d="$(new_repo)"
amend_law "$d"
f="$(approvers_file "$d" jirbis)"
check "amending LAW with no new entry fails even with an approver" "$d" fail "adds no decisions/ entry" "$f"
rm -f "$f"; rm -rf "$d"

echo
echo "== an entry about another file does not authorise a LAW change =="
d="$(new_repo)"
amend_law "$d"; add_entry "$d" 2026-02-02-new.md README.md jirbis
f="$(approvers_file "$d" jirbis)"
check "an entry naming another file does not count" "$d" fail "adds no decisions/ entry" "$f"
rm -f "$f"; rm -rf "$d"

echo
echo "-----------------------------------------"
if (( fails == 0 )); then
  echo "Approval verification tests: PASS ($tests assertions)"
  exit 0
fi
echo "Approval verification tests: FAIL ($fails/$tests assertions failed)"
exit 1
