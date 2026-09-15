#!/usr/bin/env bash
# Tests for the Markdown gate report. Run: bash scripts/test_gate_report.sh
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

tests=0
fails=0
ok() { tests=$((tests+1)); printf "  ok   %s\n" "$1"; }
no() { tests=$((tests+1)); fails=$((fails+1)); printf "  FAIL %s\n" "$1"; }

has()  { if [[ "$2" == *"$1"* ]]; then ok "$3"; else no "$3 :: missing '$1'"; fi; }
lacks(){ if [[ "$2" != *"$1"* ]]; then ok "$3"; else no "$3 :: unexpectedly contains '$1'"; fi; }

scaffold() {
  local d; d="$(mktemp -d)"
  cp "$ROOT"/{CLAUDE.md,LAW.md,GATE.md,TRACE.md,DECISIONS.md} "$d/"
  mkdir -p "$d/scripts"
  cp "$ROOT"/scripts/*.sh "$d/scripts/"
  printf 'SHELL := /bin/bash\n\n.PHONY: test\ntest:\n\t@echo "  ok   stub"\n\t@echo "stub tests: PASS (1 assertions)"\n' > "$d/Makefile"
  # a REALITY of its own: the real one lists artifacts this fixture does not have
  cat > "$d/REALITY.md" <<'R'
# REALITY

<!-- generated:snapshot -->
<!-- /generated:snapshot -->

<!-- generated:artifacts -->
<!-- /generated:artifacts -->

## Open Risks
- (none)
R
  cat > "$d/PATH.md" <<'P'
# PATH

## Step List (Deterministic Order)
- [ ] `P1` active.
      allowed_paths: allowed/**

## Current Pointer
- `active_step`: `P1`

## Blocking Questions
- (none)
P
  git -C "$d" init -q
  git -C "$d" config user.email t@t.t
  git -C "$d" config user.name t
  git -C "$d" add -A >/dev/null
  git -C "$d" commit -qm base
  # generate REALITY the way a real workspace would, so the staleness check has
  # something current to compare against
  ( source "$ROOT/scripts/reality_gen.sh"; reality_render "$d" ) > "$d/R.tmp"
  mv "$d/R.tmp" "$d/REALITY.md"
  printf '%s' "$d"
}

run_report() {
  local d="$1"; shift
  GOVERNANCE_DIFF_BASE=HEAD bash "$d/scripts/gate_report.sh" "$@" 2>&1
}

echo "== passing repository =="
d="$(scaffold)"
mkdir -p "$d/allowed"; echo hi > "$d/allowed/file.txt"
out="$(run_report "$d")"; rc=$?
if (( rc == 0 )); then ok "exit code 0 when everything passes"; else no "exit code should be 0, got $rc"; fi
has '<!-- governance-gate -->' "$out" "carries the marker the comment updater keys on"
has '🟢 Governance Gate — PASS' "$out" "renders the passing headline"
has '| Gate 1 · PATH admissibility | ✅ PASS |' "$out" "reports Gate 1"
has '| Gate 2 · REALITY admissibility | ✅ PASS |' "$out" "reports Gate 2"
has '| Tests | ✅ PASS |' "$out" "reports tests"
has 'Active step `P1`' "$out" "names the active step"
lacks '### Blockers' "$out" "no blockers section when passing"
rm -rf "$d"

echo
echo "== failing repository =="
d="$(scaffold)"
mkdir -p "$d/elsewhere"; echo hi > "$d/elsewhere/file.txt"
out="$(run_report "$d")"; rc=$?
if (( rc != 0 )); then ok "non-zero exit when a gate fails"; else no "exit code should be non-zero"; fi
has '🔴 Governance Gate — FAIL' "$out" "renders the failing headline"
has '### Blockers' "$out" "lists blockers"
has 'elsewhere/file.txt' "$out" "names the offending path in the blockers"
has '| Gate 2 · REALITY admissibility | ❌ FAIL |' "$out" "marks Gate 2 failed"
has '| Gate 1 · PATH admissibility | ✅ PASS |' "$out" "leaves Gate 1 passing"
has '<!-- governance-gate -->' "$out" "carries the marker even when failing"
rm -rf "$d"

echo
echo "== Gate 1 failure is attributed to Gate 1 =="
d="$(scaffold)"
sed -i 's/- (none)/- an unresolved question/' "$d/PATH.md"
out="$(run_report "$d")"
has '| Gate 1 · PATH admissibility | ❌ FAIL |' "$out" "marks Gate 1 failed"
has 'unresolved blocking questions' "$out" "names the Gate 1 blocker"
rm -rf "$d"

echo
echo "== --no-tests =="
d="$(scaffold)"
mkdir -p "$d/allowed"; echo hi > "$d/allowed/file.txt"
out="$(run_report "$d" --no-tests)"
lacks '| Tests |' "$out" "omits the tests row when asked to skip them"
has '🟢 Governance Gate — PASS' "$out" "still renders a verdict"
rm -rf "$d"

echo
echo "-----------------------------------------"
if (( fails == 0 )); then
  echo "Gate report tests: PASS ($tests assertions)"
  exit 0
fi
echo "Gate report tests: FAIL ($fails/$tests assertions failed)"
exit 1
