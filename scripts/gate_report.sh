#!/usr/bin/env bash
# Render gate and test results as Markdown, for a pull request comment or a job
# summary. The rendering lives here rather than in the workflow YAML so it can
# be tested like anything else.
#
# Usage: bash scripts/gate_report.sh [--no-tests]
# Exit:  0 if everything passed, 1 otherwise. stdout is the report.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_TESTS=1
[[ "${1:-}" == "--no-tests" ]] && RUN_TESTS=0

MARKER="<!-- governance-gate -->"

gate_out="$(bash "$ROOT/scripts/gate_enforce.sh" all 2>&1)"
gate_rc=$?

tests_out=""
tests_rc=0
have_tests=0

# An installed workspace has no `test` target until the project adds one, and
# reporting FAIL for tests that were never configured would teach people to
# ignore the verdict. But a dry run also fails when the target EXISTS and cannot
# run, and calling that "not configured" would hide a broken test setup behind a
# green verdict - the same vacuous pass the diff-base bug produced.
#
# The two are distinguishable: make names the missing target, and adds
# "needed by" when the missing thing is a prerequisite of an existing target.
test_target_state() {
  local out rc
  out="$(make -C "$ROOT" -n test 2>&1)"
  rc=$?
  if (( rc == 0 )); then
    printf 'present'
    return
  fi
  if grep -q "No rule to make target" <<<"$out" && ! grep -q "needed by" <<<"$out"; then
    printf 'absent'
    return
  fi
  printf 'broken'
}

if (( RUN_TESTS == 1 )); then
  case "$(test_target_state)" in
    present)
      have_tests=1
      tests_out="$(make -C "$ROOT" test 2>&1)"
      tests_rc=$?
      ;;
    broken)
      have_tests=1
      tests_rc=1
      tests_out="$(make -C "$ROOT" test 2>&1)"
      ;;
    absent) ;;
  esac
fi

fails="$(grep '^FAIL: ' <<<"$gate_out" || true)"
pass_count="$(grep -c '^PASS: ' <<<"$gate_out" || true)"
fail_count="$(grep -c '^FAIL: ' <<<"$gate_out" || true)"

# Gate 1 and Gate 2 are reported separately; split the output at the Gate 2 header
gate1_out="$(sed -n '/== Gate 1:/,/== Gate 2:/p' <<<"$gate_out" | grep -E '^(PASS|FAIL): ' || true)"
gate2_out="$(sed -n '/== Gate 2:/,$p' <<<"$gate_out" | grep -E '^(PASS|FAIL): ' || true)"

verdict() { if grep -q '^FAIL: ' <<<"$1"; then printf '❌ FAIL'; else printf '✅ PASS'; fi; }

active_step="$(sed -n 's/^- `active_step`: `\([^`]*\)`.*/\1/p' "$ROOT/PATH.md" | head -n1)"
base_line="$(grep -oE 'against [0-9a-f]{7,40}' <<<"$gate_out" | head -n1 | awk '{print $2}')"
scope_line="$(grep -E '^(PASS|FAIL): PATH scope: ' <<<"$gate_out" | head -n1)"

overall="PASS"
if (( gate_rc != 0 || tests_rc != 0 )); then
  overall="FAIL"
fi

printf '%s\n' "$MARKER"
if [[ "$overall" == "PASS" ]]; then
  printf '## 🟢 Governance Gate — PASS\n\n'
else
  printf '## 🔴 Governance Gate — FAIL\n\n'
fi

printf '| Check | Result |\n| --- | --- |\n'
printf '| Gate 1 · PATH admissibility | %s |\n' "$(verdict "$gate1_out")"
printf '| Gate 2 · REALITY admissibility | %s |\n' "$(verdict "$gate2_out")"
if (( RUN_TESTS == 1 )); then
  if (( have_tests == 0 )); then
    printf '| Tests | — not configured |\n'
  elif (( tests_rc == 0 )); then
    printf '| Tests | ✅ PASS |\n'
  else
    printf '| Tests | ❌ FAIL |\n'
  fi
fi
printf '\n'

printf 'Active step `%s`' "${active_step:-unknown}"
if [[ -n "$base_line" ]]; then
  printf ' · diffed against `%s`' "${base_line:0:12}"
fi
printf ' · %s passed, %s failed\n\n' "$pass_count" "$fail_count"

if [[ -n "$fails" ]]; then
  printf '### Blockers\n\n'
  while IFS= read -r line; do
    [[ -n "$line" ]] && printf -- '- %s\n' "${line#FAIL: }"
  done <<<"$fails"
  printf '\n'
fi

if [[ -n "$scope_line" ]]; then
  printf '> %s\n\n' "${scope_line#*: }"
fi

printf '<details><summary>Full gate output</summary>\n\n```\n%s\n```\n\n</details>\n' "$gate_out"

if (( RUN_TESTS == 1 )) && (( have_tests == 1 )) && [[ -n "$tests_out" ]]; then
  printf '\n<details><summary>Test output</summary>\n\n```\n%s\n```\n\n</details>\n' \
    "$(grep -E '^(  (ok|FAIL) |.*(tests|parity): )' <<<"$tests_out" || printf '%s' "$tests_out")"
fi

[[ "$overall" == "PASS" ]]
