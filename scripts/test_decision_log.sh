#!/usr/bin/env bash
# Tests for DECISIONS.md policy-change enforcement.
# Run: bash scripts/test_decision_log.sh
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$ROOT/scripts/path_scope.sh"
source "$ROOT/scripts/decision_log.sh"

tests=0
fails=0
ok() { tests=$((tests+1)); printf "  ok   %s\n" "$1"; }
no() { tests=$((tests+1)); fails=$((fails+1)); printf "  FAIL %s\n" "$1"; }

BASE_DECISIONS='# DECISIONS (Append-Only)

## Entries

### D1 — 2026-01-01 — An older, already recorded decision
- `type`: ARCHITECTURAL
- `target_file`: `LAW.md`
- `change`: something earlier.
- `approved_by`: someone@example.com
- `approved_at`: 2026-01-01'

new_repo() {
  local d; d="$(mktemp -d)"
  git -C "$d" init -q
  git -C "$d" config user.email t@t.t
  git -C "$d" config user.name t
  printf '# LAW\n\n## Non-Negotiables\n- original rule.\n' > "$d/LAW.md"
  printf '%s\n' "$BASE_DECISIONS" > "$d/DECISIONS.md"
  git -C "$d" add -A >/dev/null
  git -C "$d" commit -qm base
  printf '%s' "$d"
}

amend_law() { printf -- '- an added rule.\n' >> "$1/LAW.md"; }

check() {
  local label="$1" d="$2" want="$3" needle="${4:-}" out rc got base
  base="$(git -C "$d" rev-list --max-parents=0 HEAD)"
  out="$(decisions_check_law_amendment "$d" "$base" 2>&1)"; rc=$?
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

echo "== policy unchanged =="
d="$(new_repo)"
check "no LAW change needs no entry" "$d" pass

d="$(new_repo)"
echo "unrelated" > "$d/other.txt"
check "changing an unrelated file needs no entry" "$d" pass

echo
echo "== policy changed =="

d="$(new_repo)"
amend_law "$d"
check "amending LAW with no new entry fails" "$d" fail "no new DECISIONS.md entry"

d="$(new_repo)"
amend_law "$d"
cat >> "$d/DECISIONS.md" <<'E'

### D2 — 2026-02-02 — A properly recorded amendment
- `type`: ARCHITECTURAL
- `target_file`: `LAW.md`
- `change`: added a rule.
- `approved_by`: gregory.kneller@gmail.com
- `approved_at`: 2026-02-02
E
check "amending LAW with an approved new entry passes" "$d" pass

# The case that makes the control real: an old approval must not be reusable.
d="$(new_repo)"
amend_law "$d"
check "the pre-existing D1 entry does not justify a new amendment" "$d" fail

d="$(new_repo)"
amend_law "$d"
cat >> "$d/DECISIONS.md" <<'E'

### D2 — 2026-02-02 — Entry with no approval
- `type`: ARCHITECTURAL
- `target_file`: `LAW.md`
- `change`: added a rule.
- `approved_by`:
- `approved_at`: 2026-02-02
E
check "an empty approved_by is not an approval" "$d" fail

d="$(new_repo)"
amend_law "$d"
cat >> "$d/DECISIONS.md" <<'E'

### D2 — 2026-02-02 — Entry with a placeholder approval
- `type`: ARCHITECTURAL
- `target_file`: `LAW.md`
- `change`: added a rule.
- `approved_by`: <who approved this>
- `approved_at`: 2026-02-02
E
check "a placeholder approved_by is not an approval" "$d" fail

d="$(new_repo)"
amend_law "$d"
cat >> "$d/DECISIONS.md" <<'E'

### D2 — 2026-02-02 — Entry with a TBD approval
- `type`: OPERATIONAL
- `target_file`: `LAW.md`
- `change`: added a rule.
- `approved_by`: TBD
- `approved_at`: 2026-02-02
E
check "a TBD approved_by is not an approval" "$d" fail

d="$(new_repo)"
amend_law "$d"
cat >> "$d/DECISIONS.md" <<'E'

### D2 — 2026-02-02 — Entry about a different file
- `type`: OPERATIONAL
- `target_file`: `CLAUDE.md`
- `change`: changed agent behaviour.
- `approved_by`: gregory.kneller@gmail.com
- `approved_at`: 2026-02-02
E
check "an entry naming another file does not justify a LAW change" "$d" fail

# approval and target must belong to the SAME entry
d="$(new_repo)"
amend_law "$d"
cat >> "$d/DECISIONS.md" <<'E'

### D2 — 2026-02-02 — Names LAW but is unapproved
- `type`: ARCHITECTURAL
- `target_file`: `LAW.md`
- `change`: added a rule.
- `approved_by`:
- `approved_at`: 2026-02-02

### D3 — 2026-02-02 — Approved but about something else
- `type`: OPERATIONAL
- `target_file`: `README.md`
- `change`: docs.
- `approved_by`: gregory.kneller@gmail.com
- `approved_at`: 2026-02-02
E
check "target and approval must be in the same entry" "$d" fail

d="$(new_repo)"
amend_law "$d"
rm "$d/DECISIONS.md"
check "amending LAW with no DECISIONS.md at all fails" "$d" fail "does not exist"

echo
echo "== end-to-end through the gate =="
d="$(new_repo)"
cp "$ROOT"/{CLAUDE.md,PATH.md,GATE.md,REALITY.md,TRACE.md} "$d/"
cp "$ROOT/LAW.md" "$d/LAW.md"
mkdir -p "$d/scripts"; cp "$ROOT"/scripts/*.sh "$d/scripts/"
sed -i 's/Last gate status: `UNKNOWN`/Last gate status: `PASS`/' "$d/REALITY.md"
git -C "$d" add -A >/dev/null; git -C "$d" commit -qm scaffold
printf -- '- a silently added rule.\n' >> "$d/LAW.md"
out="$(GOVERNANCE_DIFF_BASE="$(git -C "$d" rev-parse HEAD)" bash "$d/scripts/gate_enforce.sh" gate2 2>&1)"
if grep -q "FAIL: DECISIONS:" <<<"$out"; then ok "gate reports the unrecorded policy change"; else no "gate should report it :: $out"; fi
if grep -q "Gate enforcement result: FAIL" <<<"$out"; then ok "gate exits FAIL"; else no "gate should exit FAIL"; fi
rm -rf "$d"

echo
echo "-----------------------------------------"
if (( fails == 0 )); then
  echo "DECISIONS log tests: PASS ($tests assertions)"
  exit 0
fi
echo "DECISIONS log tests: FAIL ($fails/$tests assertions failed)"
exit 1
